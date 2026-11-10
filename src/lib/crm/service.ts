import "server-only";

import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { transaction, type LeadRow, type OrderRow, type ReminderRow } from "./db";
import { enqueue } from "./queue";
import { site } from "@/content/site";
import { adminIds, ensureConfigured, type Button, type ReplyKeyboard, type ReplyMarkup, type TelegramMessage } from "./telegram";
import { DASHBOARD_HTML, STATUS_ORDER, WELCOME_HTML, encodeDashboard, type DashboardState } from "./widget-html";

export const LEAD_STATUSES: Record<string, string> = { new: "Новая", contacted: "Связались", in_progress: "В работе", proposal: "Предложение", won: "Успешно", lost: "Отказ" };
export const ORDER_STATUSES: Record<string, string> = { new: "Новый", in_progress: "В работе", completed: "Выполнен", cancelled: "Отменён" };
const STATUS_EMOJI: Record<string, string> = { new: "🆕", contacted: "📞", in_progress: "🔧", proposal: "📄", won: "✅", lost: "❌" };
const MSK = 3 * 3600_000;
const DAY = 86400_000;

const formatDate = (value: number) => new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Moscow" }).format(new Date(value));
const formatDay = (value: number) => new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "Europe/Moscow" }).format(new Date(value));
const formatStamp = (value: number) => new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" }).format(new Date(value)).replace(",", "");
const startOfMoscowDay = (now: number) => Math.floor((now + MSK) / DAY) * DAY - MSK;
/** Всё, что пользователь ввёл сам (имена, заметки), экранируется перед вставкой в HTML-сообщение. */
const esc = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const button = (text: string, data: string): Button => ({ text, callback_data: data });
const urlButton = (text: string, url: string): Button => ({ text, url });
const getLead = (db: DatabaseSync, id: number) => db.prepare("SELECT * FROM leads WHERE id=?").get(id) as LeadRow | undefined;
const getOrder = (db: DatabaseSync, id: number) => db.prepare("SELECT * FROM orders WHERE id=?").get(id) as OrderRow | undefined;

// ── Клавиатуры внизу экрана ──────────────────────────────────────────────
// Нажатие кнопки отправляет её текст сообщением. Ниже текст сопоставляется с командой, поэтому кнопки
// работают и посреди ввода заметки или заявки: не становятся её текстом, а прерывают ввод.
export const ADMIN_KEYBOARD: ReplyKeyboard = {
  keyboard: [[{ text: "📊 Сводка" }, { text: "📋 Заявки" }], [{ text: "🔎 Поиск" }, { text: "⏰ Напоминания" }], [{ text: "📦 Заказы" }, { text: "➕ Новая заявка" }]],
  resize_keyboard: true, is_persistent: true, input_field_placeholder: "Выберите действие кнопкой ниже",
};
const ADMIN_LABELS: Record<string, string> = { "📊 Сводка": "/dashboard", "📋 Заявки": "/leads", "🔎 Поиск": "/search", "⏰ Напоминания": "/reminders", "📦 Заказы": "/orders", "➕ Новая заявка": "/request" };
export const CLIENT_KEYBOARD: ReplyKeyboard = {
  keyboard: [[{ text: "📝 Оставить заявку" }], [{ text: "💬 Связаться с менеджером" }]],
  resize_keyboard: true, is_persistent: true, input_field_placeholder: "Выберите действие кнопкой ниже",
};
const CLIENT_LABELS: Record<string, string> = { "📝 Оставить заявку": "/request", "💬 Связаться с менеджером": "/manager" };
/** Команды администратора: они прерывают заполнение заявки, начатое в этом же чате. */
const ADMIN_COMMAND = /^\/(start|help|crm|menu|dashboard|leads|search|orders|reminders)(?:@\w+)?(?:\s|$)/u;

// ── Сводка ───────────────────────────────────────────────────────────────
function stats(db: DatabaseSync, admin: string, now = Date.now()) {
  const rows = db.prepare("SELECT status, count(*) AS c FROM leads GROUP BY status").all() as { status: string; c: number }[];
  const counts = STATUS_ORDER.map((key) => rows.find((row) => row.status === key)?.c ?? 0);
  const one = (sql: string, ...args: (string | number)[]) => (db.prepare(sql).get(...args) as { c: number }).c;
  const today = one("SELECT count(*) AS c FROM leads WHERE created_at >= ?", startOfMoscowDay(now));
  const week = one("SELECT count(*) AS c FROM leads WHERE created_at >= ?", now - 7 * DAY);
  const reminders = one("SELECT count(*) AS c FROM reminders WHERE admin_id=? AND status='pending'", admin);
  const remindersToday = one("SELECT count(*) AS c FROM reminders WHERE admin_id=? AND status='pending' AND due_at < ?", admin, startOfMoscowDay(now) + DAY);
  const recent = db.prepare("SELECT id, name, status FROM leads ORDER BY id DESC LIMIT 5").all() as { id: number; name: string; status: string }[];
  const state: DashboardState = { counts, today, week, reminders: remindersToday, updated: formatStamp(now),
    leads: recent.map((lead) => ({ id: lead.id, name: lead.name, status: Math.max(0, STATUS_ORDER.indexOf(lead.status as (typeof STATUS_ORDER)[number])) })) };
  return { counts, today, week, reminders, remindersToday, state };
}

