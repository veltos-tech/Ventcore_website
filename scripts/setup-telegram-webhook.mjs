// Run with Node --env-file=/path/to/server.env. Never print the token or secret.
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const webhook = process.env.TELEGRAM_WEBHOOK_URL?.trim();
if (!token || !secret || !webhook || !/^[A-Za-z0-9_-]{32,256}$/.test(secret)) {
  console.error('Укажите TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_URL и TELEGRAM_WEBHOOK_SECRET (32–256 допустимых символов).'); process.exit(1);
}
let parsed;
try { parsed = new URL(webhook); } catch { console.error('Некорректный TELEGRAM_WEBHOOK_URL.'); process.exit(1); }
if (parsed.protocol !== 'https:' || parsed.pathname !== '/api/telegram/webhook' || parsed.username || parsed.password || parsed.search || parsed.hash) {
  console.error('Нужен HTTPS-адрес сайта с путём /api/telegram/webhook без дополнительных параметров.'); process.exit(1);
}
async function call(method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload), signal:AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
  const result = await response.json();
  if (!result.ok) throw new Error('Telegram отклонил запрос');
  return result.result;
}
// Команды в меню рядом с полем ввода. Клиенты видят короткий список, администраторы — полный (только в своём личном чате).
const clientCommands = [
  { command: 'start', description: 'Главное меню' },
  { command: 'request', description: 'Оставить заявку' },
  { command: 'manager', description: 'Связаться с менеджером' },
  { command: 'cancel', description: 'Отменить ввод' },
];
const adminCommands = [
  { command: 'start', description: 'Меню и кнопки быстрого доступа' },
  { command: 'dashboard', description: 'Сводка-виджет' },
  { command: 'leads', description: 'Заявки с фильтром по статусам' },
  { command: 'search', description: 'Поиск по имени или телефону' },
  { command: 'reminders', description: 'Мои напоминания' },
  { command: 'orders', description: 'Заказы' },
  { command: 'request', description: 'Добавить заявку вручную' },
  { command: 'help', description: 'Справка' },
  { command: 'cancel', description: 'Отменить ввод' },
];
const admins = (process.env.TELEGRAM_ADMIN_IDS ?? '').split(',').map((id) => id.trim()).filter((id) => /^[1-9]\d{0,15}$/.test(id)).slice(0, 20);

try {
  const existing = await call('getWebhookInfo', {});
  if (existing.url && existing.url !== webhook && !process.argv.includes('--replace')) {
    console.error('У бота уже настроен другой webhook. Проверьте его вручную и при необходимости повторите команду с --replace.'); process.exit(1);
  }
  // widget_query — нажатия внутри HTML-виджетов (Bot API 10.4); без него кнопки в виджетах не работают.
  await call('setWebhook', { url:webhook, secret_token:secret, allowed_updates:['message','callback_query','widget_query'], drop_pending_updates:false });
  console.log('Webhook Telegram подключён (сообщения, кнопки и виджеты).');
} catch { console.error('Не удалось подключить webhook. Проверьте настройки, HTTPS и доступ к Telegram.'); process.exit(1); }

// Команды и кнопка меню — необязательная часть: при сбое сайт и бот работают, просто без подсказок в меню.
try {
  await call('setMyCommands', { commands: clientCommands });
  for (const id of admins) await call('setMyCommands', { commands: adminCommands, scope: { type: 'chat', chat_id: Number(id) } });
  await call('setChatMenuButton', { menu_button: { type: 'commands' } });
  console.log(`Команды меню обновлены (клиентам и ${admins.length} администраторам).`);
} catch { console.warn('Команды меню обновить не удалось — повторите запуск позже; на работу бота это не влияет.'); }
console.log('Напишите боту /start в личном чате: администраторам при этом включатся кнопки быстрого доступа.');
