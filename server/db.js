import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = Boolean(process.env.VERCEL);
const baseDir = isVercel ? '/tmp' : __dirname;

// Ensure data and upload directories exist (using /tmp on serverless environments like Vercel)
const dataDir = path.join(baseDir, 'data');
const uploadsDir = path.join(baseDir, 'uploads');
const iconsDir = path.join(uploadsDir, 'icons');
const screenshotsDir = path.join(uploadsDir, 'screenshots');
const filesDir = path.join(uploadsDir, 'files');

[dataDir, uploadsDir, iconsDir, screenshotsDir, filesDir].forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    console.warn('[DB] Warning creating directory:', dir, err.message);
  }
});

const dbPath = path.join(dataDir, 'myapps.db');
let db;
try {
  db = new DatabaseSync(dbPath);
} catch (dbErr) {
  console.warn('[DB] Could not open database file on disk, falling back to memory:', dbErr.message);
  db = new DatabaseSync(':memory:');
}

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

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

  // Restore apps from local disk snapshot if available and database is empty
  try {
    const appCountRow = db.prepare('SELECT count(*) as count FROM apps').get();
    if (!appCountRow || appCountRow.count === 0) {
      const snapshot = loadCatalogSnapshot();
      if (snapshot && Array.isArray(snapshot) && snapshot.length > 0) {
        restoreAppsToDb(snapshot);
        console.log(`[DB] Restored ${snapshot.length} apps from local catalog snapshot.`);
      }
    }
  } catch (err) {
    console.warn('[DB] Could not check snapshot on init:', err.message);
  }
}

initDatabase();

export function getAllAppsFromDb() {
  try {
    return db.prepare('SELECT * FROM apps ORDER BY id ASC').all();
  } catch (e) {
    console.error('[DB] Error getting all apps:', e.message);
    return [];
  }
}

export function restoreAppsToDb(appsList) {
  if (!Array.isArray(appsList) || appsList.length === 0) return false;

  const insertStmt = db.prepare(`
    INSERT INTO apps (
      title, slug, tagline, description, category, platform, version, developer,
      website_url, icon_url, file_url, file_name, file_size, is_external_link,
      external_download_url, screenshots, features, system_requirements, changelog,
      is_featured, status, download_count, rating, drive_file_id, drive_icon_id,
      drive_screenshot_ids, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, COALESCE(?, CURRENT_TIMESTAMP), COALESCE(?, CURRENT_TIMESTAMP)
    )
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      tagline = excluded.tagline,
      description = excluded.description,
      category = excluded.category,
      platform = excluded.platform,
      version = excluded.version,
      developer = excluded.developer,
      website_url = excluded.website_url,
      icon_url = excluded.icon_url,
      file_url = excluded.file_url,
      file_name = excluded.file_name,
      file_size = excluded.file_size,
      is_external_link = excluded.is_external_link,
      external_download_url = excluded.external_download_url,
      screenshots = excluded.screenshots,
      features = excluded.features,
      system_requirements = excluded.system_requirements,
      changelog = excluded.changelog,
      is_featured = excluded.is_featured,
      status = excluded.status,
      download_count = MAX(COALESCE(apps.download_count, 0), COALESCE(excluded.download_count, 0)),
      rating = excluded.rating,
      drive_file_id = excluded.drive_file_id,
      drive_icon_id = excluded.drive_icon_id,
      drive_screenshot_ids = excluded.drive_screenshot_ids,
      updated_at = CURRENT_TIMESTAMP
  `);

  for (const app of appsList) {
    try {
      insertStmt.run(
        app.title || 'Untitled App',
        app.slug,
        app.tagline || '',
        app.description || '',
        app.category || 'Utilities',
        app.platform || 'Windows',
        app.version || '1.0.0',
        app.developer || 'Admin Developer',
        app.website_url || '',
        app.icon_url || '',
        app.file_url || '',
        app.file_name || '',
        app.file_size || '',
        app.is_external_link ? 1 : 0,
        app.external_download_url || '',
        typeof app.screenshots === 'string' ? app.screenshots : JSON.stringify(app.screenshots || []),
        typeof app.features === 'string' ? app.features : JSON.stringify(app.features || []),
        app.system_requirements || '',
        app.changelog || '',
        app.is_featured ? 1 : 0,
        app.status || 'published',
        app.download_count || 0,
        app.rating || 4.9,
        app.drive_file_id || null,
        app.drive_icon_id || null,
        typeof app.drive_screenshot_ids === 'string' ? app.drive_screenshot_ids : JSON.stringify(app.drive_screenshot_ids || []),
        app.created_at || null,
        app.updated_at || null
      );
    } catch (e) {
      console.warn('[DB] Could not restore app:', app.slug, e.message);
    }
  }
  return true;
}

export function saveCatalogSnapshot(appsList) {
  try {
    if (!Array.isArray(appsList)) return false;
    const catalogPath = path.join(dataDir, 'catalog.json');
    fs.writeFileSync(catalogPath, JSON.stringify(appsList, null, 2), 'utf8');

    // Also persist to server/data/catalog.json fallback
    const bundledDataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(bundledDataDir)) {
      try { fs.mkdirSync(bundledDataDir, { recursive: true }); } catch {}
    }
    const fallbackPath = path.join(bundledDataDir, 'catalog.json');
    try {
      fs.writeFileSync(fallbackPath, JSON.stringify(appsList, null, 2), 'utf8');
    } catch {}

    return true;
  } catch (e) {
    console.warn('[DB] Could not save catalog snapshot:', e.message);
    return false;
  }
}

export function loadCatalogSnapshot() {
  try {
    const catalogPath = path.join(dataDir, 'catalog.json');
    if (fs.existsSync(catalogPath)) {
      return JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    }
    const fallbackPath = path.join(__dirname, 'data', 'catalog.json');
    if (fs.existsSync(fallbackPath)) {
      return JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
    }
    return null;
  } catch {
    return null;
  }
}

export function getSetting(key, defaultValue = null) {
  try {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setSetting(key, value) {
  try {
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `).run(key, String(value));
    return true;
  } catch (e) {
    console.error('[DB] Error saving setting:', key, e.message);
    return false;
  }
}

export function deleteSetting(key) {
  try {
    db.prepare('DELETE FROM settings WHERE key = ?').run(key);
    return true;
  } catch {
    return false;
  }
}

export { db, uploadsDir, iconsDir, screenshotsDir, filesDir };