/** Главное меню администратора: сводка и быстрые переходы со счётчиками. */
function homeMessage(db: DatabaseSync, chat: string, intro = ""): TelegramMessage {
  const s = stats(db, chat);
  const count = (value: number) => (value ? ` · ${value}` : "");
  const text = [
    intro,
    "<b>VentCore · сводка</b>",
    `🆕 Новых: <b>${s.counts[0]}</b>  ·  🔧 В работе: <b>${s.counts[2]}</b>`,
    `📥 Сегодня: <b>${s.today}</b>  ·  за 7 дней: <b>${s.week}</b>`,
    s.reminders ? `⏰ Напоминаний: <b>${s.reminders}</b>${s.remindersToday ? ` (на сегодня — ${s.remindersToday})` : ""}` : "",
  ].filter(Boolean).join("\n");
  return { chat_id: chat, text, parse_mode: "HTML", reply_markup: { inline_keyboard: [
    [button(`🆕 Новые${count(s.counts[0])}`, "ls:new:0"), button(`🔧 В работе${count(s.counts[2])}`, "ls:in_progress:0")],
    [button("📋 Все заявки", "ls:all:0"), button("🔎 Поиск", "menu:search")],
    [button(`⏰ Напоминания${count(s.reminders)}`, "menu:reminders"), button("📦 Заказы", "menu:orders")],
    [button("📊 Сводка-виджет", "menu:dashboard"), button("❔ Помощь", "menu:help")],
  ] } };
}

const DASH_KEYBOARD: Button[][] = [[button("🔄 Обновить", "dash:refresh")], [button("📋 Заявки", "ls:all:0"), button("🏠 Меню", "menu:home")]];

function dashboardCaption(s: ReturnType<typeof stats>) {
  return [`Заявки на ${s.state.updated} (МСК)`, `🆕 Новых: ${s.counts[0]} · 🔧 В работе: ${s.counts[2]}`, `📥 Сегодня: ${s.today} · за 7 дней: ${s.week}`, `⏰ Напоминаний на сегодня: ${s.remindersToday}`].join("\n");
}

/** HTML-виджет со сводкой. Если Telegram его не принял (старое приложение) — вместо него приходит обычная сводка. */
function dashboardMessage(db: DatabaseSync, chat: string): TelegramMessage {
  const s = stats(db, chat);
  return { method: "sendWidget", chat_id: chat, html: DASHBOARD_HTML, chat_data: encodeDashboard(s.state), allow_queries: true,
    caption: dashboardCaption(s), reply_markup: { inline_keyboard: DASH_KEYBOARD }, fallback: homeMessage(db, chat) };
}

const HELP_TEXT = [
  "<b>VentCore · мини-CRM</b>",
  "",
  "Кнопки внизу экрана — быстрый доступ к разделам. Если их нет, отправьте /start.",
  "",
  "<b>Статусы заявок:</b> 🆕 новая · 📞 связались · 🔧 в работе · 📄 предложение · ✅ успешно · ❌ отказ",
  "",
  "<b>Команды</b>",
  "/dashboard — сводка-виджет",
  "/leads — заявки с фильтром по статусам",
  "/search — поиск по имени или телефону",
  "/orders — последние заказы",
  "/reminders — ваши напоминания",
  "/request — добавить заявку вручную",
  "/cancel — отменить ввод",
  "",
  "В карточке заявки статус меняется одним нажатием, а заметку, заказ и напоминание можно добавить кнопками.",
].join("\n");

// ── Карточки и списки ────────────────────────────────────────────────────
const FLOW = ["new", "contacted", "in_progress", "proposal", "won"];
const QUICK_LABELS: Record<string, string> = { contacted: "📞 Связались", in_progress: "🔧 В работу", proposal: "📄 Предложение", won: "✅ Успешно", lost: "❌ Отказ" };

/** Кнопки быстрой смены статуса: следующие шаги воронки и «Отказ»; закрытую заявку можно вернуть в работу. */
function quickStatusButtons(id: number, status: string): Button[] {
  if (status === "won" || status === "lost") return [button("🔁 Вернуть в работу", `s:${id}:in_progress`)];
  const next = FLOW.slice(FLOW.indexOf(status) + 1, FLOW.indexOf(status) + 3);
  return [...next, "lost"].map((key) => button(QUICK_LABELS[key], `s:${id}:${key}`));
}

function leadCard(db: DatabaseSync, chat: string, id: number): TelegramMessage {
  const lead = getLead(db, id);
  if (!lead) return { chat_id: chat, text: "Заявка не найдена." };
  const orders = db.prepare("SELECT * FROM orders WHERE lead_id=? ORDER BY id DESC LIMIT 3").all(id) as OrderRow[];
  const notes = db.prepare("SELECT text, created_at FROM notes WHERE lead_id=? ORDER BY id DESC LIMIT 3").all(id) as { text: string; created_at: number }[];
  const reminders = db.prepare("SELECT * FROM reminders WHERE lead_id=? AND status='pending' ORDER BY due_at LIMIT 3").all(id) as ReminderRow[];
  const text = [
    `<b>Заявка #${lead.id}</b> · ${STATUS_EMOJI[lead.status] ?? ""} ${LEAD_STATUSES[lead.status] ?? esc(lead.status)}`,
    `👤 ${esc(lead.name)}`, `📞 ${esc(lead.phone)}`, lead.email ? `✉️ ${esc(lead.email)}` : "",
    `🕒 ${formatDate(lead.created_at)} (МСК)`,
    orders.length ? `\n<b>Заказы</b>\n${orders.map((o) => `#${o.id} ${esc(o.title)} — ${ORDER_STATUSES[o.status]}${o.amount === null ? "" : ` · ${o.amount.toLocaleString("ru-RU")} ₽`}`).join("\n")}` : "",
    reminders.length ? `\n<b>Напоминания</b>\n${reminders.map((r) => `#${r.id} ${formatDate(r.due_at)} МСК — ${esc(r.text)}`).join("\n")}` : "",
    notes.length ? `\n<b>Заметки</b>\n${notes.map((n) => `${formatDate(n.created_at)} — ${esc(n.text)}`).join("\n")}` : "",
  ].filter(Boolean).join("\n");
  return { chat_id: chat, text, parse_mode: "HTML", reply_markup: { inline_keyboard: [
    quickStatusButtons(id, lead.status),
    [button("📝 Заметка", `note:${id}`), button("📦 Заказ", `order:${id}`), button("⏰ Напомнить", `remind:${id}`)],
    [button("🗒 История заметок", `history:${id}:0`), button("⚙️ Все статусы", `status:${id}`)],
    ...orders.slice(0, 3).map((o) => [button(`Заказ #${o.id}: ${ORDER_STATUSES[o.status]}`, `ordercard:${o.id}`)]),
    ...reminders.slice(0, 3).map((r) => [button(`Отменить напоминание #${r.id}`, `cancelrem:${r.id}`)]),
    [button("← К списку", "ls:all:0"), button("🏠 Меню", "menu:home")],
  ] } };
}

