import "server-only";

import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { transaction, type LeadRow, type OrderRow, type ReminderRow } from "./db";
import { enqueue } from "./queue";
import { site } from "@/content/site";
import { adminIds, ensureConfigured, type Button, type TelegramMessage } from "./telegram";

export const LEAD_STATUSES: Record<string, string> = { new: "Новая", contacted: "Связались", in_progress: "В работе", proposal: "Предложение", won: "Успешно", lost: "Отказ" };
export const ORDER_STATUSES: Record<string, string> = { new: "Новый", in_progress: "В работе", completed: "Выполнен", cancelled: "Отменён" };
const formatDate = (value: number) => new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Moscow" }).format(new Date(value));
const button = (text: string, data: string): Button => ({ text, callback_data: data });
const urlButton = (text: string, url: string): Button => ({ text, url });
const dataIsAdminMenu = (data: string | undefined) => data?.startsWith("menu:") ?? false;
const adminMenu = [[button("📋 Заявки", "menu:leads"), button("🔎 Поиск", "menu:search")], [button("📦 Заказы", "menu:orders"), button("⏰ Напоминания", "menu:reminders")], [button("Оставить заявку", "client:new"), button("❔ Помощь", "menu:help")]];
const getLead = (db: DatabaseSync, id: number) => db.prepare("SELECT * FROM leads WHERE id=?").get(id) as LeadRow | undefined;
const getOrder = (db: DatabaseSync, id: number) => db.prepare("SELECT * FROM orders WHERE id=?").get(id) as OrderRow | undefined;

