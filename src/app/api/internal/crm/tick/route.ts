import { after } from "next/server";

import { ensureScheduledBackup } from "@/lib/crm/backup";
import { database, housekeeping } from "@/lib/crm/db";
import { drainQueue } from "@/lib/crm/queue";
import { equalSecret } from "@/lib/crm/telegram";
import { warmImagesOnce } from "@/lib/warm-images";

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
    // После запуска (и выпуска новой версии) кэш картинок пуст — один раз в фоне готовим его, пока посетителей мало.
    after(async () => {
      const warm = await warmImagesOnce(process.env.CRM_INTERNAL_URL ?? "http://127.0.0.1:3000");
      if (warm) console.info(`[images] Прогрето ${warm.warmed} из ${warm.images} картинок (страниц: ${warm.pages}, ошибок: ${warm.failed}) за ${Math.round(warm.ms / 1000)} с`);
    });
    return Response.json({ ok: true, ...result, backupFailed });
  } catch {
    console.error("[crm] Queue worker failed");
    return Response.json({ ok: false }, { status: 503 });
  }
}
