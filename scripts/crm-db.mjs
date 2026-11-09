// Обслуживание базы заявок. Запуск: node --env-file=/etc/ventcore/crm.env scripts/crm-db.mjs <команда>
//   list                      — список резервных копий
//   check                     — проверить целостность рабочей базы
//   backup                    — сделать проверенную копию сейчас (например, перед выпуском новой версии)
//   restore <файл> --yes      — вернуть базу из копии. ПЕРЕД ЭТИМ ОСТАНОВИТЕ САЙТ: systemctl stop ventcore
// Содержимое заявок скрипт никогда не выводит.
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dbPath = process.env.CRM_DB_PATH?.trim() || join(process.cwd(), 'data', 'crm.sqlite');
const dir = process.env.CRM_BACKUP_DIR?.trim() || join(dirname(dbPath), 'backups');
if (!isAbsolute(dbPath) || !isAbsolute(dir)) { console.error('CRM_DB_PATH и CRM_BACKUP_DIR должны быть абсолютными путями.'); process.exit(1); }

const NAME = /^crm-(\d{8})-(\d{6})-([a-z-]+)\.sqlite$/;
const stamp = () => new Date().toISOString().replace(/\D/g, '').slice(0, 14).replace(/^(\d{8})/, '$1-');
const backups = () => (existsSync(dir) ? readdirSync(dir).filter((f) => NAME.test(f)).sort().reverse() : []);

function healthy(path, readOnly = true) {
  let db;
  try {
    db = new DatabaseSync(path, { readOnly });
    const check = db.prepare('PRAGMA quick_check').all();
    return check.length === 1 && Object.values(check[0])[0] === 'ok' && db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name='leads'").get() !== undefined;
  } catch { return false; } finally { try { db?.close(); } catch { /* закрыта */ } }
}

const [command, argument] = process.argv.slice(2);

if (command === 'list') {
  const files = backups();
  if (!files.length) console.log(`Копий нет (папка ${dir}).`);
  for (const file of files) console.log(`${file}  ${(statSync(join(dir, file)).size / 1024).toFixed(0)} КБ  ${healthy(join(dir, file)) ? 'исправна' : 'ПОВРЕЖДЕНА'}`);
} else if (command === 'check') {
  if (!existsSync(dbPath)) { console.error('Файл базы не найден.'); process.exit(1); }
  const ok = healthy(dbPath, false);
  console.log(ok ? 'База исправна.' : 'БАЗА ПОВРЕЖДЕНА. Остановите сайт и выполните restore из последней исправной копии.');
  process.exitCode = ok ? 0 : 1;
} else if (command === 'backup') {
  if (!existsSync(dbPath)) { console.error('Файл базы не найден.'); process.exit(1); }
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  const target = join(dir, `crm-${stamp()}-manual.sqlite`);
  const db = new DatabaseSync(dbPath);
  try { db.prepare('VACUUM INTO ?').run(`${target}.tmp`); } finally { db.close(); }
  chmodSync(`${target}.tmp`, 0o600);
  if (!healthy(`${target}.tmp`)) { rmSync(`${target}.tmp`, { force: true }); console.error('Копия не прошла проверку и удалена.'); process.exit(1); }
  renameSync(`${target}.tmp`, target);
  console.log(`Копия создана: ${basename(target)}`);
} else if (command === 'restore') {
  const source = argument && NAME.test(basename(argument)) ? join(dir, basename(argument)) : null;
  if (!source || !existsSync(source)) { console.error('Укажите имя файла копии из команды list.'); process.exit(1); }
  if (!healthy(source)) { console.error('Эта копия повреждена — выберите другую.'); process.exit(1); }
  if (!process.argv.includes('--yes')) { console.error('Текущая база будет заменена (её файлы сохранятся рядом с суффиксом .before-restore-…). Повторите команду с --yes, предварительно остановив сайт.'); process.exit(1); }
  const suffix = `.before-restore-${stamp()}`;
  for (const part of ['', '-wal', '-shm']) if (existsSync(dbPath + part)) renameSync(dbPath + part, dbPath + suffix + part);
  mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
  copyFileSync(source, dbPath);
  chmodSync(dbPath, 0o600);
  console.log(`База восстановлена из ${basename(source)}. Прежние файлы сохранены как ${basename(dbPath)}${suffix}*. Запустите сайт.`);
} else {
  console.error('Команды: list | check | backup | restore <файл> --yes');
  process.exit(1);
}