function leadCard(db: DatabaseSync, chat: string, id: number): TelegramMessage {
  const lead = getLead(db, id);
  if (!lead) return { chat_id: chat, text: "Заявка не найдена." };
  const orders = db.prepare("SELECT * FROM orders WHERE lead_id=? ORDER BY id DESC LIMIT 3").all(id) as OrderRow[];
  const notes = db.prepare("SELECT text, created_at FROM notes WHERE lead_id=? ORDER BY id DESC LIMIT 3").all(id) as { text: string; created_at: number }[];
  const reminders = db.prepare("SELECT * FROM reminders WHERE lead_id=? AND status='pending' ORDER BY due_at LIMIT 3").all(id) as ReminderRow[];
  const text = [
    `Заявка #${lead.id} · ${LEAD_STATUSES[lead.status] ?? lead.status}`,
    `Имя: ${lead.name}`, `Телефон: ${lead.phone}`, lead.email ? `Email: ${lead.email}` : "",
    `Получена: ${formatDate(lead.created_at)} (МСК)`,
    orders.length ? `\nЗаказы:\n${orders.map((o) => `#${o.id} ${o.title} — ${ORDER_STATUSES[o.status]}${o.amount === null ? "" : ` · ${o.amount.toLocaleString("ru-RU")} ₽`}`).join("\n")}` : "",
    reminders.length ? `\nНапоминания:\n${reminders.map((r) => `#${r.id} ${formatDate(r.due_at)} МСК — ${r.text}`).join("\n")}` : "",
    notes.length ? `\nЗаметки:\n${notes.map((n) => `${formatDate(n.created_at)} — ${n.text}`).join("\n")}` : "",
  ].filter(Boolean).join("\n");
  return { chat_id: chat, text, reply_markup: { inline_keyboard: [
    [button("Изменить статус", `status:${id}`), button("Добавить заметку", `note:${id}`)],
    [button("История заметок", `history:${id}:0`)],
    [button("Создать заказ", `order:${id}`), button("Напоминание", `remind:${id}`)],
    ...orders.slice(0, 3).map((o) => [button(`Заказ #${o.id}: ${ORDER_STATUSES[o.status]}`, `ordercard:${o.id}`)]),
    ...reminders.slice(0, 3).map((r) => [button(`Отменить напоминание #${r.id}`, `cancelrem:${r.id}`)]),
    [button("Все заявки", "leads")],
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
  return { chat_id: chat, text: visible.length ? `Заметки к заявке #${leadId}:\n\n${visible.map((note) => `${formatDate(note.created_at)} МСК\n${note.text}`).join("\n\n")}` : `У заявки #${leadId} пока нет заметок.`,
    reply_markup: { inline_keyboard: [...(navigation.length ? [navigation] : []), [button("← К заявке", `lead:${leadId}`)]] } };
}

function listLeads(db: DatabaseSync, chat: string, search = "", offset = 0): TelegramMessage {
  const safeOffset = Math.max(0, Math.min(offset, 100000));
  const normalized = search.toLocaleLowerCase("ru-RU");
  const digits = search.replace(/\D/g, "");
  const rows = search
    ? db.prepare("SELECT * FROM leads WHERE instr(crm_lower(name), ?) > 0 OR instr(crm_lower(phone), ?) > 0 OR (? <> '' AND instr(crm_digits(phone), ?) > 0) ORDER BY id DESC LIMIT 11 OFFSET ?").all(normalized, normalized, digits, digits, safeOffset) as LeadRow[]
    : db.prepare("SELECT * FROM leads ORDER BY id DESC LIMIT 11 OFFSET ?").all(safeOffset) as LeadRow[];
  const visible = rows.slice(0, 10);
  const buttons = visible.map((lead) => [button(`#${lead.id} ${lead.name.slice(0, 26)} · ${LEAD_STATUSES[lead.status]}`, `lead:${lead.id}`)]);
  if (!search) {
    const navigation: Button[] = [];
    if (safeOffset > 0) navigation.push(button("← Назад", `leads:${Math.max(0, safeOffset - 10)}`));
    if (rows.length > 10) navigation.push(button("Далее →", `leads:${safeOffset + 10}`));
    if (navigation.length) buttons.push(navigation);
  }
  return { chat_id: chat, text: search ? `Поиск: ${search}\nНайдено: ${visible.length}${rows.length > 10 ? "+" : ""}` : `Заявки${visible.length ? ` · ${safeOffset + 1}–${safeOffset + visible.length}` : " пока отсутствуют"}`,
    ...(buttons.length ? { reply_markup: { inline_keyboard: buttons } } : {}) };
}

function orderCard(db: DatabaseSync, chat: string, id: number): TelegramMessage {
  const order = getOrder(db, id);
  if (!order) return { chat_id: chat, text: "Заказ не найден." };
  return { chat_id: chat, text: [`Заказ #${id} · ${ORDER_STATUSES[order.status]}`, `Заявка #${order.lead_id}`, `Работа: ${order.title}`, order.amount === null ? "Сумма: не указана" : `Сумма: ${order.amount.toLocaleString("ru-RU")} ₽`, `Создан: ${formatDate(order.created_at)} МСК`].join("\n"),
    reply_markup: { inline_keyboard: [[button("Новый", `os:${id}:new`), button("В работе", `os:${id}:in_progress`)], [button("Выполнен", `os:${id}:completed`), button("Отменён", `os:${id}:cancelled`)], [button("← К заявке", `lead:${order.lead_id}`)]] } };
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
  enqueue(db, `reminder:${id}`, { chat_id: admin, text: `⏰ Напоминание · ${formatDate(due)} МСК\nЗаявка #${lead.id}: ${lead.name}\nТелефон: ${lead.phone}\n${text}`,
    reply_markup: { inline_keyboard: [[button("Открыть заявку", `lead:${lead.id}`)]] } }, due, id);
  return true;
}

type TelegramUpdate = {
  update_id: number;
  message?: { from?: { id?: number }; chat?: { id?: number; type?: string }; text?: string };
  callback_query?: { id?: string; from?: { id?: number; first_name?: string; username?: string }; data?: string; message?: { chat?: { id?: number; type?: string } } };
};

type ClientSession = { step: string; name: string | null; phone: string | null; description: string | null };

function clientUpdate(db: DatabaseSync, update: TelegramUpdate, id: string, subscribed = true) {
  let sequence = 0;
  const say = (text: string, keyboard?: Button[][]) => enqueue(db, `update:${update.update_id}:${sequence++}`, { chat_id: id, text, ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}) }, Date.now(), undefined, "client");
  const text = update.message?.text?.trim() ?? "";
  const data = update.callback_query?.data ?? "";
  const home = [[button("Оставить заявку", "client:new")], [button("💬 Связаться с менеджером", "client:manager")]];
  const consentUrl = `${site.url}/consent`;
  const cancel = [[button("Отменить", "client:cancel")]];
  const clear = () => db.prepare("DELETE FROM client_sessions WHERE user_id=?").run(id);
  const session = db.prepare("SELECT step,name,phone,description FROM client_sessions WHERE user_id=? AND expires_at>?").get(id, Date.now()) as ClientSession | undefined;
  if (text === "/id") { say(`Ваш Telegram ID: ${id}`); return; }
  const subscribeKeyboard = [[urlButton("📢 Подписаться на канал", site.contacts.telegramBlog)], [button("✅ Я подписался", "client:check")]];
  const askToSubscribe = () => say("Здравствуйте! Это VentCore. Чтобы оставить заявку или связаться с менеджером, подпишитесь на наш Telegram-канал — там мы показываем выполненные проекты. После подписки нажмите «Я подписался».", subscribeKeyboard);
  if (text.startsWith("/start") || data === "client:home" || text === "/cancel" || data === "client:cancel") {
    clear();
    if (subscribed) say("Здравствуйте! Это VentCore. Поможем с вентиляцией и кондиционированием. Оставьте заявку или свяжитесь с менеджером — мы ответим в ближайшее время.", home);
    else askToSubscribe();
    return;
  }
  // Без подписки доступно только приглашение подписаться
  if (!subscribed) {
    if (data === "client:check") say("Подписка пока не найдена. Подпишитесь на канал и нажмите «Я подписался» ещё раз.", subscribeKeyboard);
    else askToSubscribe();
    return;
  }
  if (data === "client:check") { say("Спасибо за подписку! Оставьте заявку или свяжитесь с менеджером.", home); return; }
  if (data === "client:manager") {
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
      enqueue(db, `manager:${leadId}:${admin}`, { chat_id: admin,
        text: `🔔 Клиент просит связаться с менеджером\nЗаявка #${leadId}\nИмя: ${name}\nTelegram: ${username ? `@${username}` : "username не указан"} · ID ${id}`,
        reply_markup: { inline_keyboard: [[urlButton("✉️ Написать клиенту", link)], [button("Открыть заявку", `lead:${leadId}`)]] } });
    }
    clear();
    say(`Запрос отправлен — менеджер получил уведомление и скоро напишет вам в Telegram.${username ? "" : "\n\nВ вашем профиле не указан username: если мы не сможем вам написать, оставьте заявку с номером телефона."}`, home); return;
  }
  if (data === "client:new" || text === "/request") {
    db.prepare("INSERT INTO client_sessions(user_id,step,expires_at) VALUES(?,'name',?) ON CONFLICT(user_id) DO UPDATE SET step='name',name=NULL,phone=NULL,description=NULL,expires_at=excluded.expires_at").run(id, Date.now() + 30 * 60_000);
    say("Как к вам обращаться? Напишите имя.", cancel); return;
  }
  if (!session) { say("Чтобы оставить заявку, нажмите кнопку ниже.", home); return; }
  if (session.step === "name" && text && !text.startsWith("/")) {
    if (text.length < 2 || text.length > 80 || /[\x00-\x1f\x7f]/u.test(text)) { say("Укажите имя от 2 до 80 символов.", cancel); return; }
    db.prepare("UPDATE client_sessions SET name=?,step='phone',expires_at=? WHERE user_id=?").run(text, Date.now() + 30 * 60_000,id);
    say("Укажите номер телефона, по которому с вами можно связаться.", cancel); return;
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
    say(`Проверьте заявку:\nИмя: ${session.name}\nТелефон: ${session.phone}${description ? `\nЗадача: ${description}` : ""}\n\nНажимая «Отправить», вы соглашаетесь на обработку переданных данных для связи по заявке: ${consentUrl}`, [[button("Отправить заявку", "client:confirm")], [button("Заполнить заново", "client:new"), button("Отменить", "client:cancel")]]); return;
  }
  if (data === "client:confirm" && session.step === "confirm" && session.name && session.phone) {
    ensureConfigured();
    const now = Date.now();
    db.prepare("DELETE FROM rate_limits WHERE reset_at < ?").run(now);
    const count = db.prepare("INSERT INTO rate_limits(bucket,count,reset_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count").get(`telegram:${id}`, now + 3600_000) as { count: number };
    if (count.count > 5) { clear(); say("Вы уже отправили несколько заявок. Попробуйте позже.", home); return; }
    const result = db.prepare("INSERT INTO leads(name,phone,status,created_at,updated_at) VALUES(?,?,'new',?,?)").run(session.name,session.phone,now,now);
    const leadId = Number(result.lastInsertRowid);
    const note = `Источник: Telegram, ID ${id}. Согласие на обработку данных для связи получено при отправке.${session.description ? `\nЗадача: ${session.description}` : ""}`;
    db.prepare("INSERT INTO notes(lead_id,admin_id,text,created_at) VALUES(?,?,?,?)").run(leadId, id, note, now);
    for (const admin of adminIds()) enqueue(db, `newlead:${leadId}:${admin}`, leadCard(db,admin,leadId));
    clear(); say("Спасибо! Заявка отправлена. Мы свяжемся с вами по указанному номеру.", home); return;
  }
  say("Продолжите заполнение заявки или отмените её.", cancel);
}