function noteHistory(db: DatabaseSync, chat: string, leadId: number, offset: number): TelegramMessage {
  if (!getLead(db, leadId)) return { chat_id: chat, text: "Заявка не найдена." };
  const safeOffset = Math.max(0, Math.min(offset, 100000));
  const rows = db.prepare("SELECT text, created_at FROM notes WHERE lead_id=? ORDER BY id DESC LIMIT 6 OFFSET ?").all(leadId, safeOffset) as { text: string; created_at: number }[];
  const visible = rows.slice(0, 5);
  const navigation: Button[] = [];
  if (safeOffset > 0) navigation.push(button("← Назад", `history:${leadId}:${Math.max(0, safeOffset - 5)}`));
  if (rows.length > 5) navigation.push(button("Далее →", `history:${leadId}:${safeOffset + 5}`));
  return { chat_id: chat, parse_mode: "HTML",
    text: visible.length ? `<b>Заметки к заявке #${leadId}</b>\n\n${visible.map((note) => `${formatDate(note.created_at)} МСК\n${esc(note.text)}`).join("\n\n")}` : `У заявки #${leadId} пока нет заметок.`,
    reply_markup: { inline_keyboard: [...(navigation.length ? [navigation] : []), [button("← К заявке", `lead:${leadId}`)]] } };
}

/** Список заявок с фильтром по статусу (чипы со счётчиками) или результаты поиска. */
function listLeads(db: DatabaseSync, chat: string, options: { status?: string; search?: string; offset?: number } = {}): TelegramMessage {
  const offset = Math.max(0, Math.min(options.offset ?? 0, 100000));
  const search = options.search ?? "";
  const status = options.status && Object.hasOwn(LEAD_STATUSES, options.status) ? options.status : "";
  const normalized = search.toLocaleLowerCase("ru-RU");
  const digits = search.replace(/\D/g, "");
  const rows = search
    ? db.prepare("SELECT * FROM leads WHERE instr(crm_lower(name), ?) > 0 OR instr(crm_lower(phone), ?) > 0 OR (? <> '' AND instr(crm_digits(phone), ?) > 0) ORDER BY id DESC LIMIT 11 OFFSET ?").all(normalized, normalized, digits, digits, offset) as LeadRow[]
    : status
      ? db.prepare("SELECT * FROM leads WHERE status=? ORDER BY id DESC LIMIT 11 OFFSET ?").all(status, offset) as LeadRow[]
      : db.prepare("SELECT * FROM leads ORDER BY id DESC LIMIT 11 OFFSET ?").all(offset) as LeadRow[];
  const visible = rows.slice(0, 10);
  const buttons: Button[][] = [];
  if (!search) {
    const grouped = db.prepare("SELECT status, count(*) AS c FROM leads GROUP BY status").all() as { status: string; c: number }[];
    const counts = new Map(grouped.map((row) => [row.status, row.c]));
    const total = grouped.reduce((sum, row) => sum + row.c, 0);
    const chip = (key: string, label: string, count: number) => button(`${(status || "all") === key ? "▸" : ""}${label} ${count}`, `ls:${key}:0`);
    const chips = [chip("all", "Все", total), ...STATUS_ORDER.map((key) => chip(key, STATUS_EMOJI[key], counts.get(key) ?? 0))];
    buttons.push(chips.slice(0, 4), chips.slice(4));
  }
  for (const lead of visible) buttons.push([button(`${STATUS_EMOJI[lead.status] ?? ""} #${lead.id} ${lead.name.slice(0, 24)} · ${formatDay(lead.created_at)}`, `lead:${lead.id}`)]);
  if (!search) {
    const key = status || "all";
    const navigation: Button[] = [];
    if (offset > 0) navigation.push(button("← Назад", `ls:${key}:${Math.max(0, offset - 10)}`));
    if (rows.length > 10) navigation.push(button("Далее →", `ls:${key}:${offset + 10}`));
    if (navigation.length) buttons.push(navigation);
  }
  buttons.push([button("🏠 Меню", "menu:home")]);
  const title = search ? `Поиск: ${esc(search)}\nНайдено: ${visible.length}${rows.length > 10 ? "+" : ""}`
    : `<b>Заявки</b>${status ? ` · ${STATUS_EMOJI[status]} ${LEAD_STATUSES[status]}` : ""}${visible.length ? ` · ${offset + 1}–${offset + visible.length}` : " · пока нет"}`;
  return { chat_id: chat, text: title, parse_mode: "HTML", reply_markup: { inline_keyboard: buttons } };
}

function orderCard(db: DatabaseSync, chat: string, id: number): TelegramMessage {
  const order = getOrder(db, id);
  if (!order) return { chat_id: chat, text: "Заказ не найден." };
  return { chat_id: chat, text: [`Заказ #${id} · ${ORDER_STATUSES[order.status]}`, `Заявка #${order.lead_id}`, `Работа: ${order.title}`, order.amount === null ? "Сумма: не указана" : `Сумма: ${order.amount.toLocaleString("ru-RU")} ₽`, `Создан: ${formatDate(order.created_at)} МСК`].join("\n"),
    reply_markup: { inline_keyboard: [[button("Новый", `os:${id}:new`), button("В работе", `os:${id}:in_progress`)], [button("Выполнен", `os:${id}:completed`), button("Отменён", `os:${id}:cancelled`)], [button("← К заявке", `lead:${order.lead_id}`), button("🏠 Меню", "menu:home")]] } };
}

