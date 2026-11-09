import { drainQueue } from "@/lib/crm/queue";
import { processUpdate } from "@/lib/crm/service";
import { adminIds, equalSecret, isChannelSubscriber, telegram } from "@/lib/crm/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readBody(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 65_536) throw new Error("too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 65_536) { await reader.cancel(); throw new Error("too large"); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Parameters<typeof processUpdate>[0];
}

export async function POST(request: Request) {
  if (!equalSecret(request.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  let update: Parameters<typeof processUpdate>[0];
  try { update = await readBody(request); } catch { return Response.json({ ok: false }, { status: 400 }); }
  if (!update || typeof update !== "object") return Response.json({ ok: false }, { status: 400 });
  try {
    // Клиентам перед заявкой и связью с менеджером нужна подписка на канал; администраторов не проверяем.
    const userId = update.callback_query?.from?.id ?? update.message?.from?.id;
    const needsCheck = Number.isSafeInteger(userId) && !adminIds().includes(String(userId));
    const subscribed = needsCheck ? await isChannelSubscriber(String(userId)) : true;
    const result = processUpdate(update, { subscribed });
    const operations: Promise<unknown>[] = [];
    if (typeof result.callbackId === "string" && result.callbackId.length <= 256) operations.push(telegram("answerCallbackQuery", { callback_query_id: result.callbackId, ...(result.accepted ? {} : { text: "Доступ закрыт" }) }));
    // One action can notify multiple admins and acknowledge the client.
    if (result.accepted) operations.push(drainQueue(25));
    await Promise.allSettled(operations);
    return Response.json({ ok: true });
  } catch {
    console.error("[crm] Could not process Telegram update");
    return Response.json({ ok: false }, { status: 503 });
  }
}
