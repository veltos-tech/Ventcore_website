import "server-only";

import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { dirname, isAbsolute, join, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";

// Резервные копии и восстановление базы заявок.
// Копия делается через VACUUM INTO: SQLite сам создаёт согласованный снимок,
// даже если в базу в этот момент пишут. Каждая копия проверяется и только
// потом получает окончательное имя, поэтому «полуготовых» копий не бывает.

/** Путь к базе. В production — только абсолютный и вне папки приложения. */
export function dbPath() {
  const configured = process.env.CRM_DB_PATH?.trim();
  const production = process.env.NODE_ENV === "production";
  if (production && (!configured || !isAbsolute(configured))) {
    throw new Error("CRM_DB_PATH must be an absolute persistent path in production");
  }
  const path = configured || join(process.cwd(), "data", "crm.sqlite");
  // Папка приложения при каждом выпуске новой версии пересоздаётся — база внутри неё пропала бы.
  if (production && (path === process.cwd() || path.startsWith(process.cwd() + sep))) {
    throw new Error("CRM_DB_PATH must be outside the application directory, otherwise a deploy can erase the database");
  }
  return path;
}

function backupDir() {
  const configured = process.env.CRM_BACKUP_DIR?.trim();
  if (configured && !isAbsolute(configured)) throw new Error("CRM_BACKUP_DIR must be an absolute path");
  return configured || join(dirname(dbPath()), "backups");
}

type BackupReason = "scheduled" | "manual" | "startup" | "pre-migration" | "pre-restore";
export type BackupInfo = { file: string; path: string; time: number; reason: string };

const NAME = /^crm-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-([a-z-]+)\.sqlite$/;
const HOUR = 3600_000;
const DAY = 24 * HOUR;

export const stamp = (time = Date.now()) => new Date(time).toISOString().replace(/\D/g, "").slice(0, 14).replace(/^(\d{8})/, "$1-");

/** Копии от новых к старым. Чужие файлы в папке игнорируются. */
function listBackups(): BackupInfo[] {
  const dir = backupDir();
  if (!existsSync(dir)) return [];
  const result: BackupInfo[] = [];
  for (const file of readdirSync(dir)) {
    const match = NAME.exec(file);
    if (!match) continue;
    const [, y, mo, d, h, mi, s, reason] = match;
    result.push({ file, path: join(dir, file), time: Date.UTC(+y, +mo - 1, +d, +h, +mi, +s), reason });
  }
  return result.sort((a, b) => b.time - a.time);
}

/** Целостность файла: структура базы не повреждена и таблица заявок на месте. */
function isHealthyDatabase(path: string) {
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(path, { readOnly: true });
    const check = db.prepare("PRAGMA quick_check").all();
    const ok = check.length === 1 && Object.values(check[0])[0] === "ok";
    return ok && db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='leads'").get() !== undefined;
  } catch {
    return false;
  } finally {
    try { db?.close(); } catch { /* уже закрыта */ }
  }
}

let running = false;

/** Создаёт проверенную копию. null — копия не понадобилась (уже идёт другая или имя занято). */
export function createBackup(db: DatabaseSync, reason: BackupReason): BackupInfo | null {
  if (running) return null;
  running = true;
  try {
    const dir = backupDir();
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    chmodSync(dir, 0o700);
    const file = `crm-${stamp()}-${reason}.sqlite`;
    const path = join(dir, file);
    if (existsSync(path)) return null;
    const temporary = `${path}.tmp`;
    rmSync(temporary, { force: true });
    try {
      db.prepare("VACUUM INTO ?").run(temporary);
      chmodSync(temporary, 0o600);
      if (!isHealthyDatabase(temporary)) throw new Error("Backup verification failed");
      // Окончательное имя копия получает только после проверки (переименование атомарно).
      renameSync(temporary, path);
    } finally {
      rmSync(temporary, { force: true });
    }
    rotate();
    return { file, path, time: Date.now(), reason };
  } finally {
    running = false;
  }
}

function intervalMs() {
  const hours = Number(process.env.CRM_BACKUP_INTERVAL_HOURS);
  return (Number.isFinite(hours) && hours >= 1 && hours <= 168 ? hours : 1) * HOUR;
}

/** Плановая копия: раз в CRM_BACKUP_INTERVAL_HOURS (по умолчанию каждый час). */
export function ensureScheduledBackup(db: DatabaseSync) {
  const latest = listBackups().find((backup) => backup.reason === "scheduled" || backup.reason === "manual" || backup.reason === "startup");
  if (latest && Date.now() - latest.time < intervalMs()) return null;
  return createBackup(db, "scheduled");
}

/**
 * Что хранится: все копии за последние 48 часов, затем по одной в сутки до 30 дней
 * (это совпадает со сроком уничтожения данных в политике конфиденциальности),
 * плюс пять последних копий перед обновлением схемы или восстановлением.
 */
function rotate() {
  const now = Date.now();
  const keep = new Set<string>();
  const days = new Set<string>();
  let events = 0;
  const all = listBackups();
  if (all[0]) keep.add(all[0].file);
  for (const backup of all) {
    const age = now - backup.time;
    if (backup.reason === "pre-migration" || backup.reason === "pre-restore") {
      if (events++ < 5) keep.add(backup.file);
      continue;
    }
    const day = new Date(backup.time).toISOString().slice(0, 10);
    if (age < 2 * DAY) keep.add(backup.file);
    else if (age < 30 * DAY && !days.has(day)) keep.add(backup.file);
    days.add(day);
  }
  for (const backup of all) if (!keep.has(backup.file)) rmSync(backup.path, { force: true });
}

/** Кладёт по пути target новейшую исправную копию. null — подходящей копии нет. */
export function restoreLatestBackup(target: string): BackupInfo | null {
  for (const backup of listBackups()) {
    if (!isHealthyDatabase(backup.path)) continue;
    rmSync(`${target}-wal`, { force: true });
    rmSync(`${target}-shm`, { force: true });
    copyFileSync(backup.path, target);
    chmodSync(target, 0o600);
    return backup;
  }
  return null;
}
