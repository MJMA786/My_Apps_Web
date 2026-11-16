import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { db, filesDir, loadCatalogSnapshot, restoreAppsToDb, saveCatalogSnapshot, getAllAppsFromDb } from '../db.js';
import { fetchCatalogFromGoogleDrive, saveCatalogToGoogleDrive, extractDriveFileId } from '../services/googleDrive.js';

const router = express.Router();

// Enforce zero stale caching on all public app catalog endpoints
router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

let lastCatalogSyncTime = 0;
const CATALOG_SYNC_TTL_MS = 15000; // 15 seconds

// Ensure apps are loaded into SQLite /tmp on serverless cold starts & synced on updates
export async function ensureAppsLoaded(force = false) {
  try {
    const now = Date.now();
    const row = db.prepare('SELECT count(*) as count FROM apps').get();
    const hasApps = row && row.count > 0;

    // If we already have apps, force is false, and checked recently, skip
    if (hasApps && !force && (now - lastCatalogSyncTime < CATALOG_SYNC_TTL_MS)) {
      return;
    }
    lastCatalogSyncTime = now;

    // 1. Try local snapshot
    const snapshot = loadCatalogSnapshot();
    if (snapshot && Array.isArray(snapshot) && snapshot.length > 0) {
      if (!hasApps || force) {
        restoreAppsToDb(snapshot);
        console.log(`[Apps] Restored ${snapshot.length} apps from local disk snapshot.`);
      }
    }

    // 2. Try Google Drive cloud catalog
    if (!hasApps || force) {
      const driveApps = await fetchCatalogFromGoogleDrive();
      if (driveApps && Array.isArray(driveApps) && driveApps.length > 0) {
        restoreAppsToDb(driveApps);
        saveCatalogSnapshot(driveApps);
        console.log(`[Apps] Restored/Synced ${driveApps.length} apps from Google Drive cloud backup!`);
      }
    }
  } catch (err) {
    console.warn('[Apps] Could not ensure apps loaded:', err.message);
  }
}

// Helper to format app record
function formatApp(row) {
  if (!row) return null;
  return {
    ...row,
    screenshots: typeof row.screenshots === 'string' ? JSON.parse(row.screenshots || '[]') : row.screenshots,
    features: typeof row.features === 'string' ? JSON.parse(row.features || '[]') : row.features,
    is_featured: Boolean(row.is_featured),
    is_external_link: Boolean(row.is_external_link)
  };
}

