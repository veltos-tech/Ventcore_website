// Проверка защиты базы заявок: копия, проверка целостности, восстановление, отказ при порче.
// Запуск: npm run test:db  (в CI выполняется перед каждой сборкой). Работает только во временной папке.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = mkdtempSync(join(tmpdir(), 'ventcore-db-test-'));
const dbPath = join(root, 'crm.sqlite');
const backups = join(root, 'backups');
const env = { ...process.env, CRM_DB_PATH: dbPath, CRM_BACKUP_DIR: backups };
const cli = (...args) => spawnSync(process.execPath, ['scripts/crm-db.mjs', ...args], { env, encoding: 'utf8' });
const countLeads = (path) => {
  const db = new DatabaseSync(path, { readOnly: true });
  try { return db.prepare('SELECT count(*) AS n FROM leads').get().n; } finally { db.close(); }
};

try {
  // Рабочая база с двумя заявками.
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL; CREATE TABLE leads (id INTEGER PRIMARY KEY, name TEXT);');
  db.exec("INSERT INTO leads (name) VALUES ('first'), ('second');");
  db.close();

  assert.equal(cli('check').status, 0, 'исправная база должна проходить проверку');

  const made = cli('backup');
  assert.equal(made.status, 0, `backup: ${made.stderr}`);
  const files = readdirSync(backups).filter((f) => f.endsWith('.sqlite'));
  assert.equal(files.length, 1, 'должна появиться ровно одна копия');
  assert.equal(readdirSync(backups).some((f) => f.endsWith('.tmp')), false, 'временных файлов быть не должно');
  assert.match(cli('list').stdout, /исправна/);

  // Порча рабочей базы обнаруживается...
  writeFileSync(dbPath, Buffer.alloc(4096, 7));
  assert.notEqual(cli('check').status, 0, 'повреждённая база должна быть обнаружена');

  // ...восстановление без --yes ничего не меняет, с --yes возвращает данные.
  assert.notEqual(cli('restore', files[0]).status, 0, 'restore без --yes должен отказать');
  const restored = cli('restore', files[0], '--yes');
  assert.equal(restored.status, 0, `restore: ${restored.stderr}`);
  assert.equal(cli('check').status, 0);
  assert.equal(countLeads(dbPath), 2, 'после восстановления заявки на месте');

  // Повреждённую копию восстановить нельзя; путь вне папки копий — тоже.
  writeFileSync(join(backups, files[0]), Buffer.alloc(4096, 3));
  assert.notEqual(cli('restore', files[0], '--yes').status, 0, 'повреждённая копия не должна восстанавливаться');
  assert.notEqual(cli('restore', '../../etc/passwd', '--yes').status, 0, 'посторонний путь должен отклоняться');

  console.log('Защита базы: все проверки пройдены.');
} finally {
  rmSync(root, { recursive: true, force: true });
}
