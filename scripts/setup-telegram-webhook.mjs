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
try {
  const existing = await call('getWebhookInfo', {});
  if (existing.url && existing.url !== webhook && !process.argv.includes('--replace')) {
    console.error('У бота уже настроен другой webhook. Проверьте его вручную и при необходимости повторите команду с --replace.'); process.exit(1);
  }
  await call('setWebhook', { url:webhook, secret_token:secret, allowed_updates:['message','callback_query'], drop_pending_updates:false });
  console.log('Webhook Telegram подключён. Напишите боту /start в личном чате.');
} catch { console.error('Не удалось подключить webhook. Проверьте настройки, HTTPS и доступ к Telegram.'); process.exit(1); }
