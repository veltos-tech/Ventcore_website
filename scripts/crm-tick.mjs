const secret = process.env.CRM_CRON_SECRET;
let base;
try { base = new URL(process.env.CRM_INTERNAL_URL ?? 'http://127.0.0.1:3000'); } catch { console.error('Invalid CRM_INTERNAL_URL'); process.exit(1); }
if (base.protocol !== 'http:' || !['127.0.0.1','localhost','[::1]'].includes(base.hostname) || base.username || base.password || base.pathname !== '/' || base.search || base.hash || !secret || secret.length < 32) {
  console.error('CRM worker requires a loopback HTTP origin and a CRM_CRON_SECRET of at least 32 characters.'); process.exit(1);
}
try {
  const response = await fetch(new URL('/api/internal/crm/tick', base), {method:'POST',headers:{authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(120000)});
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = await response.json();
  if (result.failed) { console.error(`CRM: ${result.failed} messages delayed for retry`); process.exitCode=1; }
  if (result.backupFailed) { console.error('CRM: резервная копия базы не создана — проверьте журнал сервера и свободное место на диске'); process.exitCode=1; }
} catch { console.error('CRM worker could not process the queue'); process.exitCode=1; }
