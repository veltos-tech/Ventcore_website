// Подмена Telegram Bot API для тестов бота (scripts/test-bot.mjs): подключается через NODE_OPTIONS=--require.
// Каждый вызов api.telegram.org записывается в файл MOCK_TELEGRAM_LOG, наружу ничего не уходит.
// Файл MOCK_TELEGRAM_CONTROL (JSON) читается при каждом вызове и позволяет «ломать» методы:
//   { "sendWidget": { "status": 400, "description": "Bad Request: method not found" }, "notSubscribed": [333] }
const fs = process.getBuiltinModule('node:fs');

const logFile = process.env.MOCK_TELEGRAM_LOG;
const controlFile = process.env.MOCK_TELEGRAM_CONTROL;
const realFetch = globalThis.fetch;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const match = /^https:\/\/api\.telegram\.org\/bot[^/]+\/(\w+)$/.exec(url);
  if (!match || !logFile) return realFetch(input, init);
  const method = match[1];
  const payload = JSON.parse(typeof init?.body === 'string' ? init.body : '{}');
  let control = {};
  try { control = JSON.parse(fs.readFileSync(controlFile, 'utf8')); } catch { /* правил нет */ }
  fs.appendFileSync(logFile, JSON.stringify({ method, payload }) + '\n');
  if (method === 'getChatMember') {
    const left = Array.isArray(control.notSubscribed) && control.notSubscribed.includes(payload.user_id);
    return json(200, { ok: true, result: { status: left ? 'left' : 'member' } });
  }
  const rule = control[method];
  if (rule) return json(rule.status, { ok: false, error_code: rule.status, description: rule.description });
  return json(200, { ok: true, result: true });
};
