import "server-only";

import { timingSafeEqual } from "node:crypto";

// Кнопка бывает либо «действием» (callback_data), либо ссылкой (url)
export type Button = { text: string } & ({ callback_data: string } | { url: string });

/** Постоянная клавиатура внизу экрана (кнопки отправляют свой текст как сообщение). */
export type ReplyKeyboard = { keyboard: { text: string }[][]; resize_keyboard: true; is_persistent: true; input_field_placeholder?: string };
export type ReplyMarkup = { inline_keyboard: Button[][] } | ReplyKeyboard | { remove_keyboard: true };

/** Методы Bot API, которые отправляет очередь. Без method — обычное sendMessage. */
export type OutboxMethod = "sendMessage" | "editMessageText" | "editMessageCaption" | "sendWidget" | "editMessageWidgetData";

export type TelegramMessage = {
  chat_id: string;
  text?: string;
  parse_mode?: "HTML";
  reply_markup?: ReplyMarkup;
  method?: OutboxMethod;
  /** Для editMessage*: какое сообщение править. */
  message_id?: number;
  /** Если Telegram отклонил метод (например, виджеты не поддерживаются), очередь отправит это сообщение вместо него. */
  fallback?: TelegramMessage;
  // Виджеты (sendWidget / editMessageWidgetData)
  html?: string;
  caption?: string;
  chat_data?: string;
  allow_queries?: boolean;
  width?: number;
  height?: number;
};

export function adminIds() {
  const ids = (process.env.TELEGRAM_ADMIN_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  if (ids.length > 20 || ids.some((id) => !/^[1-9]\d{0,15}$/.test(id))) throw new Error("Invalid TELEGRAM_ADMIN_IDS");
  return [...new Set(ids)];
}

export function ensureConfigured() {
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim() || adminIds().length === 0) throw new Error("CRM bot is not configured");
}

/** Канал, на который клиент должен подписаться. Можно указать @username или числовой id (-100…). */
const channelChatId = () => process.env.TELEGRAM_CHANNEL_ID?.trim() || "@ventcoreblog";

const subscribed = new Map<string, number>(); // userId → до какого момента доверяем подписке

/**
 * Подписан ли пользователь на канал. Бот должен быть администратором канала.
 * Подписку запоминаем на 10 минут. Если проверить не удалось (бот не админ,
 * Telegram недоступен), пользователя НЕ блокируем, а пишем предупреждение в лог.
 */
export async function isChannelSubscriber(userId: string) {
  if ((subscribed.get(userId) ?? 0) > Date.now()) return true;
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token || !/^[1-9]\d{0,15}$/.test(userId)) return true;
  try {
    // Адрес запроса и ответ не логируем: в них токен и персональные данные.
    const response = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: channelChatId(), user_id: Number(userId) }),
      signal: AbortSignal.timeout(5000), cache: "no-store",
    });
    const body = await response.json() as { ok?: boolean; result?: { status?: string; is_member?: boolean } };
    if (!body.ok || !body.result?.status) throw new Error("getChatMember rejected");
    const { status, is_member } = body.result;
    const member = status === "creator" || status === "administrator" || status === "member" || (status === "restricted" && is_member === true);
    if (member) {
      if (subscribed.size > 5000) subscribed.clear();
      subscribed.set(userId, Date.now() + 10 * 60_000);
    }
    return member;
  } catch {
    console.error("[crm] Не удалось проверить подписку на канал: проверьте TELEGRAM_CHANNEL_ID и права бота в канале");
    return true;
  }
}

export function equalSecret(given: string | null, expected: string | undefined) {
  if (!given || !expected || expected.length < 32) return false;
  const a = Buffer.from(given); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Ошибка Bot API. Код и описание нужны очереди для решения «повторить / заменить»; наружу и в лог не выводятся. */
export class TelegramApiError extends Error {
  constructor(readonly status: number, readonly description: string) {
    super(`Telegram API returned HTTP ${status}`);
  }
  /** «message is not modified»: правка ничего не меняет — для очереди это успех. */
  get notModified() { return /message is not modified/i.test(this.description); }
}

export type ApiMethod = OutboxMethod | "answerCallbackQuery" | "answerWidgetQuery";

export async function telegram(method: ApiMethod, payload: object) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("Telegram bot token is missing");
  // Never log the request URL or response body: both can contain secrets or personal data.
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(5000), cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as { ok?: boolean; description?: unknown };
  if (!response.ok || !body.ok) throw new TelegramApiError(response.status, typeof body.description === "string" ? body.description.slice(0, 200) : "");
}