export function submitNewLead(lead: { name: string; phone: string; email?: string }, clientKey: string) {
  ensureConfigured();
  return transaction((db) => {
    const now = Date.now();
    const key = createHash("sha256").update(clientKey).digest("hex");
    db.prepare("DELETE FROM rate_limits WHERE reset_at < ?").run(now);
    const bucket = `lead:${key}`;
    const count = db.prepare(`INSERT INTO rate_limits(bucket,count,reset_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count`).get(bucket, now + 10 * 60_000) as { count: number };
    const total = db.prepare(`INSERT INTO rate_limits(bucket,count,reset_at) VALUES ('lead:global',1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count`).get(now + 10 * 60_000) as { count: number };
    if ((clientKey !== "unknown" && count.count > 5) || total.count > 100) return false;
    const result = db.prepare("INSERT INTO leads(name,phone,email,status,created_at,updated_at) VALUES(?,?,?,'new',?,?)").run(lead.name, lead.phone, lead.email ?? null, now, now);
    const id = Number(result.lastInsertRowid);
    for (const admin of adminIds()) enqueue(db, `newlead:${id}:${admin}`, leadCard(db, admin, id));
    return true;
  });
}

function tomorrowAtTen(now: number) {
  const moscow = new Date(now + 3 * 3600_000);
  return Date.UTC(moscow.getUTCFullYear(), moscow.getUTCMonth(), moscow.getUTCDate() + 1, 7, 0);
}

export function parseReminder(input: string, now = Date.now()) {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})(?:\s*\|\s*(.+))?$/u.exec(input);
  if (!match) return null;
  const [, d, m, y, h, min, note] = match;
  const date = new Date(`${y}-${m}-${d}T${h}:${min}:00+03:00`);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= now || date.getTime() > now + 3 * 366 * 86400_000) return null;
  const check = new Date(date.getTime() + 3 * 3600_000);
  if (check.getUTCDate() !== Number(d) || check.getUTCMonth() + 1 !== Number(m) || check.getUTCHours() !== Number(h) || check.getUTCMinutes() !== Number(min)) return null;
  return { due: date.getTime(), text: (note?.trim() || "Связаться с клиентом").slice(0, 300) };
}

function addReminder(db: DatabaseSync, admin: string, leadId: number, due: number, text: string) {
  const lead = getLead(db, leadId);
  if (!lead) return false;
  const result = db.prepare("INSERT INTO reminders(lead_id,admin_id,text,due_at,created_at) VALUES(?,?,?,?,?)").run(leadId, admin, text, due, Date.now());
  const id = Number(result.lastInsertRowid);
  enqueue(db, `reminder:${id}`, { chat_id: admin, parse_mode: "HTML", text: `⏰ <b>Напоминание</b> · ${formatDate(due)} МСК\nЗаявка #${lead.id}: ${esc(lead.name)}\nТелефон: ${esc(lead.phone)}\n${esc(text)}`,
    reply_markup: { inline_keyboard: [[button("Открыть заявку", `open:${lead.id}`)]] } }, due, id);
  return true;
}

type TelegramChat = { id?: number; type?: string };
type TelegramUser = { id?: number; first_name?: string; username?: string };
type TelegramUpdate = {
  update_id: number;
  message?: { from?: { id?: number }; chat?: TelegramChat; text?: string };
  callback_query?: { id?: string; from?: TelegramUser; data?: string; message?: { message_id?: number; chat?: TelegramChat; widget?: unknown } };
  /** Нажатие внутри HTML-виджета (Bot API 10.4). */
  widget_query?: { id?: string; from?: TelegramUser; data?: string; chat?: TelegramChat; message_id?: number };
};

type ClientSession = { step: string; name: string | null; phone: string | null; description: string | null };

