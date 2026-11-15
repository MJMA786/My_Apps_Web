import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data and upload directories exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const uploadsDir = path.join(__dirname, 'uploads');
const iconsDir = path.join(uploadsDir, 'icons');
const screenshotsDir = path.join(uploadsDir, 'screenshots');
const filesDir = path.join(uploadsDir, 'files');

[uploadsDir, iconsDir, screenshotsDir, filesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const dbPath = path.join(dataDir, 'myapps.db');
const db = new DatabaseSync(dbPath);

// Initialize Tables
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT DEFAULT 'Administrator',
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );

    CREATE TABLE IF NOT EXISTS apps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      tagline TEXT,
      description TEXT,
      category TEXT NOT NULL,
      platform TEXT NOT NULL,
      version TEXT DEFAULT '1.0.0',
      developer TEXT DEFAULT 'Admin Developer',
      website_url TEXT,
      icon_url TEXT,
      file_url TEXT,
      file_name TEXT,
      file_size TEXT,
      is_external_link INTEGER DEFAULT 0,
      external_download_url TEXT,
      screenshots TEXT DEFAULT '[]',
      features TEXT DEFAULT '[]',
      system_requirements TEXT DEFAULT '',
      changelog TEXT DEFAULT '',
      is_featured INTEGER DEFAULT 0,
      status TEXT DEFAULT 'published',
      download_count INTEGER DEFAULT 0,
      rating REAL DEFAULT 4.9,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS download_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
    );
  `);

  // Migrations for Google Drive cloud storage support
  const tableInfo = db.prepare('PRAGMA table_info(apps)').all();
  const columnNames = tableInfo.map(c => c.name);
  if (!columnNames.includes('drive_file_id')) {
    db.exec('ALTER TABLE apps ADD COLUMN drive_file_id TEXT');
  }
  if (!columnNames.includes('drive_icon_id')) {
    db.exec('ALTER TABLE apps ADD COLUMN drive_icon_id TEXT');
  }
  if (!columnNames.includes('drive_screenshot_ids')) {
    db.exec("ALTER TABLE apps ADD COLUMN drive_screenshot_ids TEXT DEFAULT '[]'");
  }

  // Seed default admin if none exists
  const checkAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!checkAdmin) {
    const defaultUser = process.env.ADMIN_DEFAULT_USER || 'admin';
    const defaultPass = process.env.ADMIN_DEFAULT_PASS || 'admin123';
    const hash = bcrypt.hashSync(defaultPass, 10);
    db.prepare(`
      INSERT INTO users (username, password_hash, display_name, role)
      VALUES (?, ?, ?, ?)
    `).run(defaultUser, hash, 'Main Administrator', 'admin');
    console.log(`[DB] Admin account verified: "${defaultUser}"`);
  }
}

initDatabase();

export { db, uploadsDir, iconsDir, screenshotsDir, filesDir };
