// HTML-виджеты Telegram (Bot API 10.4). Модуль без импортов: его проверяет scripts/test-widgets.mjs.
//
// Правила платформы (core.telegram.org/bots/widgets): один HTML-документ с inline CSS/JS, до 32 768 байт
// и до 4 096 байт после zlib; без сети, внешних файлов и полей ввода; картинки только data: или inline SVG;
// состояние (chat_data) — до 1 024 байт; запрос боту — TelegramWidget.request(data), data до 64 байт.
// Домен и хостинг не нужны: HTML передаётся прямо в сообщении, поэтому виджет «живёт» внутри бота.

/** Порядок статусов в данных виджета: индекс в массиве n и в списке заявок. */
export const STATUS_ORDER = ["new", "contacted", "in_progress", "proposal", "won", "lost"] as const;

export type DashboardState = {
  /** Количество заявок по статусам в порядке STATUS_ORDER. */
  counts: number[];
  today: number;
  week: number;
  /** Напоминаний на сегодня. */
  reminders: number;
  /** Время обновления, например «10.11 18:30». */
  updated: string;
  /** Последние заявки: id, имя, индекс статуса. */
  leads: { id: number; name: string; status: number }[];
};

export const DASHBOARD_HTML = `<style>
.w{font-size:14px;line-height:1.3;color:var(--tg-theme-text-color,#111);padding:10px 10px max(10px,env(safe-area-inset-bottom))}
.h{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
.h b{font-size:16px}.h span,.k,.t i{color:var(--tg-theme-hint-color,#8a8a8a)}.h span{font-size:12px}
.g{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.t{background:var(--tg-theme-secondary-bg-color,#eef2f7);border-radius:10px;padding:7px 2px;text-align:center}
.t b{display:block;font-size:20px;line-height:1.1}.t i{display:block;font-style:normal;font-size:10px}
.bar{display:flex;height:8px;border-radius:4px;overflow:hidden;margin:10px 0 5px;background:var(--tg-theme-secondary-bg-color,#eef2f7)}
.bar div{height:100%}
.lg{display:flex;flex-wrap:wrap;gap:2px 10px;font-size:11px}
.k i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px}
.rm{display:none;margin-top:8px;font-size:12px;color:var(--tg-theme-accent-text-color,#0377c9)}
.r{display:flex;justify-content:space-between;gap:8px;width:100%;margin:0;padding:8px 2px;background:none;border:0;border-top:1px solid var(--tg-theme-section-separator-color,#dde3ea);border-radius:0;color:inherit;font-size:14px;text-align:left}
.r span:first-child{flex:1}.s{font-size:12px}
.f{display:flex;gap:8px;margin-top:8px}
.f button{flex:1;padding:9px 0;border:0;border-radius:10px;font-size:14px;background:var(--tg-theme-button-color,#0377c9);color:var(--tg-theme-button-text-color,#fff)}
.f .o{background:var(--tg-theme-secondary-bg-color,#eef2f7);color:var(--tg-theme-text-color,#111)}
</style>
<div class="w">
<div class="h"><b>VentCore · заявки</b><span id="u"></span></div>
<div class="g">
<div class="t"><b id="a">0</b><i>Новые</i></div>
<div class="t"><b id="b">0</b><i>В работе</i></div>
<div class="t"><b id="c">0</b><i>Сегодня</i></div>
<div class="t"><b id="d">0</b><i>7 дней</i></div>
</div>
<div class="bar" id="bar"></div>
<div class="lg" id="lg"></div>
<div class="rm" id="rm"></div>
<div id="ls"></div>
<div class="f"><button id="all">Все заявки</button><button class="o" id="rf">Обновить</button></div>
</div>
<script>
const W = window.TelegramWidget || {};
const S = ["Новые", "Связались", "В работе", "Предложение", "Успешно", "Отказ"];
const C = ["#3b82f6", "#06b6d4", "#f59e0b", "#8b5cf6", "#22c55e", "#ef4444"];
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
// Запрос боту — только из обработчика нажатия; бот отвечает новым сообщением или обновляет данные виджета.
const ask = (data, done) => {
  if (!W.request) return;
  if (W.HapticFeedback) W.HapticFeedback.selectionChanged();
  W.request(data).then(done || (() => {}), () => {});
};
function draw() {
  let s = {};
  try { s = JSON.parse(W.chatData || "{}"); } catch (e) {}
  const n = s.n || [0, 0, 0, 0, 0, 0];
  const sum = n.reduce((x, y) => x + y, 0);
  $("a").textContent = n[0]; $("b").textContent = n[2]; $("c").textContent = s.t || 0; $("d").textContent = s.w || 0;
  $("u").textContent = s.u || "";
  const bar = $("bar"), lg = $("lg"), ls = $("ls");
  bar.textContent = ""; lg.textContent = ""; ls.textContent = "";
  n.forEach((v, i) => {
    if (!v) return;
    const seg = el("div"); seg.style.width = (100 * v / sum) + "%"; seg.style.background = C[i]; bar.appendChild(seg);
    const k = el("span", "k"); const dot = el("i"); dot.style.background = C[i];
    k.appendChild(dot); k.appendChild(document.createTextNode(S[i] + " " + v)); lg.appendChild(k);
  });
  const rm = $("rm");
  rm.style.display = s.r ? "block" : "none";
  rm.textContent = "⏰ Напоминаний на сегодня: " + (s.r || 0);
  rm.onclick = () => ask("menu:reminders");
  (s.l || []).forEach((r) => {
    const row = el("button", "r"); const st = el("span", "s", S[r[2]] || ""); st.style.color = C[r[2]] || "";
    row.appendChild(el("span", "", "#" + r[0] + " " + r[1])); row.appendChild(st);
    row.addEventListener("click", () => ask("open:" + r[0]));
    ls.appendChild(row);
  });
}
$("all").addEventListener("click", () => ask("menu:leads"));
$("rf").addEventListener("click", () => {
  ask("dash:refresh", () => { $("rf").textContent = "Обновлено ✓"; setTimeout(() => { $("rf").textContent = "Обновить"; }, 1500); });
});
if (W.onEvent) W.onEvent("chatDataChanged", draw);
draw();
if (W.ready) W.ready();
</script>`;

