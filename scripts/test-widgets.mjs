// Проверка HTML-виджетов Telegram по правилам платформы (core.telegram.org/bots/widgets).
// Запуск: npm run test:widgets  (Node 24 читает .ts напрямую, поэтому модуль widget-html.ts без импортов).
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { deflateSync } from 'node:zlib';
import { DASHBOARD_HTML, WELCOME_HTML, WIDGET_DATA_LIMIT, STATUS_ORDER, encodeDashboard } from '../src/lib/crm/widget-html.ts';

const bytes = (text) => Buffer.byteLength(text, 'utf8');
const widgets = { 'сводка': DASHBOARD_HTML, 'приветствие': WELCOME_HTML };

// Конструкции, которые клиенты Telegram вырезают или запрещают в профиле 1.
const forbidden = [
  [/<(input|select|textarea|progress|meter|dialog|audio|video|iframe|object|embed|link|meta|template|math)\b/i, 'запрещённый HTML-элемент'],
  [/<script[^>]*\ssrc=/i, 'внешний скрипт'],
  [/\b(fetch|XMLHttpRequest|WebSocket|EventSource)\b/, 'сетевой API'],
  [/\b(alert|confirm|prompt)\s*\(/, 'диалоги браузера'],
  [/\b(location|history)\./, 'навигация'],
  [/\d\s*(vh|dvh|svh|lvh)\b/i, 'единицы высоты vh'],
  [/position\s*:\s*sticky/i, 'position: sticky'],
  [/overflow(-[xy])?\s*:\s*(auto|scroll)/i, 'прокрутка внутри виджета'],
  [/text-shadow|clip-path|mix-blend-mode|writing-mode|@font-face|@import|@container|@layer|@property/i, 'запрещённое свойство CSS'],
  [/:has\(|:focus|:target/i, 'запрещённый селектор'],
  [/url\(\s*['"]?(?!data:)/i, 'внешний URL в CSS'],
  [/<img[^>]*\ssrc=['"](?!data:)/i, 'внешняя картинка'],
  [/touchstart|keydown|keyup|wheel/i, 'запрещённые события'],
  [/\u0000/, 'символ NUL'],
];

for (const [name, html] of Object.entries(widgets)) {
  assert.ok(bytes(html) > 0 && bytes(html) <= 32768, `${name}: HTML ${bytes(html)} байт, лимит 32768`);
  const packed = deflateSync(Buffer.from(html), { level: 9 }).length;
  assert.ok(packed <= 4096, `${name}: после сжатия ${packed} байт, лимит 4096`);
  for (const [pattern, what] of forbidden) assert.ok(!pattern.test(html), `${name}: ${what}`);
  // Скрипт должен хотя бы компилироваться: синтаксическая ошибка остановила бы виджет в чате.
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  assert.ok(script, `${name}: нет скрипта`);
  assert.doesNotThrow(() => new Script(script), `${name}: ошибка синтаксиса в скрипте`);
  console.log(`  ok   ${name}: ${bytes(html)} байт, после сжатия ${packed}`);
}

// Данные виджета укладываются в лимит chat_data даже с самыми длинными именами.
const long = 'Ж'.repeat(60); // 2 байта на символ в UTF-8
const state = { counts: [999, 999, 999, 999, 999, 999], today: 99, week: 999, reminders: 99, updated: '31.12 23:59',
  leads: Array.from({ length: 8 }, (_, i) => ({ id: 100000 + i, name: long, status: 5 })) };
const encoded = encodeDashboard(state);
assert.ok(bytes(encoded) <= WIDGET_DATA_LIMIT, `данные ${bytes(encoded)} байт, лимит ${WIDGET_DATA_LIMIT}`);
const parsed = JSON.parse(encoded);
assert.equal(parsed.n.length, STATUS_ORDER.length);
assert.ok(parsed.l.length >= 1 && parsed.l.every((row) => Array.from(row[1]).length <= 14), 'имена обрезаны до 14 символов');
assert.equal(JSON.parse(encodeDashboard({ ...state, leads: [] })).l.length, 0);
// Эмодзи и составные символы не должны ломать обрезку.
assert.doesNotThrow(() => JSON.parse(encodeDashboard({ ...state, leads: [{ id: 1, name: '👨‍👩‍👧‍👦'.repeat(10), status: 0 }] })));
console.log('  ok   данные виджета: ' + bytes(encoded) + ' байт при лимите 1024');
console.log('Виджеты: все проверки пройдены.');
