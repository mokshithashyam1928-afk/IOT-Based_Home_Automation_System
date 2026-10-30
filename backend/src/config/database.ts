import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_FILE_PATH = path.resolve(process.cwd(), 'database', 'iot_home_automation.sqlite');
const SCHEMA_FILE_PATH = path.resolve(process.cwd(), 'database', 'schema.sql');
const SEED_FILE_PATH = path.resolve(process.cwd(), 'database', 'seed.sql');

let dbInstance: Database | null = null;

export async function initDatabase(): Promise<Database> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  const dbDir = path.dirname(DB_FILE_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  let isNewDb = false;
  if (fs.existsSync(DB_FILE_PATH)) {
    const fileBuffer = fs.readFileSync(DB_FILE_PATH);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
    isNewDb = true;
  }

  // Enable foreign keys
  dbInstance.run('PRAGMA foreign_keys = ON;');

  // Always ensure schema exists
  const schemaSql = fs.readFileSync(SCHEMA_FILE_PATH, 'utf-8');
  dbInstance.run(schemaSql);

  // Check if users or devices are empty to run initial seed
  const countRes = dbInstance.exec('SELECT COUNT(*) as cnt FROM devices;');
  const deviceCount = countRes[0]?.values?.[0]?.[0] as number || 0;

  if (isNewDb || deviceCount === 0) {
    // Seed default users with real bcrypt hashes
    const adminHash = bcrypt.hashSync('admin123', 10);
    const userHash = bcrypt.hashSync('user123', 10);

    dbInstance.run(
      `INSERT OR IGNORE INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?), (?, ?, ?, ?, ?);`,
      [
        1, 'Dr. Elena Vance (Lead SQA Architect)', 'admin@nexushome.io', adminHash, 'ADMIN',
        2, 'Marcus Sterling (Home Resident)', 'operator@nexushome.io', userHash, 'USER'
      ]
    );

    const seedSql = fs.readFileSync(SEED_FILE_PATH, 'utf-8');
    dbInstance.run(seedSql);

    // Seed historical sensor readings & energy usage over the last 18 intervals so charts have immediate rich SQL history
    seedHistoricalTelemetry(dbInstance);
    persistDatabase();
  }

  return dbInstance;
}

function seedHistoricalTelemetry(db: Database) {
  const now = Date.now();
  for (let i = 18; i >= 0; i--) {
    const timestamp = new Date(now - i * 5 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    const temp = Number((25.8 + Math.sin(i * 0.4) * 2.1 + (i === 0 ? 1.5 : 0)).toFixed(1));
    const hum = Number((58 + Math.cos(i * 0.35) * 6).toFixed(1));
    const light = Math.round(410 + Math.sin(i * 0.5) * 90);
    const motion = i % 3 === 0 ? 1 : 0;
    const watts = Number((1380 + Math.sin(i * 0.45) * 240).toFixed(1));
    const kwh = Number((watts / 1000 * 0.25).toFixed(3));
    const cost = Number((kwh * 0.16).toFixed(4));

    db.run(
      `INSERT INTO sensor_readings (device_id, room_id, sensor_type, value, unit, mqtt_topic, latency_ms, recorded_at)
       VALUES (?, ?, 'TEMPERATURE', ?, '°C', 'home/sensor/temperature', ?, ?),
              (?, ?, 'HUMIDITY', ?, '%', 'home/sensor/humidity', ?, ?),
              (?, ?, 'LIGHT', ?, 'lux', 'home/sensor/light', ?, ?),
              (?, ?, 'MOTION', ?, 'boolean', 'home/sensor/motion', ?, ?),
              (?, ?, 'ENERGY', ?, 'W', 'home/sensor/energy', ?, ?);`,
      [
        2, 1, temp, 11 + (i % 5), timestamp,
        3, 1, hum, 10 + (i % 4), timestamp,
        1, 1, light, 9 + (i % 6), timestamp,
        12, 6, motion, 12 + (i % 5), timestamp,
        6, 3, watts, 13 + (i % 4), timestamp,
      ]
    );

    db.run(
      `INSERT INTO energy_usage (device_id, room_id, power_watts, energy_kwh, cost_usd, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [2, 1, watts, kwh, cost, timestamp]
    );
  }

  db.run(
    `INSERT INTO activity_logs (actor, action_type, entity_type, entity_id, details, protocol, latency_ms)
     VALUES 
      ('IOT_SIMULATOR', 'TELEMETRY_SYNC', 'SENSOR', 2, 'Published initial MQTT sensor batch to SQL storage', 'MQTT/QoS1', 11),
      ('AUTOMATION_ENGINE', 'RULE_EXECUTION', 'RULE', 1, 'Evaluated High Thermal Load Cooling -> Fan ON', 'MQTT+WS', 14),
      ('SYSTEM_BOOT', 'SCHEMA_INIT', 'DATABASE', 1, 'Relational SQL database tables and indexes verified', 'SQL/ACID', 6);`
  );
}

export function getDb(): Database {
  if (!dbInstance) {
    throw new Error('SQL Database has not been initialized yet. Call initDatabase() first.');
  }
  return dbInstance;
}

export function persistDatabase(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    fs.writeFileSync(DB_FILE_PATH, Buffer.from(data));
  } catch (err) {
    console.error('Failed to persist SQLite database to disk:', err);
  }
}

export function queryAll<T = Record<string, any>>(sql: string, params: any[] = []): T[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = Record<string, any>>(sql: string, params: any[] = []): T | null {
  const rows = queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function executeSql(sql: string, params: any[] = []): { lastInsertRowid: number; changes: number } {
  const db = getDb();
  db.run(sql, params);
  const lastIdRes = db.exec('SELECT last_insert_rowid() as id;');
  const changesRes = db.exec('SELECT changes() as cnt;');
  const lastInsertRowid = Number(lastIdRes[0]?.values?.[0]?.[0] ?? 0);
  const changes = Number(changesRes[0]?.values?.[0]?.[0] ?? 0);
  persistDatabase();
  return { lastInsertRowid, changes };
}
