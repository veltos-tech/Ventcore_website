// Сквозная проверка Telegram-бота на собранном сайте (после `npm run build`).
// Сайт запускается как на сервере, но Telegram API подменён (scripts/mock-telegram.cjs): реальный бот и сеть не нужны.
// Запуск: npm run test:bot  (в CI выполняется после сборки).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

if (!existsSync('.next/BUILD_ID')) { console.error('Сначала выполните npm run build.'); process.exit(1); }

const port = Number(process.env.TEST_BOT_PORT ?? 3200);
const base = `http://127.0.0.1:${port}`;
const root = mkdtempSync(join(tmpdir(), 'ventcore-bot-test-'));
const logFile = join(root, 'telegram.log');
const controlFile = join(root, 'control.json');
const dbFile = join(root, 'crm.sqlite');
const secret = 'test-webhook-secret-0123456789-abcdefghij';
const ADMIN = 111, CLIENT = 222, STRANGER = 333;
writeFileSync(logFile, ''); writeFileSync(controlFile, '{}');

const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], {
  env: { ...process.env, NODE_ENV: 'production', // Путь в кавычках: в нём могут быть пробелы, а NODE_OPTIONS делится по пробелам.
    NODE_OPTIONS: `--require=${JSON.stringify(resolve('scripts/mock-telegram.cjs'))}`,
    MOCK_TELEGRAM_LOG: logFile, MOCK_TELEGRAM_CONTROL: controlFile,
    TELEGRAM_BOT_TOKEN: '123456:TEST-TOKEN', TELEGRAM_ADMIN_IDS: String(ADMIN), TELEGRAM_WEBHOOK_SECRET: secret,
    CRM_CRON_SECRET: 'test-cron-secret-0123456789-abcdefghijk', CRM_DB_PATH: dbFile, CRM_BACKUP_DIR: join(root, 'backups') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk; });
server.stderr.on('data', (chunk) => { serverOutput += chunk; });
const stop = () => { server.kill('SIGTERM'); rmSync(root, { recursive: true, force: true }); };
process.on('exit', stop);

let updateId = 1000, logOffset = 0, failures = 0;
const control = (rules) => writeFileSync(controlFile, JSON.stringify(rules));

/** Отправляет обновление на webhook и возвращает вызовы Telegram API, которые в ответ сделал бот. */
async function send(update) {
  const response = await fetch(`${base}/api/telegram/webhook`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': secret },
    body: JSON.stringify({ update_id: ++updateId, ...update }),
  });
  assert.equal(response.status, 200, `webhook ответил ${response.status}`);
  const lines = readFileSync(logFile, 'utf8').split('\n').filter(Boolean);
  const calls = lines.slice(logOffset).map((line) => JSON.parse(line)).filter((call) => call.method !== 'getChatMember');
  logOffset = lines.length;
  return calls;
}
const chatOf = (id) => ({ id, type: 'private' });
const message = (from, text) => send({ message: { message_id: updateId, from: { id: from, first_name: 'Тест' }, chat: chatOf(from), text } });
const callback = (from, data, messageId = 50) => send({ callback_query: { id: `cb${updateId}`, from: { id: from, first_name: 'Тест' }, data, message: { message_id: messageId, chat: chatOf(from) } } });
const widget = (from, data, messageId = 70) => send({ widget_query: { id: `wq${updateId}`, from: { id: from, first_name: 'Тест' }, chat: chatOf(from), message_id: messageId, data } });

const only = (calls, method) => calls.filter((call) => call.method === method);
const texts = (calls) => calls.filter((call) => call.payload.text).map((call) => call.payload.text);
const buttons = (call) => (call?.payload.reply_markup?.inline_keyboard ?? []).flat();
const hasButton = (call, data) => buttons(call).some((b) => b.callback_data === data);
const db = () => new DatabaseSync(dbFile, { readOnly: true });

async function scenario(name, run) {
  try { await run(); console.log(`  ok   ${name}`); } catch (error) { failures++; console.log(`  FAIL ${name}\n       ${String(error.message).split('\n').join('\n       ')}`); }
}