export const WELCOME_HTML = `<style>
.w{color:var(--tg-theme-text-color,#111);padding:0 0 max(10px,env(safe-area-inset-bottom))}
.hd{padding:16px 14px 14px;color:#fff;border-radius:12px 12px 0 0;background:linear-gradient(135deg,#062647,#0377c9)}
.hd b{display:block;font-size:22px;letter-spacing:.5px}
.hd span{display:block;margin-top:6px;font-size:13px;line-height:1.35;color:#d6e8f7}
.bd{padding:12px 12px 0}
.p{margin:0 0 8px;font-size:12px;color:var(--tg-theme-hint-color,#8a8a8a)}
.c{display:flex;flex-wrap:wrap;gap:6px}
.c i{font-style:normal;font-size:12px;padding:4px 9px;border-radius:999px;background:var(--tg-theme-secondary-bg-color,#eef2f7)}
.f{display:flex;flex-direction:column;gap:8px;margin-top:14px}
.f button{padding:11px 0;border:0;border-radius:12px;font-size:15px;background:var(--tg-theme-button-color,#0377c9);color:var(--tg-theme-button-text-color,#fff)}
.f .o{background:var(--tg-theme-secondary-bg-color,#eef2f7);color:var(--tg-theme-text-color,#111)}
</style>
<div class="w">
<div class="hd"><b>VentCore</b><span>Проектирование, поставка, монтаж и сервис вентиляции и кондиционирования</span></div>
<div class="bd">
<p class="p">Работаем с оборудованием</p>
<div class="c"><i>Daikin</i><i>Samsung</i><i>Haier</i><i>Hisense</i><i>Midea</i><i>Kentatsu</i><i>General Climate</i><i>MDV</i></div>
<div class="f"><button id="n">Оставить заявку</button><button class="o" id="m">Связаться с менеджером</button></div>
</div>
</div>
<script>
const W = window.TelegramWidget || {};
const ask = (data) => { if (W.request) { if (W.HapticFeedback) W.HapticFeedback.selectionChanged(); W.request(data).then(() => {}, () => {}); } };
document.getElementById("n").addEventListener("click", () => ask("client:new"));
document.getElementById("m").addEventListener("click", () => ask("client:manager"));
if (W.ready) W.ready();
</script>`;

/** Лимит Telegram на chat_data — 1024 байта; оставляем запас. */
export const WIDGET_DATA_LIMIT = 1000;

const bytes = (text: string) => new TextEncoder().encode(text).length;

/** Данные для виджета-сводки. Если не помещаются в лимит, убираются самые старые заявки в списке. */
export function encodeDashboard(state: DashboardState): string {
  const leads = state.leads.slice(0, 5).map((lead) => [lead.id, Array.from(lead.name).slice(0, 14).join(""), lead.status] as const);
  const build = () => JSON.stringify({ n: state.counts, t: state.today, w: state.week, r: state.reminders, u: state.updated, l: leads });
  let json = build();
  while (bytes(json) > WIDGET_DATA_LIMIT && leads.length) {
    leads.pop();
    json = build();
  }
  return json;
}