export function processUpdate(update: TelegramUpdate, options: { subscribed?: boolean } = {}) {
  if (!Number.isSafeInteger(update.update_id) || update.update_id < 0) return { accepted: false };
  const callback = update.callback_query;
  const from = callback?.from?.id ?? update.message?.from?.id;
  const chat = callback?.message?.chat ?? update.message?.chat;
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(chat?.id) || chat?.type !== "private" || from !== chat.id) return { accepted: false, callbackId: callback?.id };
  const id = String(from);
  const allowed = adminIds().includes(id);
  return transaction((db) => {
    const inserted = db.prepare("INSERT INTO telegram_updates(id,received_at) VALUES(?,?) ON CONFLICT(id) DO NOTHING").run(update.update_id, Date.now());
    if (!inserted.changes) return { accepted: true, callbackId: callback?.id };
    db.prepare("DELETE FROM telegram_updates WHERE received_at < ?").run(Date.now() - 30 * 86400_000);
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
    db.prepare("DELETE FROM client_sessions WHERE expires_at < ?").run(Date.now());
    db.prepare("DELETE FROM admin_search_sessions WHERE expires_at < ?").run(Date.now());
    if (callback && (typeof callback.id !== "string" || typeof callback.data !== "string" || callback.data.length > 64)) return { accepted: true, callbackId: callback.id };
    if (!allowed) { clientUpdate(db, update, id, options.subscribed ?? true); return { accepted: true, callbackId: callback?.id }; }
    const clientSession = db.prepare("SELECT user_id FROM client_sessions WHERE user_id=?").get(id);
    const isAdminHome = /^(\/start|\/help|\/crm)(?:@\w+)?(?:\s|$)/u.test(update.message?.text?.trim() ?? "") || dataIsAdminMenu(callback?.data);
    if ((callback?.data?.startsWith("client:") || clientSession) && !isAdminHome) { clientUpdate(db, update, id, options.subscribed ?? true); return { accepted: true, callbackId: callback?.id }; }
    if (isAdminHome) db.prepare("DELETE FROM client_sessions WHERE user_id=?").run(id);
    let sequence = 0;
    const reply = (message: TelegramMessage) => enqueue(db, `update:${update.update_id}:${sequence++}`, message);
    const say = (text: string, keyboard?: Button[][]) => reply({ chat_id: id, text, ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}) });
    let text = update.message?.text?.trim().slice(0, 1000) ?? "";
    const data = callback?.data ?? "";
    const menuCommands: Record<string, string> = { "menu:leads": "/leads", "menu:orders": "/orders", "menu:reminders": "/reminders", "menu:help": "/help" };
    if (Object.hasOwn(menuCommands, data)) text = menuCommands[data];
    if ((data.startsWith("menu:") && data !== "menu:search") || (text.startsWith("/") && !text.startsWith("/search"))) db.prepare("DELETE FROM admin_search_sessions WHERE admin_id=?").run(id);
    const session = db.prepare("SELECT action,lead_id FROM sessions WHERE admin_id=? AND expires_at>?").get(id, Date.now()) as { action: string; lead_id: number } | undefined;
    const setSession = (action: string, leadId: number) => db.prepare("INSERT INTO sessions(admin_id,action,lead_id,expires_at) VALUES(?,?,?,?) ON CONFLICT(admin_id) DO UPDATE SET action=excluded.action,lead_id=excluded.lead_id,expires_at=excluded.expires_at").run(id, action, leadId, Date.now() + 30 * 60_000);
    const clearSession = () => db.prepare("DELETE FROM sessions WHERE admin_id=?").run(id);
    const searchSession = db.prepare("SELECT admin_id FROM admin_search_sessions WHERE admin_id=? AND expires_at>?").get(id, Date.now());
    if (data === "menu:search") { clearSession(); db.prepare("INSERT INTO admin_search_sessions(admin_id,expires_at) VALUES(?,?) ON CONFLICT(admin_id) DO UPDATE SET expires_at=excluded.expires_at").run(id, Date.now()+30*60_000); say("Введите имя или телефон для поиска. Отмена: /cancel", [[button("Отменить", "menu:help")]]); }
    else if (text.startsWith("/cancel")) { clearSession(); db.prepare("DELETE FROM admin_search_sessions WHERE admin_id=?").run(id); say("Действие отменено.", adminMenu); }
    else if (text.startsWith("/start") || text === "/help" || text === "/crm") { clearSession(); db.prepare("DELETE FROM admin_search_sessions WHERE admin_id=?").run(id); say("VentCore · мини-CRM\n\nВыберите раздел или используйте команды /leads, /orders, /reminders и /search. Для отмены ввода — /cancel.", adminMenu); }
    else if (text.startsWith("/leads") || data === "leads" || /^leads:\d+$/.test(data)) { clearSession(); reply(listLeads(db, id, "", data.startsWith("leads:") ? Number(data.split(":")[1]) : 0)); }
    else if (text.startsWith("/search")) { clearSession(); const query = text.replace(/^\/search(?:@\w+)?\s*/u, "").slice(0, 80); if (query.length < 2) say("Введите /search и имя или телефон (не менее 2 символов)."); else reply(listLeads(db, id, query)); }
    else if (searchSession && text && !text.startsWith("/")) { if (text.length < 2) say("Введите минимум 2 символа."); else { db.prepare("DELETE FROM admin_search_sessions WHERE admin_id=?").run(id); reply(listLeads(db,id,text.slice(0,80))); } }
    else if (text.startsWith("/orders")) { clearSession(); const rows = db.prepare("SELECT * FROM orders ORDER BY id DESC LIMIT 20").all() as OrderRow[]; say(rows.length ? "Последние заказы:" : "Заказов пока нет.", rows.map((o) => [button(`#${o.id} ${o.title.slice(0, 25)} · ${ORDER_STATUSES[o.status]}`, `ordercard:${o.id}`)])); }
    else if (text.startsWith("/reminders")) { clearSession(); const rows = db.prepare("SELECT * FROM reminders WHERE admin_id=? AND status='pending' ORDER BY due_at LIMIT 20").all(id) as ReminderRow[]; say(rows.length ? "Ваши запланированные напоминания (МСК):\n" + rows.map((r) => `#${r.id} · ${formatDate(r.due_at)} · заявка #${r.lead_id} · ${r.text.slice(0, 90)}`).join("\n") : "Запланированных напоминаний нет.", rows.map((r) => [button(`Заявка #${r.lead_id}`, `lead:${r.lead_id}`), button(`Отменить #${r.id}`, `cancelrem:${r.id}`)])); }
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
    else if (/^lead:\d+$/.test(data)) { clearSession(); reply(leadCard(db,id,Number(data.split(":")[1]))); }
    else if (/^history:\d+:\d+$/.test(data)) { const [,raw,offset]=data.split(":"); clearSession(); reply(noteHistory(db,id,Number(raw),Number(offset))); }
    else if (/^status:\d+$/.test(data)) { const leadId=Number(data.split(":")[1]); if (!getLead(db,leadId)) say("Заявка не найдена."); else say("Выберите статус заявки:", [Object.entries(LEAD_STATUSES).slice(0,3).map(([key,label])=>button(label,`s:${leadId}:${key}`)),Object.entries(LEAD_STATUSES).slice(3).map(([key,label])=>button(label,`s:${leadId}:${key}`)),[button("← К заявке",`lead:${leadId}`)]]); }
    else if (/^s:\d+:[a-z_]+$/.test(data)) { const [, raw, status] = data.split(":"); const leadId=Number(raw); if (Object.hasOwn(LEAD_STATUSES, status) && getLead(db,leadId)) { db.prepare("UPDATE leads SET status=?,updated_at=? WHERE id=?").run(status,Date.now(),leadId); reply(leadCard(db,id,leadId)); } else say("Статус или заявка не найдены."); }
    else if (/^(note|order|remind):\d+$/.test(data)) {
      const [action, raw] = data.split(":"); const leadId=Number(raw);
      if (!getLead(db,leadId)) say("Заявка не найдена.");
      else if (action === "remind") { clearSession(); say("Когда напомнить? Время указывается по Москве.", [[button("Через час",`r:${leadId}:hour`),button("Завтра в 10:00",`r:${leadId}:tomorrow`)], [button("Другая дата",`r:${leadId}:custom`)], [button("← К заявке",`lead:${leadId}`)]]); }
      else { setSession(action,leadId); say(action === "note" ? "Напишите заметку к заявке (до 500 символов). Отмена: /cancel" : "Введите название заказа и при необходимости сумму в рублях через |. Например: Монтаж вентиляции | 150000\nОтмена: /cancel"); }
    }
    else if (/^r:\d+:(hour|tomorrow|custom)$/.test(data)) { const [, raw, choice]=data.split(":"); const leadId=Number(raw); if (!getLead(db,leadId)) say("Заявка не найдена."); else if (choice === "custom") { setSession("remind",leadId); say("Введите дату и время по Москве: ДД.ММ.ГГГГ ЧЧ:ММ | текст. Текст после | можно не указывать. Отмена: /cancel"); } else { const due=choice === "hour" ? Date.now()+3600_000 : tomorrowAtTen(Date.now()); addReminder(db,id,leadId,due,"Связаться с клиентом"); say(`Напоминание установлено на ${formatDate(due)} МСК.`); reply(leadCard(db,id,leadId)); } }
    else if (/^cancelrem:\d+$/.test(data)) { const rid=Number(data.split(":")[1]); const rem=db.prepare("SELECT * FROM reminders WHERE id=? AND admin_id=?").get(rid,id) as ReminderRow | undefined; if (!rem || rem.status !== "pending") say("Напоминание не найдено или уже выполнено."); else { const changed=db.prepare("UPDATE outbox SET state='cancelled' WHERE reminder_id=? AND state='pending'").run(rid); if (!changed.changes) say("Напоминание уже отправляется или отправлено."); else { db.prepare("UPDATE reminders SET status='cancelled' WHERE id=?").run(rid); say("Напоминание отменено."); reply(leadCard(db,id,rem.lead_id)); } } }
    else if (/^ordercard:\d+$/.test(data)) reply(orderCard(db,id,Number(data.split(":")[1])));
    else if (/^os:\d+:[a-z_]+$/.test(data)) { const [,raw,status]=data.split(":"); const orderId=Number(raw); if (Object.hasOwn(ORDER_STATUSES, status) && getOrder(db,orderId)) { db.prepare("UPDATE orders SET status=?,updated_at=? WHERE id=?").run(status,Date.now(),orderId); reply(orderCard(db,id,orderId)); } else say("Статус или заказ не найдены."); }
    else if (text) say("Используйте /leads, /orders, /reminders, /search или /help.");
    return { accepted: true, callbackId: callback?.id };
  });
}