/** Сценарий заявки клиента. Администратор проходит его же, чтобы добавить заявку вручную (admin = true): без приветствия и согласия клиента. */
function clientUpdate(db: DatabaseSync, update: TelegramUpdate, id: string, subscribed = true, admin = false) {
  let sequence = 0;
  const say = (text: string, markup?: Button[][] | ReplyMarkup) => enqueue(db, `update:${update.update_id}:${sequence++}`, { chat_id: id, text, ...(markup ? { reply_markup: Array.isArray(markup) ? { inline_keyboard: markup } : markup } : {}) }, Date.now(), undefined, "client");
  const text = update.message?.text?.trim() ?? "";
  const data = update.callback_query?.data ?? "";
  const home = admin ? [[button("🏠 Меню", "menu:home")]] : [[button("Оставить заявку", "client:new")], [button("💬 Связаться с менеджером", "client:manager")]];
  const consentUrl = `${site.url}/consent`;
  const cancel = [[button("Отменить", "client:cancel")]];
  const clear = () => db.prepare("DELETE FROM client_sessions WHERE user_id=?").run(id);
  const session = db.prepare("SELECT step,name,phone,description FROM client_sessions WHERE user_id=? AND expires_at>?").get(id, Date.now()) as ClientSession | undefined;
  if (text === "/id") { say(`Ваш Telegram ID: ${id}`); return; }
  const subscribeKeyboard = [[urlButton("📢 Подписаться на канал", site.contacts.telegramBlog)], [button("✅ Я подписался", "client:check")]];
  const askToSubscribe = () => say("Здравствуйте! Это VentCore. Чтобы оставить заявку или связаться с менеджером, подпишитесь на наш Telegram-канал — там мы показываем выполненные проекты. После подписки нажмите «Я подписался».", subscribeKeyboard);
  // Приветствие: карточка-виджет (если приложение Telegram её не показывает, придёт обычное меню) и кнопки внизу экрана.
  const welcome = (message: string) => {
    enqueue(db, `update:${update.update_id}:${sequence++}`, { method: "sendWidget", chat_id: id, html: WELCOME_HTML, allow_queries: true,
      fallback: { chat_id: id, text: "Выберите действие:", reply_markup: { inline_keyboard: home } } }, Date.now(), undefined, "client");
    say(message, CLIENT_KEYBOARD);
  };
  if (text.startsWith("/start") || data === "client:home" || text === "/cancel" || data === "client:cancel") {
    clear();
    if (admin) enqueue(db, `update:${update.update_id}:${sequence++}`, homeMessage(db, id, "Ввод заявки отменён.\n"));
    else if (subscribed) welcome("Здравствуйте! Это VentCore. Поможем с вентиляцией и кондиционированием. Оставьте заявку или свяжитесь с менеджером — мы ответим в ближайшее время.");
    else askToSubscribe();
    return;
  }
  // Без подписки доступно только приглашение подписаться
  if (!subscribed) {
    if (data === "client:check") say("Подписка пока не найдена. Подпишитесь на канал и нажмите «Я подписался» ещё раз.", subscribeKeyboard);
    else askToSubscribe();
    return;
  }
  if (data === "client:check") { welcome("Спасибо за подписку! Оставьте заявку или свяжитесь с менеджером."); return; }
  if (data === "client:manager" || text === "/manager") {
    clear();
    say(`Менеджер получит уведомление и напишет вам в Telegram. Для этого мы передадим ему ваше имя, username и ID из профиля Telegram.\n\nНажимая «Отправить запрос», вы соглашаетесь на обработку этих данных для связи с вами: ${consentUrl}`,
      [[button("Отправить запрос", "client:manager:send")], [button("Отменить", "client:cancel")]]); return;
  }
  if (data === "client:manager:send") {
    ensureConfigured();
    const now = Date.now();
    db.prepare("DELETE FROM rate_limits WHERE reset_at < ?").run(now);
    const count = db.prepare("INSERT INTO rate_limits(bucket,count,reset_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count").get(`manager:${id}`, now + 3600_000) as { count: number };
    if (count.count > 3) { say("Вы уже отправили несколько запросов — менеджер свяжется с вами. Если вопрос срочный, подождите немного.", home); return; }
    const profile = update.callback_query?.from;
    const name = (profile?.first_name ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80) || "Клиент Telegram";
    const username = /^[A-Za-z0-9_]{4,32}$/.test(profile?.username ?? "") ? profile!.username! : "";
    const result = db.prepare("INSERT INTO leads(name,phone,status,created_at,updated_at) VALUES(?,?,'new',?,?)").run(name, "не указан", now, now);
    const leadId = Number(result.lastInsertRowid);
    const note = `Источник: Telegram — просьба связаться с менеджером. ID ${id}${username ? `, @${username}` : ""}. Согласие на обработку данных профиля получено при отправке запроса.`;
    db.prepare("INSERT INTO notes(lead_id,admin_id,text,created_at) VALUES(?,?,?,?)").run(leadId, id, note, now);
    const link = username ? `https://t.me/${username}` : `tg://user?id=${id}`;
    for (const admin of adminIds()) {
      enqueue(db, `manager:${leadId}:${admin}`, { chat_id: admin, parse_mode: "HTML",
        text: `🔔 <b>Клиент просит связаться с менеджером</b>\nЗаявка #${leadId}\n👤 ${esc(name)}\nTelegram: ${username ? `@${username}` : "username не указан"} · ID ${id}`,
        reply_markup: { inline_keyboard: [[urlButton("✉️ Написать клиенту", link)], [button("Открыть заявку", `open:${leadId}`)]] } });
    }
    clear();
    say(`Запрос отправлен — менеджер получил уведомление и скоро напишет вам в Telegram.${username ? "" : "\n\nВ вашем профиле не указан username: если мы не сможем вам написать, оставьте заявку с номером телефона."}`, home); return;
  }
  if (data === "client:new" || text === "/request") {
    db.prepare("INSERT INTO client_sessions(user_id,step,expires_at) VALUES(?,'name',?) ON CONFLICT(user_id) DO UPDATE SET step='name',name=NULL,phone=NULL,description=NULL,expires_at=excluded.expires_at").run(id, Date.now() + 30 * 60_000);
    say(admin ? "Имя клиента?" : "Как к вам обращаться? Напишите имя.", cancel); return;
  }
  if (!session) { say("Чтобы оставить заявку, нажмите кнопку ниже.", home); return; }
  if (session.step === "name" && text && !text.startsWith("/")) {
    if (text.length < 2 || text.length > 80 || /[\x00-\x1f\x7f]/u.test(text)) { say("Укажите имя от 2 до 80 символов.", cancel); return; }
    db.prepare("UPDATE client_sessions SET name=?,step='phone',expires_at=? WHERE user_id=?").run(text, Date.now() + 30 * 60_000,id);
    say(admin ? "Телефон клиента?" : "Укажите номер телефона, по которому с вами можно связаться.", cancel); return;
  }
  if (session.step === "phone" && text && !text.startsWith("/")) {
    const digits = text.replace(/\D/g, "");
    if (text.length > 40 || !/^[+\d\s()\-]+$/u.test(text) || digits.length < 10 || digits.length > 15) { say("Проверьте номер: укажите от 10 до 15 цифр.", cancel); return; }
    db.prepare("UPDATE client_sessions SET phone=?,step='description',expires_at=? WHERE user_id=?").run(text, Date.now() + 30 * 60_000,id);
    say("Расскажите коротко, что нужно сделать, или пропустите этот шаг.", [[button("Пропустить", "client:skip")], ...cancel]); return;
  }
  if (session.step === "description" && ((text && !text.startsWith("/")) || data === "client:skip")) {
    const description = data === "client:skip" ? "" : text;
    if (description.length > 500 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/u.test(description)) { say("Описание должно быть не длиннее 500 символов.", cancel); return; }
    db.prepare("UPDATE client_sessions SET description=?,step='confirm',expires_at=? WHERE user_id=?").run(description, Date.now() + 30 * 60_000,id);
    say(`Проверьте заявку:\nИмя: ${session.name}\nТелефон: ${session.phone}${description ? `\nЗадача: ${description}` : ""}${admin ? "" : `\n\nНажимая «Отправить», вы соглашаетесь на обработку переданных данных для связи по заявке: ${consentUrl}`}`, [[button("Отправить заявку", "client:confirm")], [button("Заполнить заново", "client:new"), button("Отменить", "client:cancel")]]); return;
  }
  if (data === "client:confirm" && session.step === "confirm" && session.name && session.phone) {
    ensureConfigured();
    const now = Date.now();
    db.prepare("DELETE FROM rate_limits WHERE reset_at < ?").run(now);
    const count = db.prepare("INSERT INTO rate_limits(bucket,count,reset_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count").get(`telegram:${id}`, now + 3600_000) as { count: number };
    if (!admin && count.count > 5) { clear(); say("Вы уже отправили несколько заявок. Попробуйте позже.", home); return; }
    const result = db.prepare("INSERT INTO leads(name,phone,status,created_at,updated_at) VALUES(?,?,'new',?,?)").run(session.name,session.phone,now,now);
    const leadId = Number(result.lastInsertRowid);
    const note = `Источник: Telegram, ID ${id}. Согласие на обработку данных для связи получено при отправке.${session.description ? `\nЗадача: ${session.description}` : ""}`;
    db.prepare("INSERT INTO notes(lead_id,admin_id,text,created_at) VALUES(?,?,?,?)").run(leadId, id, note, now);
    for (const admin of adminIds()) enqueue(db, `newlead:${leadId}:${admin}`, leadCard(db,admin,leadId));
    clear(); say(admin ? `✅ Заявка #${leadId} создана — карточка пришла отдельным сообщением.` : "Спасибо! Заявка отправлена. Мы свяжемся с вами по указанному номеру.", home); return;
  }
  say("Продолжите заполнение заявки или отмените её.", cancel);
}

