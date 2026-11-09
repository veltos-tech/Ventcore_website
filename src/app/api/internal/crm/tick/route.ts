import { ensureScheduledBackup } from "@/lib/crm/backup";
import { database, housekeeping } from "@/lib/crm/db";
import { drainQueue } from "@/lib/crm/queue";
import { equalSecret } from "@/lib/crm/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
  if (!equalSecret(token, process.env.CRM_CRON_SECRET)) return Response.json({ ok: false }, { status: 401 });
  try {
    const result = await drainQueue(20);
    // Уборка и плановая резервная копия не должны мешать отправке уведомлений,
    // но сбой копирования нельзя замалчивать: он отражается в ответе и в коде выхода таймера.
    let backupFailed = false;
    try { housekeeping(); ensureScheduledBackup(database()); } catch { backupFailed = true; console.error("[crm] Резервное копирование или уборка базы не выполнены"); }
    return Response.json({ ok: true, ...result, backupFailed });
  } catch {
    console.error("[crm] Queue worker failed");
    return Response.json({ ok: false }, { status: 503 });
  }
}
