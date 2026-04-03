import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH || join(__dirname, "data", "minicrm.sqlite");

mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    client_name TEXT NOT NULL,
    client_phone TEXT,
    service_id TEXT NOT NULL,
    start_iso TEXT NOT NULL,
    end_iso TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TEXT NOT NULL
  );
`);

export function getDbPath() {
  return dbPath;
}

export function listAppointments() {
  return db
    .prepare(
      `SELECT id, client_name AS clientName, client_phone AS clientPhone,
              service_id AS serviceId, start_iso AS "start", end_iso AS "end",
              status, created_at AS createdAt
       FROM appointments ORDER BY datetime(created_at) DESC`
    )
    .all();
}

export function insertAppointment(row) {
  db.prepare(
    `INSERT INTO appointments (id, client_name, client_phone, service_id, start_iso, end_iso, status, created_at)
     VALUES (@id, @clientName, @clientPhone, @serviceId, @start, @end, @status, @createdAt)`
  ).run({
    id: row.id,
    clientName: row.clientName,
    clientPhone: row.clientPhone,
    serviceId: row.serviceId,
    start: row.start,
    end: row.end,
    status: row.status,
    createdAt: row.createdAt,
  });
}