export type ProcessResult = { accepted: boolean; callbackId?: string; widget?: boolean; toast?: string };

export function processUpdate(input: TelegramUpdate, options: { subscribed?: boolean } = {}): ProcessResult {
  let update = input;
  if (!Number.isSafeInteger(update.update_id) || update.update_id < 0) return { accepted: false };
  // Нажатие в виджете обрабатывается так же, как нажатие inline-кнопки: данные — это callback_data.
  const widget = update.widget_query;
  const isWidget = !update.callback_query && widget !== undefined;
  if (isWidget) update = { ...update, callback_query: { id: widget.id, from: widget.from, data: widget.data, message: { chat: widget.chat, message_id: widget.message_id, widget: true } } };
  const callback = update.callback_query;
  const reject = { accepted: false, callbackId: callback?.id, widget: isWidget };
  const from = callback?.from?.id ?? update.message?.from?.id;
  const chat = callback?.message?.chat ?? update.message?.chat;
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(chat?.id) || chat?.type !== "private" || from !== chat.id) return reject;
  const id = String(from);
  const allowed = adminIds().includes(id);
  // Текст кнопок нижней клавиатуры превращается в команду (до проверки сессий ввода).
  const rawText = update.message?.text?.trim();
  const label = rawText ? (allowed ? ADMIN_LABELS : CLIENT_LABELS)[rawText] : undefined;
  if (label && update.message) update = { ...update, message: { ...update.message, text: label } };
  return transaction((db) => {
    const done = { accepted: true, callbackId: callback?.id, widget: isWidget };
    const inserted = db.prepare("INSERT INTO telegram_updates(id,received_at) VALUES(?,?) ON CONFLICT(id) DO NOTHING").run(update.update_id, Date.now());
    if (!inserted.changes) return done;
    db.prepare("DELETE FROM telegram_updates WHERE received_at < ?").run(Date.now() - 30 * 86400_000);
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
    db.prepare("DELETE FROM client_sessions WHERE expires_at < ?").run(Date.now());
    db.prepare("DELETE FROM admin_search_sessions WHERE expires_at < ?").run(Date.now());
    if (callback && (typeof callback.id !== "string" || typeof callback.data !== "string" || callback.data.length > 64)) return done;
    if (!allowed) { clientUpdate(db, update, id, options.subscribed ?? true); return done; }
    const text0 = update.message?.text?.trim() ?? "";
    const data0 = callback?.data ?? "";
    const clientSession = db.prepare("SELECT user_id FROM client_sessions WHERE user_id=?").get(id);
    // Заявку администратор заполняет тем же сценарием, что и клиент. Любая другая кнопка или команда меню прерывает его.
    const clientFlow = data0.startsWith("client:") || text0 === "/request" || (clientSession !== undefined && !data0 && !ADMIN_COMMAND.test(text0));
    if (clientFlow) { clientUpdate(db, update, id, true, true); return done; }
    if (clientSession) db.prepare("DELETE FROM client_sessions WHERE user_id=?").run(id);
    let sequence = 0;
    const reply = (message: TelegramMessage) => enqueue(db, `update:${update.update_id}:${sequence++}`, message);
    const say = (text: string, keyboard?: Button[][]) => reply({ chat_id: id, text, ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}) });
    // Навигация по кнопкам правит то же сообщение, а не засоряет чат новыми. Из виджета и из текстовых команд — новое сообщение.
    const messageId = callback?.message?.message_id;
    const editable = !isWidget && !callback?.message?.widget && Number.isSafeInteger(messageId) ? messageId : undefined;
    const show = (message: TelegramMessage) => reply(editable && message.text && !message.method ? { ...message, method: "editMessageText", message_id: editable } : message);
    let toast: string | undefined;
    let text = text0.slice(0, 1000);
    const data = data0;
    const menuCommands: Record<string, string> = { "menu:leads": "/leads", "menu:orders": "/orders", "menu:reminders": "/reminders", "menu:help": "/help", "menu:dashboard": "/dashboard", "menu:home": "/menu" };
    if (Object.hasOwn(menuCommands, data)) text = menuCommands[data];
    if ((data.startsWith("menu:") && data !== "menu:search") || (text.startsWith("/") && !text.startsWith("/search"))) db.prepare("DELETE FROM admin_search_sessions WHERE admin_id=?").run(id);
    const session = db.prepare("SELECT action,lead_id FROM sessions WHERE admin_id=? AND expires_at>?").get(id, Date.now()) as { action: string; lead_id: number } | undefined;
    const setSession = (action: string, leadId: number) => db.prepare("INSERT INTO sessions(admin_id,action,lead_id,expires_at) VALUES(?,?,?,?) ON CONFLICT(admin_id) DO UPDATE SET action=excluded.action,lead_id=excluded.lead_id,expires_at=excluded.expires_at").run(id, action, leadId, Date.now() + 30 * 60_000);
    const clearSession = () => db.prepare("DELETE FROM sessions WHERE admin_id=?").run(id);
    const startSearch = () => { clearSession(); db.prepare("INSERT INTO admin_search_sessions(admin_id,expires_at) VALUES(?,?) ON CONFLICT(admin_id) DO UPDATE SET expires_at=excluded.expires_at").run(id, Date.now() + 30 * 60_000); show({ chat_id: id, text: "🔎 Введите имя или телефон для поиска.\nОтмена — кнопка ниже или /cancel.", reply_markup: { inline_keyboard: [[button("Отменить", "menu:home")]] } }); };
    const searchSession = db.prepare("SELECT admin_id FROM admin_search_sessions WHERE admin_id=? AND expires_at>?").get(id, Date.now());
    if (data === "menu:search") startSearch();
    else if (text.startsWith("/cancel")) { clearSession(); db.prepare("DELETE FROM admin_search_sessions WHERE admin_id=?").run(id); reply(homeMessage(db, id, "Действие отменено.\n")); }
    else if (text.startsWith("/start")) {
      clearSession(); db.prepare("DELETE FROM admin_search_sessions WHERE admin_id=?").run(id);
      // Постоянная клавиатура крепится к отдельному короткому сообщению: у одного сообщения может быть только один тип клавиатуры.
      reply({ chat_id: id, text: "VentCore · мини-CRM\nКнопки быстрого доступа — внизу экрана.", reply_markup: ADMIN_KEYBOARD });
      reply(homeMessage(db, id));
    }
    else if (text === "/menu" || text === "/crm") { clearSession(); db.prepare("DELETE FROM admin_search_sessions WHERE admin_id=?").run(id); show(homeMessage(db, id)); }
    else if (text === "/help") { clearSession(); db.prepare("DELETE FROM admin_search_sessions WHERE admin_id=?").run(id); show({ chat_id: id, text: HELP_TEXT, parse_mode: "HTML", reply_markup: { inline_keyboard: [[button("🏠 Меню", "menu:home")]] } }); }
    else if (text.startsWith("/dashboard")) { clearSession(); reply(dashboardMessage(db, id)); }
    else if (data === "dash:refresh") {
      // Обновляем данные уже показанного виджета и подпись под ним; если сообщение не определить — присылаем свежий виджет.
      const target = callback?.message?.message_id;
      if (Number.isSafeInteger(target)) {
        const s = stats(db, id);
        reply({ method: "editMessageWidgetData", chat_id: id, message_id: target, chat_data: encodeDashboard(s.state),
          fallback: dashboardMessage(db, id) });
        reply({ method: "editMessageCaption", chat_id: id, message_id: target, caption: dashboardCaption(s), reply_markup: { inline_keyboard: DASH_KEYBOARD } });
        toast = "Обновлено";
      } else reply(dashboardMessage(db, id));
    }
    else if (text.startsWith("/leads") || data === "leads" || /^leads:\d+$/.test(data)) { clearSession(); show(listLeads(db, id, { offset: data.startsWith("leads:") ? Number(data.split(":")[1]) : 0 })); }
    else if (/^ls:(all|[a-z_]+):\d+$/.test(data)) { const [, key, offset] = data.split(":"); clearSession(); show(listLeads(db, id, { status: key === "all" ? "" : key, offset: Number(offset) })); }
    else if (text.startsWith("/search")) {
      clearSession();
      const query = text.replace(/^\/search(?:@\w+)?\s*/u, "").slice(0, 80);
      if (!query) startSearch();
      else if (query.length < 2) say("Введите имя или телефон (не менее 2 символов).");
      else reply(listLeads(db, id, { search: query }));
    }
    else if (searchSession && text && !text.startsWith("/")) { if (text.length < 2) say("Введите минимум 2 символа."); else { db.prepare("DELETE FROM admin_search_sessions WHERE admin_id=?").run(id); reply(listLeads(db, id, { search: text.slice(0, 80) })); } }
    else if (text.startsWith("/orders")) { clearSession(); const rows = db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 20").all() as OrderRow[]; show({ chat_id: id, text: rows.length ? "Последние заказы:" : "Заказов пока нет.", reply_markup: { inline_keyboard: [...rows.map((o) => [button(`#${o.id} ${o.title.slice(0, 25)} · ${ORDER_STATUSES[o.status]}`, `ordercard:${o.id}`)]), [button("🏠 Меню", "menu:home")]] } }); }
    else if (text.startsWith("/reminders")) { clearSession(); const rows = db.prepare("SELECT * FROM reminders WHERE admin_id=? AND status='pending' ORDER BY due_at LIMIT 20").all(id) as ReminderRow[]; show({ chat_id: id, text: rows.length ? "Ваши запланированные напоминания (МСК):\n" + rows.map((r) => `#${r.id} · ${formatDate(r.due_at)} · заявка #${r.lead_id} · ${r.text.slice(0, 90)}`).join("\n") : "Запланированных напоминаний нет.", reply_markup: { inline_keyboard: [...rows.map((r) => [button(`Заявка #${r.lead_id}`, `lead:${r.lead_id}`), button(`Отменить #${r.id}`, `cancelrem:${r.id}`)]), [button("🏠 Меню", "menu:home")]] } }); }
    else if (session && text && !text.startsWith("/")) {
      const lead = getLead(db, session.lead_id);
      if (!lead) { clearSession(); say("Заявка не найдена."); }
      else if (session.action === "note") { const note = text.slice(0, 500); db.prepare("INSERT INTO notes(lead_id,admin_id,text,created_at) VALUES(?,?,?,?)").run(lead.id,id,note,Date.now()); clearSession(); say("Заметка добавлена."); reply(leadCard(db,id,lead.id)); }
      else if (session.action === "order") {
        const parts = text.split("|"); const title = parts[0]?.trim(); const amountText = parts[1]?.trim().replace(/\s/g, "");
        if (!title || title.length > 160 || parts.length > 2 || (amountText && (!/^\d{1,10}$/.test(amountText) || Number(amountText) > 1_000_000_000))) say("Введите название заказа до 160 символов и, при необходимости, сумму в рублях через |. Например: Монтаж вентиляции | 150000");
        else { const now=Date.now(); const result=db.prepare("INSERT INTO orders(lead_id,title,amount,created_at,updated_at) VALUES(?,?,?,?,?)").run(lead.id,title,amountText ? Number(amountText) : null,now,now); clearSession(); say("Заказ создан."); reply(orderCard(db,id,Number(result.lastInsertRowid))); }
      } else if (session.action === "remind") {
        const reminder = parseReminder(text);
        if (!reminder) say("Укажите будущую дату по Москве: ДД.ММ.ГГГГ ЧЧ:ММ | текст. Например: 30.10.2026 14:30 | Позвонить клиенту");
        else { addReminder(db,id,lead.id,reminder.due,reminder.text); clearSession(); say(`Напоминание установлено на ${formatDate(reminder.due)} МСК.`); reply(leadCard(db,id,lead.id)); }
      }
    }
    // Из уведомлений (новая заявка, напоминание) карточка открывается новым сообщением, чтобы не затирать уведомление.
    else if (/^open:\d+$/.test(data)) { clearSession(); reply(leadCard(db,id,Number(data.split(":")[1]))); }
    else if (/^lead:\d+$/.test(data)) { clearSession(); show(leadCard(db,id,Number(data.split(":")[1]))); }
    else if (/^history:\d+:\d+$/.test(data)) { const [,raw,offset]=data.split(":"); clearSession(); show(noteHistory(db,id,Number(raw),Number(offset))); }
    else if (/^status:\d+$/.test(data)) { const leadId=Number(data.split(":")[1]); if (!getLead(db,leadId)) say("Заявка не найдена."); else show({ chat_id: id, text: `Заявка #${leadId}: выберите статус`, reply_markup: { inline_keyboard: [Object.entries(LEAD_STATUSES).slice(0,3).map(([key,label])=>button(`${STATUS_EMOJI[key]} ${label}`,`s:${leadId}:${key}`)),Object.entries(LEAD_STATUSES).slice(3).map(([key,label])=>button(`${STATUS_EMOJI[key]} ${label}`,`s:${leadId}:${key}`)),[button("← К заявке",`lead:${leadId}`)]] } }); }
    else if (/^s:\d+:[a-z_]+$/.test(data)) { const [, raw, status] = data.split(":"); const leadId=Number(raw); if (Object.hasOwn(LEAD_STATUSES, status) && getLead(db,leadId)) { db.prepare("UPDATE leads SET status=?,updated_at=? WHERE id=?").run(status,Date.now(),leadId); toast = `${STATUS_EMOJI[status]} ${LEAD_STATUSES[status]}`; show(leadCard(db,id,leadId)); } else say("Статус или заявка не найдены."); }
    else if (/^(note|order|remind):\d+$/.test(data)) {
      const [action, raw] = data.split(":"); const leadId=Number(raw);
      if (!getLead(db,leadId)) say("Заявка не найдена.");
      else if (action === "remind") { clearSession(); show({ chat_id: id, text: "Когда напомнить? Время указывается по Москве.", reply_markup: { inline_keyboard: [[button("Через час",`r:${leadId}:hour`),button("Завтра в 10:00",`r:${leadId}:tomorrow`)], [button("Другая дата",`r:${leadId}:custom`)], [button("← К заявке",`lead:${leadId}`)]] } }); }
      else { setSession(action,leadId); say(action === "note" ? "Напишите заметку к заявке (до 500 символов). Отмена: /cancel" : "Введите название заказа и при необходимости сумму в рублях через |. Например: Монтаж вентиляции | 150000\nОтмена: /cancel"); }
    }
    else if (/^r:\d+:(hour|tomorrow|custom)$/.test(data)) { const [, raw, choice]=data.split(":"); const leadId=Number(raw); if (!getLead(db,leadId)) say("Заявка не найдена."); else if (choice === "custom") { setSession("remind",leadId); say("Введите дату и время по Москве: ДД.ММ.ГГГГ ЧЧ:ММ | текст. Текст после | можно не указывать. Отмена: /cancel"); } else { const due=choice === "hour" ? Date.now()+3600_000 : tomorrowAtTen(Date.now()); addReminder(db,id,leadId,due,"Связаться с клиентом"); toast = `⏰ Напоминание на ${formatDate(due)} МСК`; show(leadCard(db,id,leadId)); } }
    else if (/^cancelrem:\d+$/.test(data)) { const rid=Number(data.split(":")[1]); const rem=db.prepare("SELECT * FROM reminders WHERE id=? AND admin_id=?").get(rid,id) as ReminderRow | undefined; if (!rem || rem.status !== "pending") say("Напоминание не найдено или уже выполнено."); else { const changed=db.prepare("UPDATE outbox SET state='cancelled' WHERE reminder_id=? AND state='pending'").run(rid); if (!changed.changes) say("Напоминание уже отправляется или отправлено."); else { db.prepare("UPDATE reminders SET status='cancelled' WHERE id=?").run(rid); toast = "Напоминание отменено"; show(leadCard(db,id,rem.lead_id)); } } }
    else if (/^ordercard:\d+$/.test(data)) show(orderCard(db,id,Number(data.split(":")[1])));
    else if (/^os:\d+:[a-z_]+$/.test(data)) { const [,raw,status]=data.split(":"); const orderId=Number(raw); if (Object.hasOwn(ORDER_STATUSES, status) && getOrder(db,orderId)) { db.prepare("UPDATE orders SET status=?,updated_at=? WHERE id=?").run(status,Date.now(),orderId); toast = ORDER_STATUSES[status]; show(orderCard(db,id,orderId)); } else say("Статус или заказ не найдены."); }
    else if (text) say("Выберите действие кнопкой внизу экрана или отправьте /help.");
    return { ...done, toast };
  });
}