// Helper to convert Google Drive share/view links into direct download links
function formatDirectDriveDownloadUrl(url) {
  if (!url) return url;
  const fileId = extractDriveFileId(url);
  if (fileId) {
    return `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
  }
  return url;
}

// Get Featured Apps
router.get('/featured', async (req, res) => {
  try {
    await ensureAppsLoaded();
    const rows = db.prepare(`
      SELECT * FROM apps
      WHERE is_featured = 1 AND status = 'published'
      ORDER BY download_count DESC
      LIMIT 6
    `).all();
    res.json(rows.map(formatApp));
  } catch (err) {
    console.error('Error fetching featured apps:', err);
    res.status(500).json({ error: 'Failed to fetch featured apps' });
  }
});

// Get Categories with Counts
router.get('/categories', async (req, res) => {
  try {
    await ensureAppsLoaded();
    const rows = db.prepare(`
      SELECT category as name, COUNT(*) as count
      FROM apps
      WHERE status = 'published'
      GROUP BY category
      ORDER BY count DESC
    `).all();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get Platforms with Counts
router.get('/platforms', async (req, res) => {
  try {
    await ensureAppsLoaded();
    const rows = db.prepare(`
      SELECT platform as name, COUNT(*) as count
      FROM apps
      WHERE status = 'published'
      GROUP BY platform
      ORDER BY count DESC
    `).all();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching platforms:', err);
    res.status(500).json({ error: 'Failed to fetch platforms' });
  }
});

// List Apps (Filtered, Searched, Paginated)
router.get('/', async (req, res) => {
  try {
    await ensureAppsLoaded(Boolean(req.query.refresh || req.query._t));
    const {
      search = '',
      category = '',
      platform = '',
      sort = 'popular',
      page = 1,
      limit = 12
    } = req.query;

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const conditions = ["status = 'published'"];
    const params = [];

    if (search.trim()) {
      conditions.push("(title LIKE ? OR tagline LIKE ? OR description LIKE ?)");
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (category.trim() && category !== 'All') {
      conditions.push("category = ?");
      params.push(category.trim());
    }

    if (platform.trim() && platform !== 'All') {
      conditions.push("platform = ?");
      params.push(platform.trim());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderBy = 'ORDER BY download_count DESC';
    if (sort === 'newest') orderBy = 'ORDER BY created_at DESC';
    if (sort === 'rating') orderBy = 'ORDER BY rating DESC';
    if (sort === 'name') orderBy = 'ORDER BY title ASC';

    // Count total matches
    const countSql = `SELECT COUNT(*) as total FROM apps ${whereClause}`;
    const totalRow = db.prepare(countSql).get(...params);
    const total = totalRow ? totalRow.total : 0;

    // Fetch paginated results
    const listSql = `
      SELECT * FROM apps
      ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;
    const rows = db.prepare(listSql).all(...params, parseInt(limit), offset);

    res.json({
      apps: rows.map(formatApp),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error listing apps:', err);
    res.status(500).json({ error: 'Failed to list apps' });
  }
});

// Get Single App Details by Slug or ID
router.get('/:slug', async (req, res) => {
  try {
    await ensureAppsLoaded();
    const { slug } = req.params;
    let app = db.prepare('SELECT * FROM apps WHERE slug = ?').get(slug);

    if (!app && !isNaN(slug)) {
      app = db.prepare('SELECT * FROM apps WHERE id = ?').get(parseInt(slug));
    }

    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    // Get related apps
    const related = db.prepare(`
      SELECT id, title, slug, tagline, icon_url, category, platform, version, download_count, rating
      FROM apps
      WHERE category = ? AND id != ? AND status = 'published'
      LIMIT 4
    `).all(app.category, app.id);

    res.json({
      app: formatApp(app),
      related
    });
  } catch (err) {
    console.error('Error fetching app details:', err);
    res.status(500).json({ error: 'Failed to fetch app details' });
  }
});

// Download App Route (Increments download counter and serves file)
router.get('/:slug/download', async (req, res) => {
  try {
    await ensureAppsLoaded();
    const { slug } = req.params;
    let app = db.prepare('SELECT * FROM apps WHERE slug = ?').get(slug);

    if (!app && !isNaN(slug)) {
      app = db.prepare('SELECT * FROM apps WHERE id = ?').get(parseInt(slug));
    }

    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    // Increment download counter
    db.prepare('UPDATE apps SET download_count = download_count + 1 WHERE id = ?').run(app.id);

    // Record download log
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    try {
      db.prepare(`
        INSERT INTO download_logs (app_id, ip_address, user_agent)
        VALUES (?, ?, ?)
      `).run(app.id, String(ip), String(userAgent));
    } catch {}

    // Persist updated download count to local snapshot & Google Drive cloud backup
    try {
      const allApps = getAllAppsFromDb();
      saveCatalogSnapshot(allApps);
      saveCatalogToGoogleDrive(allApps).catch(err => {
        console.warn('[GoogleDrive] Syncing download count to Google Drive failed:', err.message);
      });
    } catch (saveErr) {
      console.warn('[Apps] Failed to save catalog snapshot on download:', saveErr.message);
    }

    // 1. Direct Drive download if drive_file_id is set
    if (app.drive_file_id) {
      return res.redirect(`https://drive.usercontent.google.com/download?id=${app.drive_file_id}&export=download`);
    }

    // 2. Drive file ID in file_url or external_download_url
    const extractedFileId = extractDriveFileId(app.file_url) || extractDriveFileId(app.external_download_url);
    if (extractedFileId) {
      return res.redirect(`https://drive.usercontent.google.com/download?id=${extractedFileId}&export=download`);
    }

    // 3. HTTP / HTTPS file_url or external download link
    if (app.is_external_link && app.external_download_url) {
      const downloadUrl = formatDirectDriveDownloadUrl(app.external_download_url);
      return res.redirect(downloadUrl);
    }

    if (app.file_url && (app.file_url.startsWith('http://') || app.file_url.startsWith('https://'))) {
      const downloadUrl = formatDirectDriveDownloadUrl(app.file_url);
      return res.redirect(downloadUrl);
    }

    // 4. Handle local file download (e.g. dev mode or persistent storage)
    if (app.file_url) {
      // If file_url is a relative path or filename
      let fileName = path.basename(app.file_url);
      let localPath = path.join(filesDir, fileName);

      // Check if it exists in uploads/files
      if (fs.existsSync(localPath)) {
        return res.download(localPath, app.file_name || fileName);
      }

      // If it starts with /uploads/files/...
      if (app.file_url.startsWith('/uploads/files/')) {
        const subPath = app.file_url.replace('/uploads/files/', '');
        const directPath = path.join(filesDir, subPath);
        if (fs.existsSync(directPath)) {
          return res.download(directPath, app.file_name || subPath);
        }
      }
    }

    // If external fallback exists
    if (app.external_download_url) {
      return res.redirect(formatDirectDriveDownloadUrl(app.external_download_url));
    }

    // Fallback: If demo file was requested, generate sample attachment
    res.setHeader('Content-Disposition', `attachment; filename="${app.file_name || app.slug + '-installer.zip'}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(`Sample binary installer content for ${app.title} (v${app.version}). MyAppsWeb Distribution Platform.`);
  } catch (err) {
    console.error('Error initiating download:', err);
    res.status(500).json({ error: 'Failed to process app download' });
  }
});

export default router;
