import "server-only";

import type { DatabaseSync } from "node:sqlite";
import { adminIds, ensureConfigured, telegram, TelegramApiError, type TelegramMessage } from "./telegram";
import { transaction } from "./db";

type Job = { id: number; chat_id: string; payload: string; attempts: number; reminder_id: number | null; audience: string };

export function enqueue(db: DatabaseSync, key: string, message: TelegramMessage, availableAt = Date.now(), reminderId?: number, audience: "admin" | "client" = "admin") {
  db.prepare("INSERT INTO outbox (job_key, chat_id, payload, available_at, reminder_id, audience) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(job_key) DO NOTHING")
    .run(key, message.chat_id, JSON.stringify(message), availableAt, reminderId ?? null, audience);
}

/** Копия сообщения без служебных полей очереди (их Telegram не принимает). */
function without(message: TelegramMessage, ...keys: (keyof TelegramMessage)[]): TelegramMessage {
  const copy = { ...message };
  for (const key of keys) delete copy[key];
  return copy;
}

/** Чем заменить сообщение, если Telegram отклонил его метод. null — заменять нечем. */
function downgrade(message: TelegramMessage): TelegramMessage | null {
  if (message.fallback) return message.fallback;
  // Правку нельзя применить (сообщение удалено или слишком старое) — показываем то же содержимое новым сообщением.
  if (message.method === "editMessageText") return without(message, "method", "message_id", "fallback");
  return null;
}

export async function drainQueue(limit = 20) {
  // A missing configuration must not cancel queued messages as revoked users.
  ensureConfigured();
  let sent = 0; let failed = 0;
  for (let i = 0; i < limit; i++) {
    const now = Date.now();
    const job = transaction((db) => db.prepare(`UPDATE outbox SET state = 'sending', lease_until = ?, attempts = attempts + 1
      WHERE id = (SELECT id FROM outbox WHERE (state = 'pending' AND available_at <= ?) OR (state = 'sending' AND lease_until <= ?) ORDER BY available_at, id LIMIT 1)
      RETURNING id, chat_id, payload, attempts, reminder_id, audience`).get(now + 60_000, now, now) as Job | undefined);
    if (!job) break;
    if (job.audience !== "client" && !adminIds().includes(job.chat_id)) {
      transaction((db) => { db.prepare("UPDATE outbox SET state='cancelled', lease_until=NULL WHERE id=?").run(job.id); if (job.reminder_id) db.prepare("UPDATE reminders SET status='cancelled' WHERE id=? AND status='pending'").run(job.reminder_id); });
      continue;
    }
    const message = JSON.parse(job.payload) as TelegramMessage;
    const method = message.method ?? "sendMessage";
    const payload = without(message, "method", "fallback");
    const markSent = () => transaction((db) => {
      db.prepare("UPDATE outbox SET state='sent', sent_at=?, lease_until=NULL WHERE id=?").run(Date.now(), job.id);
      if (job.reminder_id) db.prepare("UPDATE reminders SET status='sent' WHERE id=? AND status='pending'").run(job.reminder_id);
    });
    try {
      await telegram(method, payload);
      markSent();
      sent++;
    } catch (error) {
      const api = error instanceof TelegramApiError ? error : null;
      // Правка, которая ничего не меняет (например, повторное «Обновить»), — не ошибка.
      if (api?.notModified) { markSent(); sent++; continue; }
      // Обычное сообщение при сбое повторяем (см. ниже). А вот отказ 400 для правок и виджетов постоянный:
      // повтор не поможет, поэтому подставляем запасное сообщение или закрываем задачу.
      if (api?.status === 400 && method !== "sendMessage") {
        const next = downgrade(message);
        transaction((db) => next
          ? db.prepare("UPDATE outbox SET payload=?, state='pending', available_at=?, lease_until=NULL WHERE id=? AND state='sending'").run(JSON.stringify(next), Date.now(), job.id)
          : db.prepare("UPDATE outbox SET state='cancelled', lease_until=NULL WHERE id=?").run(job.id));
        continue;
      }
      const delay = Math.min(60 * 60_000, 30_000 * 2 ** Math.min(job.attempts - 1, 7));
      transaction((db) => db.prepare("UPDATE outbox SET state='pending', available_at=?, lease_until=NULL WHERE id=? AND state='sending'").run(Date.now() + delay, job.id));
      failed++;
    }
  }
  return { sent, failed };
}
