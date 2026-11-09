import "server-only";

import { chmodSync, closeSync, existsSync, mkdirSync, openSync, fchmodSync, renameSync, rmSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createBackup, dbPath, restoreLatestBackup, stamp } from "./backup";

// База заявок: SQLite в режиме WAL с полной синхронизацией на диск.
// Что защищает данные:
//  · synchronous=FULL — подтверждённая транзакция не теряется даже при отключении питания;
//  · проверка целостности при запуске и автоматическое восстановление из копии;
//  · если файла базы нет (например, диск пересоздан), а копии есть — база поднимается из копии,
//    а не создаётся пустой;
//  · версия схемы в PRAGMA user_version, перед обновлением схемы делается копия;
//  · плановые копии каждые несколько часов — см. backup.ts и tick-маршрут.

const LATEST_SCHEMA = 2;

const BASELINE = `
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT,
      status TEXT NOT NULL DEFAULT 'new', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER NOT NULL REFERENCES leads(id),
      admin_id TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER NOT NULL REFERENCES leads(id),
      title TEXT NOT NULL, amount INTEGER, status TEXT NOT NULL DEFAULT 'new',
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, lead_id INTEGER NOT NULL REFERENCES leads(id),
      admin_id TEXT NOT NULL, text TEXT NOT NULL, due_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      admin_id TEXT PRIMARY KEY, action TEXT NOT NULL, lead_id INTEGER NOT NULL REFERENCES leads(id),
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS telegram_updates (id INTEGER PRIMARY KEY, received_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT, job_key TEXT NOT NULL UNIQUE,
      chat_id TEXT NOT NULL, payload TEXT NOT NULL, reminder_id INTEGER REFERENCES reminders(id),
      state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
      available_at INTEGER NOT NULL, lease_until INTEGER, sent_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS outbox_due ON outbox(state, available_at, lease_until);
    CREATE INDEX IF NOT EXISTS leads_recent ON leads(created_at DESC);
    CREATE INDEX IF NOT EXISTS reminders_due ON reminders(status, due_at);
    CREATE TABLE IF NOT EXISTS rate_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS client_sessions (
      user_id TEXT PRIMARY KEY, step TEXT NOT NULL, name TEXT, phone TEXT, description TEXT, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_search_sessions (admin_id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
`;

type Migration = { version: number; up: (db: DatabaseSync) => void };

// Миграции только добавляются; уже выпущенные не редактируются.
// Базы, созданные до появления версионирования (user_version = 0), безопасно проходят
// версию 1: все её операторы — IF NOT EXISTS.
const MIGRATIONS: Migration[] = [
  { version: 1, up: (db) => db.exec(BASELINE) },
  {
    version: 2, // очередь исходящих: адресат — админ или клиент
    up: (db) => {
      const columns = db.prepare("PRAGMA table_info(outbox)").all() as { name: string }[];
      if (!columns.some((column) => column.name === "audience")) db.exec("ALTER TABLE outbox ADD COLUMN audience TEXT NOT NULL DEFAULT 'admin'");
    },
  },
];

const row = (db: DatabaseSync, sql: string) => db.prepare(sql).get() as Record<string, number | string> | undefined;

function migrate(db: DatabaseSync) {
  const current = Number(row(db, "PRAGMA user_version")?.user_version ?? 0);
  if (current > LATEST_SCHEMA) throw new Error("CRM database was created by a newer version of the application; refusing to open it");
  if (current === LATEST_SCHEMA) return;
  // Есть данные и схема будет меняться — сначала копия.
  if (row(db, "SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='leads'")) createBackup(db, "pre-migration");
  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    db.exec("BEGIN IMMEDIATE");
    try {
      migration.up(db);
      db.exec(`PRAGMA user_version = ${migration.version}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

function open(path: string) {
  const db = new DatabaseSync(path);
  db.function("crm_lower", { deterministic: true }, (value) => String(value ?? "").toLocaleLowerCase("ru-RU"));
  db.function("crm_digits", { deterministic: true }, (value) => String(value ?? "").replace(/\D/g, ""));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_size_limit = 67108864;
    PRAGMA secure_delete = ON;
    PRAGMA trusted_schema = OFF;
  `);
  return db;
}

const quickCheckPasses = (db: DatabaseSync) => {
  try {
    const result = db.prepare("PRAGMA quick_check").all();
    return result.length === 1 && Object.values(result[0])[0] === "ok";
  } catch {
    return false;
  }
};

function createEmptyFile(path: string) {
  // Файл создаётся с правами только для владельца ещё до того, как его откроет SQLite.
  const fd = openSync(path, "a", 0o600);
  fchmodSync(fd, 0o600);
  closeSync(fd);
}

function openVerified(path: string) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  chmodSync(dirname(path), 0o700);

  // Базы нет (диск пересоздан, файл удалён), а копии есть — поднимаем из копии, а не создаём пустую.
  if (!existsSync(path) || statSync(path).size === 0) {
    const restored = restoreLatestBackup(path);
    if (restored) console.error(`[crm] Файл базы не найден: восстановлено из резервной копии ${restored.file}`);
  }
  createEmptyFile(path);

  let db = open(path);
  if (!quickCheckPasses(db)) {
    try { db.close(); } catch { /* уже закрыта */ }
    // Подходящую копию ищем до того, как трогать повреждённый файл.
    const candidate = `${path}.restoring`;
    rmSync(candidate, { force: true });
    const restored = restoreLatestBackup(candidate);
    if (!restored) throw new Error("CRM database is corrupted and no valid backup was found; see README, section «Восстановление базы»");
    const quarantine = `${path}.corrupt-${stamp()}`;
    for (const suffix of ["", "-wal", "-shm"]) if (existsSync(path + suffix)) renameSync(path + suffix, quarantine + suffix);
    renameSync(candidate, path);
    console.error(`[crm] База повреждена: восстановлена из ${restored.file}; повреждённые файлы сохранены как ${quarantine}*`);
    db = open(path);
    if (!quickCheckPasses(db)) throw new Error("Restored CRM database failed the integrity check");
  }
  migrate(db);
  return db;
}

type Holder = typeof globalThis & { __ventcoreCrm?: DatabaseSync };

/** Одно соединение на процесс (в разработке модуль перезагружается — храним на globalThis). */
export function database() {
  const holder = globalThis as Holder;
  if (holder.__ventcoreCrm) return holder.__ventcoreCrm;
  const db = openVerified(dbPath());
  holder.__ventcoreCrm = db;
  // При остановке сервера дописываем журнал в основной файл и аккуратно закрываем базу.
  process.once("exit", () => {
    try { db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); db.close(); } catch { /* процесс и так завершается */ }
  });
  return db;
}

export function transaction<T>(operation: (db: DatabaseSync) => T): T {
  const db = database();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation(db);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** Уборка: отправленные и отменённые сообщения содержат имена и телефоны — храним 14 дней. */
export function housekeeping() {
  const cutoff = Date.now() - 14 * 86400_000;
  transaction((db) => db.prepare("DELETE FROM outbox WHERE state IN ('sent','cancelled') AND COALESCE(sent_at, available_at) < ?").run(cutoff));
}

export type LeadRow = { id: number; name: string; phone: string; email: string | null; status: string; created_at: number; updated_at: number };
export type OrderRow = { id: number; lead_id: number; title: string; amount: number | null; status: string; created_at: number; updated_at: number };
export type ReminderRow = { id: number; lead_id: number; admin_id: string; text: string; due_at: number; status: string; created_at: number };