try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${base}/robots.txt`)).ok) break; } catch { /* ещё запускается */ }
    await new Promise((done) => setTimeout(done, 500));
    assert.ok(i < 59, `сайт не запустился:\n${serverOutput.slice(-800)}`);
  }

  await scenario('администратор: /start даёт клавиатуру внизу экрана и сводку', async () => {
    const calls = await message(ADMIN, '/start');
    const [keyboard, home] = only(calls, 'sendMessage');
    const labels = keyboard.payload.reply_markup.keyboard.flat().map((b) => b.text);
    assert.deepEqual(labels, ['📊 Сводка', '📋 Заявки', '🔎 Поиск', '⏰ Напоминания', '📦 Заказы', '➕ Новая заявка']);
    assert.equal(keyboard.payload.reply_markup.is_persistent, true);
    assert.equal(home.payload.parse_mode, 'HTML');
    assert.match(home.payload.text, /сводка/);
    assert.ok(hasButton(home, 'ls:all:0') && hasButton(home, 'menu:dashboard'));
  });

  await scenario('клиент: /start показывает виджет-карточку и клавиатуру, без подписки — только приглашение', async () => {
    const calls = await message(CLIENT, '/start');
    const w = only(calls, 'sendWidget')[0];
    assert.ok(w, 'виджет не отправлен');
    assert.equal(w.payload.allow_queries, true);
    assert.match(w.payload.html, /Оставить заявку/);
    const text = only(calls, 'sendMessage')[0];
    assert.deepEqual(text.payload.reply_markup.keyboard.flat().map((b) => b.text), ['📝 Оставить заявку', '💬 Связаться с менеджером']);
    assert.ok(calls.indexOf(w) < calls.indexOf(text), 'виджет должен идти раньше текста');
    control({ notSubscribed: [STRANGER] });
    const unsubscribed = await message(STRANGER, '/start');
    assert.equal(only(unsubscribed, 'sendWidget').length, 0, 'без подписки виджета быть не должно');
    assert.ok(hasButton(unsubscribed[0], 'client:check'));
    control({});
  });

  await scenario('клиент: заявка через кнопки нижней клавиатуры; администратор получает карточку', async () => {
    assert.match(texts(await message(CLIENT, '📝 Оставить заявку'))[0], /Как к вам обращаться/);
    // Текст кнопки посреди ввода не должен стать именем.
    assert.match(texts(await message(CLIENT, '📝 Оставить заявку'))[0], /Как к вам обращаться/);
    assert.match(texts(await message(CLIENT, 'Иван'))[0], /номер телефона/);
    assert.match(texts(await message(CLIENT, '+7 999 123-45-67'))[0], /коротко/);
    assert.match(texts(await callback(CLIENT, 'client:skip'))[0], /Проверьте заявку/);
    const calls = await callback(CLIENT, 'client:confirm');
    const card = only(calls, 'sendMessage').find((call) => call.payload.chat_id === String(ADMIN));
    assert.ok(card, 'администратор не получил заявку');
    assert.equal(card.payload.parse_mode, 'HTML');
    assert.match(card.payload.text, /<b>Заявка #1<\/b> · 🆕 Новая/);
    assert.match(card.payload.text, /Иван/);
    assert.ok(hasButton(card, 's:1:contacted') && hasButton(card, 's:1:in_progress') && hasButton(card, 's:1:lost'), 'быстрые статусы');
    assert.ok(only(calls, 'sendMessage').some((call) => call.payload.chat_id === String(CLIENT)), 'клиент не получил подтверждение');
  });

  await scenario('клиент: «Связаться с менеджером» кнопкой уведомляет администратора', async () => {
    assert.match(texts(await message(CLIENT, '💬 Связаться с менеджером'))[0], /Менеджер получит уведомление/);
    const calls = await callback(CLIENT, 'client:manager:send');
    const note = only(calls, 'sendMessage').find((call) => call.payload.chat_id === String(ADMIN));
    assert.match(note.payload.text, /просит связаться с менеджером/);
    assert.ok(hasButton(note, 'open:2'), 'кнопка открытия заявки из уведомления');
  });

  await scenario('администратор: «📋 Заявки» — список с фильтрами и счётчиками', async () => {
    const [list] = only(await message(ADMIN, '📋 Заявки'), 'sendMessage');
    assert.equal(list.payload.method, undefined, 'из текстовой команды — новое сообщение');
    assert.match(list.payload.text, /<b>Заявки<\/b> · 1–2/);
    for (const data of ['ls:all:0', 'ls:new:0', 'ls:contacted:0', 'ls:in_progress:0', 'ls:won:0', 'lead:1', 'lead:2', 'menu:home']) assert.ok(hasButton(list, data), data);
    assert.equal(buttons(list).find((b) => b.callback_data === 'ls:new:0').text, '🆕 2');
  });

  await scenario('администратор: навигация по кнопкам правит то же сообщение', async () => {
    const calls = await callback(ADMIN, 'lead:1', 55);
    const edit = only(calls, 'editMessageText')[0];
    assert.ok(edit, 'ожидалась правка сообщения');
    assert.equal(edit.payload.message_id, 55);
    assert.equal(only(calls, 'sendMessage').length, 0, 'новых сообщений быть не должно');
    assert.equal(only(calls, 'answerCallbackQuery').length, 1);
  });

  await scenario('администратор: смена статуса одним нажатием, подсказка и обновлённая карточка', async () => {
    const calls = await callback(ADMIN, 's:1:contacted', 55);
    assert.match(only(calls, 'answerCallbackQuery')[0].payload.text, /Связались/);
    const edit = only(calls, 'editMessageText')[0];
    assert.match(edit.payload.text, /📞 Связались/);
    assert.ok(hasButton(edit, 's:1:in_progress') && !hasButton(edit, 's:1:contacted'), 'кнопки следующего шага воронки');
    const filtered = only(await callback(ADMIN, 'ls:contacted:0', 55), 'editMessageText')[0];
    assert.match(filtered.payload.text, /📞 Связались/);
    assert.ok(hasButton(filtered, 'lead:1') && !hasButton(filtered, 'lead:2'), 'фильтр по статусу');
  });

  await scenario('администратор: «📊 Сводка» присылает виджет с данными в пределах лимита', async () => {
    const [w] = only(await message(ADMIN, '📊 Сводка'), 'sendWidget');
    assert.ok(w, 'виджет не отправлен');
    assert.match(w.payload.html, /VentCore · заявки/);
    assert.equal(w.payload.allow_queries, true);
    assert.ok(Buffer.byteLength(w.payload.chat_data) <= 1024, 'chat_data больше 1024 байт');
    const data = JSON.parse(w.payload.chat_data);
    assert.equal(data.n.reduce((a, b) => a + b, 0), 2);
    assert.equal(data.n[1], 1, 'одна заявка в статусе «Связались»');
    assert.ok(w.payload.caption && hasButton(w, 'dash:refresh'));
  });

  await scenario('виджет: «Обновить» подтверждает запрос и обновляет данные того же сообщения', async () => {
    const calls = await widget(ADMIN, 'dash:refresh', 77);
    const answer = only(calls, 'answerWidgetQuery')[0];
    assert.ok(answer && answer.payload.data === 'ok');
    const edit = only(calls, 'editMessageWidgetData')[0];
    assert.equal(edit.payload.message_id, 77);
    assert.doesNotThrow(() => JSON.parse(edit.payload.chat_data));
    assert.equal(only(calls, 'editMessageCaption').length, 1);
    assert.equal(only(calls, 'answerCallbackQuery').length, 0);
  });

  await scenario('виджет: нажатие на заявку открывает карточку новым сообщением', async () => {
    const calls = await widget(ADMIN, 'open:1', 77);
    assert.equal(only(calls, 'answerWidgetQuery').length, 1);
    const [card] = only(calls, 'sendMessage');
    assert.match(card.payload.text, /Заявка #1/);
    assert.equal(only(calls, 'editMessageText').length, 0, 'сообщение-виджет править нельзя');
  });

  await scenario('безопасность: не администратор не получает данные заявок через виджет', async () => {
    const calls = await widget(CLIENT, 'open:1', 77);
    assert.equal(only(calls, 'answerWidgetQuery').length, 1, 'запрос всё равно нужно подтвердить');
    assert.ok(!texts(calls).some((text) => /Заявка #1|Иван/.test(text)), 'утечка данных заявки');
    const stranger = await callback(CLIENT, 'lead:1');
    assert.ok(!texts(stranger).some((text) => /<b>Заявка #1/.test(text)));
  });

  await scenario('клиентский виджет: «Оставить заявку» запускает сценарий', async () => {
    const calls = await widget(CLIENT, 'client:new', 70);
    assert.match(texts(calls).join('\n'), /Как к вам обращаться/);
  });

  await scenario('кнопка нижней клавиатуры прерывает ввод заметки, а не становится её текстом', async () => {
    await callback(ADMIN, 'note:1', 55);
    const before = db().prepare('SELECT count(*) AS c FROM notes WHERE lead_id=1').get().c;
    const calls = await message(ADMIN, '📋 Заявки');
    assert.match(texts(calls)[0], /Заявки/);
    assert.equal(db().prepare('SELECT count(*) AS c FROM notes WHERE lead_id=1').get().c, before, 'заметка не должна создаваться');
    // А обычный текст после «📝 Заметка» — это заметка.
    await callback(ADMIN, 'note:1', 55);
    await message(ADMIN, 'Позвонить после обеда');
    assert.equal(db().prepare('SELECT count(*) AS c FROM notes WHERE lead_id=1').get().c, before + 1);
  });

  await scenario('администратор: «➕ Новая заявка» и выход из неё кнопкой меню', async () => {
    assert.match(texts(await message(ADMIN, '➕ Новая заявка'))[0], /Имя клиента/);
    const list = await message(ADMIN, '📋 Заявки');
    assert.match(texts(list)[0], /Заявки/, 'кнопка должна прерывать ввод заявки');
    assert.doesNotMatch(texts(await message(ADMIN, 'Просто текст')).join(''), /Телефон клиента/, 'ввод заявки сброшен');
  });

  await scenario('администратор: «🔎 Поиск» — подсказка, затем результаты', async () => {
    assert.match(texts(await message(ADMIN, '🔎 Поиск'))[0], /Введите имя или телефон/);
    const [found] = only(await message(ADMIN, 'Иван'), 'sendMessage');
    assert.match(found.payload.text, /Поиск: Иван/);
    assert.ok(hasButton(found, 'lead:1'));
    const byPhone = only(await message(ADMIN, '/search 9991234567'), 'sendMessage')[0];
    assert.ok(hasButton(byPhone, 'lead:1'), 'поиск по цифрам телефона');
  });

  await scenario('имена и заметки экранируются в HTML-сообщениях', async () => {
    await callback(ADMIN, 'note:1', 55);
    await message(ADMIN, '<b>жирный</b> & <script>');
    const [card] = only(await callback(ADMIN, 'lead:1', 55), 'editMessageText');
    assert.match(card.payload.text, /&lt;b&gt;жирный&lt;\/b&gt; &amp; &lt;script&gt;/);
    assert.ok(!/<script>/.test(card.payload.text));
  });

  await scenario('отказ Telegram для виджета: приходит обычная сводка', async () => {
    control({ sendWidget: { status: 400, description: 'Bad Request: method not found' } });
    const calls = await message(ADMIN, '📊 Сводка');
    assert.equal(only(calls, 'sendWidget').length, 1);
    const [fallback] = only(calls, 'sendMessage');
    assert.match(fallback.payload.text, /сводка/);
    assert.equal(fallback.payload.method, undefined);
    assert.equal(only(await message(ADMIN, '/menu'), 'sendWidget').length, 0);
    control({});
  });

  await scenario('правка недоступна: содержимое приходит новым сообщением; «не изменено» — не ошибка', async () => {
    control({ editMessageText: { status: 400, description: 'Bad Request: message to edit not found' } });
    const calls = await callback(ADMIN, 'lead:1', 99);
    assert.equal(only(calls, 'editMessageText').length, 1);
    assert.match(only(calls, 'sendMessage')[0].payload.text, /Заявка #1/);
    control({ editMessageText: { status: 400, description: 'Bad Request: message is not modified: specified new message content and reply markup are exactly the same' } });
    const same = await callback(ADMIN, 'lead:1', 99);
    assert.equal(only(same, 'sendMessage').length, 0, 'повторная отправка при «not modified» не нужна');
    control({});
  });

  await scenario('обычные сообщения при сбое Telegram остаются в очереди (поведение не изменилось)', async () => {
    control({ sendMessage: { status: 500, description: 'Internal Server Error' } });
    await message(ADMIN, '/help');
    control({});
    const row = db().prepare("SELECT state, attempts FROM outbox WHERE state='pending' ORDER BY id DESC LIMIT 1").get();
    assert.ok(row && row.attempts >= 1, 'сообщение должно ждать повторной отправки');
  });

  await scenario('справка и меню правятся на месте', async () => {
    const help = only(await callback(ADMIN, 'menu:help', 60), 'editMessageText')[0];
    assert.match(help.payload.text, /Статусы заявок/);
    const home = only(await callback(ADMIN, 'menu:home', 60), 'editMessageText')[0];
    assert.match(home.payload.text, /сводка/);
  });
} finally {
  stop();
}

console.log(failures ? `\nНе пройдено сценариев: ${failures}` : '\nБот: все сценарии пройдены.');
process.exit(failures ? 1 : 0);
