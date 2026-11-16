import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { 
  db, 
  uploadsDir, 
  iconsDir, 
  screenshotsDir, 
  filesDir, 
  getAllAppsFromDb, 
  restoreAppsToDb, 
  saveCatalogSnapshot, 
  loadCatalogSnapshot 
} from '../db.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { uploadAppAssets } from '../middleware/upload.js';
import { 
  getDriveStatus, 
  testDriveConnection, 
  uploadToGoogleDrive, 
  deleteFromGoogleDrive, 
  saveDriveCredentials,
  createResumableUploadSession,
  finishResumableUpload,
  generateOAuthUrl,
  handleOAuthCallback,
  disconnectOAuth,
  saveOAuthConfig,
  syncDriveAuth,
  saveCatalogToGoogleDrive,
  fetchCatalogFromGoogleDrive,
  extractDriveFileId,
  formatDirectDriveDownloadUrl,
  cleanupOrphanedDriveFiles
} from '../services/googleDrive.js';
import { ensureAppsLoaded } from './apps.js';

const router = express.Router();

// Public callback route for Google OAuth redirect
router.get('/drive/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) {
      return res.redirect('/admin/settings?error=' + encodeURIComponent('Missing authorization code from Google.'));
    }

    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const redirectUri = `${proto}://${host}/api/admin/drive/callback`;

    const result = await handleOAuthCallback({ code, redirectUri, state });
    
    // Store in browser localStorage on return!
    const authPayload = {
      tokens: result.tokens,
      email: result.email,
      clientId: result.clientId,
      clientSecret: result.clientSecret,
      folderId: result.folderId || ''
    };

    // Return friendly HTML confirmation page that smoothly transitions to admin settings
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Google Drive Connected - MyApps</title>
  <style>
    body {
      background-color: #030712;
      color: #f3f4f6;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 1rem;
      box-sizing: border-box;
    }
    .card {
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 1.25rem;
      padding: 2.5rem 2rem;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      background: rgba(16, 185, 129, 0.15);
      border: 2px solid #10b981;
      border-radius: 50%;
      font-size: 2rem;
      margin-bottom: 1.25rem;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 0.5rem 0;
    }
    p {
      color: #94a3b8;
      font-size: 0.95rem;
      line-height: 1.5;
      margin: 0 0 1.75rem 0;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(135deg, #4f46e5, #3b82f6);
      color: #ffffff;
      font-weight: 600;
      font-size: 0.95rem;
      padding: 0.75rem 1.75rem;
      border-radius: 0.75rem;
      text-decoration: none;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">✓</div>
    <h1>Google Drive Connected!</h1>
    <p>Connected as <strong>${result.email}</strong>. Saving authentication to your browser and returning to settings...</p>
    <a href="/admin/settings?drive_connected=true" class="btn" id="returnBtn">Continue to Settings &rarr;</a>
  </div>
  <script>
    try {
      localStorage.setItem('myapps_drive_auth', JSON.stringify(${JSON.stringify(authPayload)}));
    } catch (e) {
      console.error('Failed to store drive auth in localStorage:', e);
    }
    setTimeout(function() {
      window.location.href = '/admin/settings?drive_connected=true';
    }, 600);
  </script>
</body>
</html>`);
  } catch (err) {
    console.error('Error in Google OAuth callback:', err);
    res.redirect('/admin/settings?error=' + encodeURIComponent(err.message));
  }
});

// Require admin authentication for all routes below
router.use(authenticateAdmin);

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// ==========================================
// Google Drive Integration Status & Config
// ==========================================

// Get Drive Connection Status
router.get('/drive/status', (req, res) => {
  try {
    const status = getDriveStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read Drive status: ' + err.message });
  }
});

// Test Live Drive Connection
router.post('/drive/test', async (req, res) => {
  try {
    const result = await testDriveConnection();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Save or Update Drive Credentials & Folder ID
router.post('/drive/config', async (req, res) => {
  try {
    const { keyJson, folderId } = req.body;
    if (!keyJson) {
      return res.status(400).json({ error: 'Service Account Key JSON is required.' });
    }

    saveDriveCredentials(keyJson, folderId);
    // Test the newly saved configuration
    const testResult = await testDriveConnection();
    res.json({
      success: true,
      message: 'Google Drive connected successfully!',
      testResult
    });
  } catch (err) {
    console.error('Error saving Drive config:', err);
    res.status(400).json({ error: 'Failed to configure Google Drive: ' + err.message });
  }
});

// Generate Google OAuth 2.0 Auth URL (for user's personal @gmail.com)
router.post('/drive/oauth/url', (req, res) => {
  try {
    const { clientId, clientSecret, folderId, customRedirectUri } = req.body;
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const redirectUri = customRedirectUri || `${proto}://${host}/api/admin/drive/callback`;

    const authUrl = generateOAuthUrl({
      redirectUri,
      clientId,
      clientSecret,
      folderId
    });

    res.json({ authUrl, redirectUri });
  } catch (err) {
    console.error('Error generating Google OAuth URL:', err);
    res.status(400).json({ error: err.message });
  }
});

// Save OAuth Config (Client ID, Secret, and Target Folder)
router.post('/drive/oauth/config', (req, res) => {
  try {
    const { clientId, clientSecret, folderId } = req.body;
    saveOAuthConfig({ clientId, clientSecret, folderId });
    res.json({ success: true, message: 'Google OAuth configuration saved.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Sync Drive Auth credentials from browser localStorage (resilient to serverless cold starts)
router.post('/drive/oauth/sync', (req, res) => {
  try {
    const { tokens, clientId, clientSecret, folderId, email } = req.body;
    syncDriveAuth({ tokens, clientId, clientSecret, folderId, email });
    const status = getDriveStatus();
    res.json({ success: true, status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Disconnect Google OAuth Account
router.post('/drive/oauth/disconnect', (req, res) => {
  try {
    disconnectOAuth();
    res.json({ success: true, message: 'Google Account disconnected.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Initialize Direct Resumable Upload to Google Drive (Bypasses Vercel 4.5MB payload limit)
router.post('/drive/init-upload', async (req, res) => {
  try {
    const { fileName, mimeType, fileSize } = req.body;
    if (!fileName) {
      return res.status(400).json({ error: 'fileName is required' });
    }
    const origin = req.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173';
    const result = await createResumableUploadSession({
      fileName,
      mimeType,
      fileSize,
      origin
    });
    res.json(result);
  } catch (err) {
    console.error('Error initiating drive upload session:', err);
    res.status(400).json({ error: err.message });
  }
});

// Finalize Direct Resumable Upload (Sets public permissions and returns direct URLs)
router.post('/drive/finish-upload', async (req, res) => {
  try {
    const { fileId } = req.body;
    if (!fileId) {
      return res.status(400).json({ error: 'fileId is required' });
    }
    const result = await finishResumableUpload({ fileId });
    res.json(result);
  } catch (err) {
    console.error('Error finalizing drive upload:', err);
    res.status(400).json({ error: err.message });
  }
});

// Scan Google Drive and clean up any orphaned files not referenced by active apps
router.post('/drive/cleanup-orphans', async (req, res) => {
  try {
    await ensureAppsLoaded();
    const allApps = getAllAppsFromDb();

    // Collect all active file IDs in database
    const activeFileIds = new Set();
    for (const app of allApps) {
      if (app.drive_file_id) activeFileIds.add(app.drive_file_id);
      if (app.drive_icon_id) activeFileIds.add(app.drive_icon_id);
      const fid = extractDriveFileId(app.file_url) || extractDriveFileId(app.external_download_url);
      if (fid) activeFileIds.add(fid);
      const iconId = extractDriveFileId(app.icon_url);
      if (iconId) activeFileIds.add(iconId);
      if (app.drive_screenshot_ids) {
        try {
          const ids = JSON.parse(app.drive_screenshot_ids);
          if (Array.isArray(ids)) ids.forEach(id => activeFileIds.add(id));
        } catch {}
      }
    }

    const result = await cleanupOrphanedDriveFiles(activeFileIds);
    // Also save current fresh catalog to Drive
    await saveCatalogToGoogleDrive(allApps);

    res.json({
      success: true,
      message: `Cleaned up ${result.deletedCount} unused/previous files from your Google Drive.`,
      deletedCount: result.deletedCount,
      deletedFiles: result.deletedFiles
    });
  } catch (err) {
    console.error('Error cleaning orphaned Drive files:', err);
    res.status(500).json({ error: 'Failed to clean unused files: ' + err.message });
  }
});

// ==========================================
// Analytics & Dashboard Stats
// ==========================================

router.get('/stats', async (req, res) => {
  try {
    await ensureAppsLoaded();
    const totalAppsRow = db.prepare('SELECT COUNT(*) as count FROM apps').get();
    const publishedAppsRow = db.prepare("SELECT COUNT(*) as count FROM apps WHERE status = 'published'").get();
    const draftAppsRow = db.prepare("SELECT COUNT(*) as count FROM apps WHERE status = 'draft'").get();
    const totalDownloadsRow = db.prepare('SELECT SUM(download_count) as total FROM apps').get();

    const topApps = db.prepare(`
      SELECT id, title, slug, icon_url, category, platform, version, download_count, status
      FROM apps
      ORDER BY download_count DESC
      LIMIT 5
    `).all();

    const recentDownloads = db.prepare(`
      SELECT dl.id, dl.downloaded_at, dl.ip_address, dl.user_agent, a.title as app_title, a.slug as app_slug, a.icon_url
      FROM download_logs dl
      JOIN apps a ON dl.app_id = a.id
      ORDER BY dl.downloaded_at DESC
      LIMIT 10
    `).all();

    const platforms = db.prepare(`
      SELECT platform, COUNT(*) as count
      FROM apps
      GROUP BY platform
    `).all();

    const categories = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM apps
      GROUP BY category
    `).all();

    const driveStatus = getDriveStatus();

    res.json({
      totalApps: totalAppsRow ? totalAppsRow.count : 0,
      publishedApps: publishedAppsRow ? publishedAppsRow.count : 0,
      draftApps: draftAppsRow ? draftAppsRow.count : 0,
      totalDownloads: (totalDownloadsRow && totalDownloadsRow.total) ? totalDownloadsRow.total : 0,
      topApps,
      recentDownloads,
      platforms,
      categories,
      googleDriveConfigured: driveStatus.configured
    });
  } catch (err) {
    console.error('Error fetching admin stats:', err);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// Admin List All Apps (Includes drafts)
router.get('/apps', async (req, res) => {
  try {
    await ensureAppsLoaded();
    const { search = '', status = '', category = '', platform = '' } = req.query;
    const conditions = [];
    const params = [];

    if (search.trim()) {
      conditions.push('(title LIKE ? OR tagline LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (category && category !== 'All') {
      conditions.push('category = ?');
      params.push(category);
    }

    if (platform && platform !== 'All') {
      conditions.push('platform = ?');
      params.push(platform);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const apps = db.prepare(`SELECT * FROM apps ${whereClause} ORDER BY created_at DESC`).all(...params);

    const formatted = apps.map(app => ({
      ...app,
      screenshots: typeof app.screenshots === 'string' ? JSON.parse(app.screenshots || '[]') : app.screenshots,
      features: typeof app.features === 'string' ? JSON.parse(app.features || '[]') : app.features,
      is_featured: Boolean(app.is_featured),
      is_external_link: Boolean(app.is_external_link)
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching admin apps:', err);
    res.status(500).json({ error: 'Failed to fetch apps' });
  }
});

// Admin Get Single App by ID
router.get('/apps/:id', async (req, res) => {
  try {
    await ensureAppsLoaded();
    const app = db.prepare('SELECT * FROM apps WHERE id = ?').get(req.params.id);
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    res.json({
      ...app,
      screenshots: typeof app.screenshots === 'string' ? JSON.parse(app.screenshots || '[]') : app.screenshots,
      features: typeof app.features === 'string' ? JSON.parse(app.features || '[]') : app.features,
      is_featured: Boolean(app.is_featured),
      is_external_link: Boolean(app.is_external_link)
    });
  } catch (err) {
    console.error('Error fetching app by ID:', err);
    res.status(500).json({ error: 'Failed to fetch app' });
  }
});

// Admin Create New App (Supports Google Drive auto upload)
router.post('/apps', uploadAppAssets, async (req, res) => {
  try {
    await ensureAppsLoaded();
    const {
      title,
      slug,
      tagline = '',
      description = '',
      category = 'Utilities',
      platform = 'Windows',
      version = '1.0.0',
      developer = 'Admin',
      website_url = '',
      is_external_link = 0,
      external_download_url = '',
      features = '[]',
      system_requirements = '',
      changelog = '',
      is_featured = 0,
      status = 'published',
      file_size = ''
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'App title is required' });
    }

    // Slug generation
    let finalSlug = (slug && slug.trim()) ? slugify(slug) : slugify(title);
    if (!finalSlug) {
      finalSlug = 'app-' + Date.now();
    }

    // Ensure slug uniqueness
    const existingSlug = db.prepare('SELECT id FROM apps WHERE slug = ?').get(finalSlug);
    if (existingSlug) {
      finalSlug = `${finalSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const driveActive = getDriveStatus().configured;

    // Handle Uploaded Icon
    let iconUrl = req.body.icon_url || '';
    let driveIconId = req.body.drive_icon_id || null;

    if (req.files && req.files.icon && req.files.icon[0]) {
      const iconF = req.files.icon[0];
      if (driveActive) {
        try {
          const driveRes = await uploadToGoogleDrive({
            filePath: iconF.path,
            originalName: iconF.originalname,
            mimeType: iconF.mimetype
          });
          iconUrl = driveRes.previewUrl;
          driveIconId = driveRes.driveFileId;
        } catch (e) {
          console.error('[GoogleDrive] Icon upload failed, using local fallback:', e.message);
          iconUrl = `/uploads/icons/${iconF.filename}`;
        }
      } else {
        iconUrl = `/uploads/icons/${iconF.filename}`;
      }
    }

    // Handle Uploaded Binary Package File
    let fileUrl = req.body.file_url || '';
    let fileName = req.body.file_name || '';
    let calculatedSize = file_size || req.body.file_size || '';
    let driveFileId = req.body.drive_file_id || null;
    let isExternal = Boolean(is_external_link);

    if (req.files && req.files.file && req.files.file[0]) {
      const f = req.files.file[0];
      fileName = f.originalname;
      if (!calculatedSize) {
        calculatedSize = formatBytes(f.size);
      }

      if (driveActive) {
        try {
          const driveRes = await uploadToGoogleDrive({
            filePath: f.path,
            originalName: f.originalname,
            mimeType: f.mimetype
          });
          fileUrl = driveRes.directDownloadUrl;
          driveFileId = driveRes.driveFileId;
          isExternal = true; // Served directly from Google Drive CDN
        } catch (e) {
          console.error('[GoogleDrive] App binary upload failed, using local fallback:', e.message);
          fileUrl = `/uploads/files/${f.filename}`;
        }
      } else {
        fileUrl = `/uploads/files/${f.filename}`;
      }
    }

    if (driveFileId || (fileUrl && (fileUrl.includes('drive.google.com') || fileUrl.includes('drive.usercontent.google.com')))) {
      isExternal = true;
    }

    // Handle Uploaded Screenshots
    let screenshotUrls = [];
    let driveScreenshotIds = [];

    if (req.body.screenshots) {
      try {
        const parsedScreenshots = typeof req.body.screenshots === 'string' ? JSON.parse(req.body.screenshots) : req.body.screenshots;
        if (Array.isArray(parsedScreenshots)) {
          screenshotUrls = [...parsedScreenshots];
        }
      } catch {}
    }

    if (req.body.drive_screenshot_ids) {
      try {
        const parsedDriveIds = typeof req.body.drive_screenshot_ids === 'string' ? JSON.parse(req.body.drive_screenshot_ids) : req.body.drive_screenshot_ids;
        if (Array.isArray(parsedDriveIds)) {
          driveScreenshotIds = [...parsedDriveIds];
        }
      } catch {}
    }

    if (req.files && req.files.screenshots) {
      for (const s of req.files.screenshots) {
        if (driveActive) {
          try {
            const driveRes = await uploadToGoogleDrive({
              filePath: s.path,
              originalName: s.originalname,
              mimeType: s.mimetype
            });
            screenshotUrls.push(driveRes.previewUrl);
            driveScreenshotIds.push(driveRes.driveFileId);
          } catch (e) {
            console.error('[GoogleDrive] Screenshot upload failed, using local fallback:', e.message);
            screenshotUrls.push(`/uploads/screenshots/${s.filename}`);
          }
        } else {
          screenshotUrls.push(`/uploads/screenshots/${s.filename}`);
        }
      }
    }

    // Features formatting
    let formattedFeatures = '[]';
    try {
      if (typeof features === 'string') {
        JSON.parse(features);
        formattedFeatures = features;
      } else if (Array.isArray(features)) {
        formattedFeatures = JSON.stringify(features);
      }
    } catch {
      const list = features.split('\n').map(s => s.trim()).filter(Boolean);
      formattedFeatures = JSON.stringify(list);
    }

    const stmt = db.prepare(`
      INSERT INTO apps (
        title, slug, tagline, description, category, platform, version, developer,
        website_url, icon_url, file_url, file_name, file_size, is_external_link,
        external_download_url, screenshots, features, system_requirements, changelog,
        is_featured, status, download_count, rating, drive_file_id, drive_icon_id, drive_screenshot_ids
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, 0, 5.0, ?, ?, ?
      )
    `);

    const result = stmt.run(
      title.trim(),
      finalSlug,
      tagline.trim(),
      description.trim(),
      category,
      platform,
      version.trim(),
      developer.trim(),
      website_url.trim(),
      iconUrl,
      fileUrl,
      fileName,
      calculatedSize,
      isExternal ? 1 : 0,
      external_download_url ? formatDirectDriveDownloadUrl(external_download_url) : '',
      JSON.stringify(screenshotUrls),
      formattedFeatures,
      system_requirements.trim(),
      changelog.trim(),
      is_featured ? 1 : 0,
      status,
      driveFileId,
      driveIconId,
      JSON.stringify(driveScreenshotIds)
    );

    const createdApp = db.prepare('SELECT * FROM apps WHERE id = ?').get(result.lastInsertRowid);

    // Persist catalog to local snapshot and Google Drive cloud storage
    try {
      const allApps = getAllAppsFromDb();
      saveCatalogSnapshot(allApps);
      saveCatalogToGoogleDrive(allApps).catch(err => {
        console.warn('[GoogleDrive] Catalog sync error:', err.message);
      });
    } catch {}

    res.status(201).json({
      success: true,
      message: 'App created successfully' + (driveFileId ? ' (Uploaded to Google Drive)' : ''),
      app: createdApp
    });
  } catch (err) {
    console.error('Error creating app:', err);
    res.status(500).json({ error: 'Failed to create app: ' + err.message });
  }
});

// Admin Update Existing App (Supports Google Drive replace & delete)
router.put('/apps/:id', uploadAppAssets, async (req, res) => {
  try {
    await ensureAppsLoaded();
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM apps WHERE id = ?').get(id);

    if (!existing) {
      return res.status(404).json({ error: 'App not found' });
    }

    const oldDriveFileId = existing.drive_file_id || extractDriveFileId(existing.file_url) || extractDriveFileId(existing.external_download_url);
    const oldDriveIconId = existing.drive_icon_id || extractDriveFileId(existing.icon_url);

    const {
      title,
      slug,
      tagline,
      description,
      category,
      platform,
      version,
      developer,
      website_url,
      is_external_link,
      external_download_url,
      features,
      system_requirements,
      changelog,
      is_featured,
      status,
      file_size,
      existing_screenshots
    } = req.body;

    let finalSlug = slug ? slugify(slug) : existing.slug;
    if (finalSlug !== existing.slug) {
      const slugCheck = db.prepare('SELECT id FROM apps WHERE slug = ? AND id != ?').get(finalSlug, id);
      if (slugCheck) {
        finalSlug = `${finalSlug}-${Math.floor(1000 + Math.random() * 9000)}`;
      }
    }

    const driveActive = getDriveStatus().configured;

    // Handle Icon Update
    let iconUrl = req.body.icon_url !== undefined ? req.body.icon_url : existing.icon_url;
    let driveIconId = req.body.drive_icon_id !== undefined ? req.body.drive_icon_id : existing.drive_icon_id;

    if (req.files && req.files.icon && req.files.icon[0]) {
      const iconF = req.files.icon[0];
      if (driveActive) {
        try {
          const driveRes = await uploadToGoogleDrive({
            filePath: iconF.path,
            originalName: iconF.originalname,
            mimeType: iconF.mimetype
          });
          iconUrl = driveRes.previewUrl;
          driveIconId = driveRes.driveFileId;
        } catch (e) {
          iconUrl = `/uploads/icons/${iconF.filename}`;
          driveIconId = null;
        }
      } else {
        iconUrl = `/uploads/icons/${iconF.filename}`;
        driveIconId = null;
      }
    }

    const newDriveIconId = driveIconId || extractDriveFileId(iconUrl);
    const isNewIconProvided = Boolean(
      (req.files && req.files.icon && req.files.icon[0]) ||
      (req.body.drive_icon_id && req.body.drive_icon_id !== existing.drive_icon_id) ||
      (req.body.icon_url && req.body.icon_url !== existing.icon_url)
    );

    if (isNewIconProvided && oldDriveIconId && oldDriveIconId !== newDriveIconId) {
      console.log(`[UpdateApp] Deleting previous Google Drive icon (${oldDriveIconId})...`);
      try {
        await deleteFromGoogleDrive(oldDriveIconId);
      } catch (iconDelErr) {
        console.warn(`[UpdateApp] Failed to delete previous Drive icon ${oldDriveIconId}:`, iconDelErr.message);
      }
    }
    if (isNewIconProvided && existing.icon_url && existing.icon_url.startsWith('/uploads/icons/') && existing.icon_url !== iconUrl) {
      const oldLocalIcon = path.join(iconsDir, path.basename(existing.icon_url));
      if (fs.existsSync(oldLocalIcon)) {
        try { fs.unlinkSync(oldLocalIcon); } catch {}
      }
    }

    // Handle File Update
    let fileUrl = req.body.file_url !== undefined ? req.body.file_url : existing.file_url;
    let fileName = req.body.file_name !== undefined ? req.body.file_name : existing.file_name;
    let calculatedSize = file_size !== undefined ? file_size : (req.body.file_size !== undefined ? req.body.file_size : existing.file_size);
    let driveFileId = req.body.drive_file_id !== undefined ? req.body.drive_file_id : existing.drive_file_id;
    let isExternal = is_external_link !== undefined ? Boolean(is_external_link) : Boolean(existing.is_external_link);

    if (req.files && req.files.file && req.files.file[0]) {
      const f = req.files.file[0];
      fileName = f.originalname;
      calculatedSize = formatBytes(f.size);

      if (driveActive) {
        try {
          const driveRes = await uploadToGoogleDrive({
            filePath: f.path,
            originalName: f.originalname,
            mimeType: f.mimetype
          });
          fileUrl = driveRes.directDownloadUrl;
          driveFileId = driveRes.driveFileId;
          isExternal = true;
        } catch (e) {
          fileUrl = `/uploads/files/${f.filename}`;
          driveFileId = null;
        }
      } else {
        fileUrl = `/uploads/files/${f.filename}`;
        driveFileId = null;
      }
    }

    const newDriveFileId = driveFileId || extractDriveFileId(fileUrl) || extractDriveFileId(req.body.external_download_url);
    const isNewFileProvided = Boolean(
      (req.files && req.files.file && req.files.file[0]) ||
      (req.body.drive_file_id && req.body.drive_file_id !== existing.drive_file_id) ||
      (req.body.file_url && req.body.file_url !== existing.file_url) ||
      (req.body.external_download_url && req.body.external_download_url !== existing.external_download_url)
    );

    if (isNewFileProvided && oldDriveFileId && oldDriveFileId !== newDriveFileId) {
      console.log(`[UpdateApp] Deleting previous Google Drive package file (${oldDriveFileId})...`);
      try {
        await deleteFromGoogleDrive(oldDriveFileId);
      } catch (fileDelErr) {
        console.warn(`[UpdateApp] Failed to delete previous Drive file ${oldDriveFileId}:`, fileDelErr.message);
      }
    }
    if (isNewFileProvided && existing.file_url && existing.file_url.startsWith('/uploads/files/') && existing.file_url !== fileUrl) {
      const oldLocalPath = path.join(filesDir, path.basename(existing.file_url));
      if (fs.existsSync(oldLocalPath)) {
        try { fs.unlinkSync(oldLocalPath); } catch {}
      }
    }

    if (driveFileId || (fileUrl && (fileUrl.includes('drive.google.com') || fileUrl.includes('drive.usercontent.google.com')))) {
      isExternal = true;
    }

    // Handle Screenshots Update
    let currentScreenshots = [];
    if (existing_screenshots) {
      try {
        currentScreenshots = JSON.parse(existing_screenshots);
      } catch {
        currentScreenshots = [];
      }
    } else {
      try {
        currentScreenshots = JSON.parse(existing.screenshots || '[]');
      } catch {
        currentScreenshots = [];
      }
    }

    let currentDriveScreenshotIds = [];
    try {
      currentDriveScreenshotIds = JSON.parse(existing.drive_screenshot_ids || '[]');
    } catch {}

    if (req.files && req.files.screenshots) {
      for (const s of req.files.screenshots) {
        if (driveActive) {
          try {
            const driveRes = await uploadToGoogleDrive({
              filePath: s.path,
              originalName: s.originalname,
              mimeType: s.mimetype
            });
            currentScreenshots.push(driveRes.previewUrl);
            currentDriveScreenshotIds.push(driveRes.driveFileId);
          } catch (e) {
            currentScreenshots.push(`/uploads/screenshots/${s.filename}`);
          }
        } else {
          currentScreenshots.push(`/uploads/screenshots/${s.filename}`);
        }
      }
    }

    // Clean up any deleted screenshots from Google Drive
    if (existing.drive_screenshot_ids) {
      try {
        const oldScreenshotIds = JSON.parse(existing.drive_screenshot_ids);
        if (Array.isArray(oldScreenshotIds)) {
          for (const sId of oldScreenshotIds) {
            const stillUsed = currentScreenshots.some(url => url && url.includes(sId));
            if (!stillUsed) {
              deleteFromGoogleDrive(sId).catch(() => {});
            }
          }
        }
      } catch {}
    }

    // Features format
    let formattedFeatures = existing.features;
    if (features !== undefined) {
      try {
        if (typeof features === 'string') {
          JSON.parse(features);
          formattedFeatures = features;
        } else if (Array.isArray(features)) {
          formattedFeatures = JSON.stringify(features);
        }
      } catch {
        const list = features.split('\n').map(s => s.trim()).filter(Boolean);
        formattedFeatures = JSON.stringify(list);
      }
    }

    const stmt = db.prepare(`
      UPDATE apps SET
        title = ?,
        slug = ?,
        tagline = ?,
        description = ?,
        category = ?,
        platform = ?,
        version = ?,
        developer = ?,
        website_url = ?,
        icon_url = ?,
        file_url = ?,
        file_name = ?,
        file_size = ?,
        is_external_link = ?,
        external_download_url = ?,
        screenshots = ?,
        features = ?,
        system_requirements = ?,
        changelog = ?,
        is_featured = ?,
        status = ?,
        drive_file_id = ?,
        drive_icon_id = ?,
        drive_screenshot_ids = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      title !== undefined ? title.trim() : existing.title,
      finalSlug,
      tagline !== undefined ? tagline.trim() : existing.tagline,
      description !== undefined ? description.trim() : existing.description,
      category !== undefined ? category : existing.category,
      platform !== undefined ? platform : existing.platform,
      version !== undefined ? version.trim() : existing.version,
      developer !== undefined ? developer.trim() : existing.developer,
      website_url !== undefined ? website_url.trim() : existing.website_url,
      iconUrl,
      fileUrl,
      fileName,
      calculatedSize,
      isExternal ? 1 : 0,
      external_download_url !== undefined ? formatDirectDriveDownloadUrl(external_download_url) : existing.external_download_url,
      JSON.stringify(currentScreenshots),
      formattedFeatures,
      system_requirements !== undefined ? system_requirements.trim() : existing.system_requirements,
      changelog !== undefined ? changelog.trim() : existing.changelog,
      is_featured !== undefined ? (is_featured ? 1 : 0) : existing.is_featured,
      status !== undefined ? status : existing.status,
      driveFileId,
      driveIconId,
      JSON.stringify(currentDriveScreenshotIds),
      id
    );

    const updatedApp = db.prepare('SELECT * FROM apps WHERE id = ?').get(id);

    // Persist catalog to local snapshot and Google Drive cloud storage
    try {
      const allApps = getAllAppsFromDb();
      saveCatalogSnapshot(allApps);
      await saveCatalogToGoogleDrive(allApps);
    } catch (catalogErr) {
      console.warn('[GoogleDrive] Catalog sync error on update:', catalogErr.message);
    }

    res.json({
      success: true,
      message: 'App updated successfully',
      app: updatedApp
    });
  } catch (err) {
    console.error('Error updating app:', err);
    res.status(500).json({ error: 'Failed to update app: ' + err.message });
  }
});

// Admin Delete App (Automatically deletes from Google Drive & frees storage!)
router.delete('/apps/:id', async (req, res) => {
  try {
    await ensureAppsLoaded();
    const { id } = req.params;
    const app = db.prepare('SELECT * FROM apps WHERE id = ?').get(id);

    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    // 1. Delete app package file from Google Drive
    const fileIdToDelete = app.drive_file_id || extractDriveFileId(app.file_url) || extractDriveFileId(app.external_download_url);
    if (fileIdToDelete) {
      console.log(`[DeleteApp] Removing app binary from Google Drive (${fileIdToDelete})...`);
      try {
        await deleteFromGoogleDrive(fileIdToDelete);
      } catch (err) {
        console.warn(`[DeleteApp] Failed to delete file ${fileIdToDelete} from Drive:`, err.message);
      }
    }

    // 2. Delete icon from Google Drive
    const iconIdToDelete = app.drive_icon_id || extractDriveFileId(app.icon_url);
    if (iconIdToDelete) {
      try {
        await deleteFromGoogleDrive(iconIdToDelete);
      } catch (err) {
        console.warn(`[DeleteApp] Failed to delete icon ${iconIdToDelete} from Drive:`, err.message);
      }
    }

    // 3. Delete screenshots from Google Drive
    if (app.drive_screenshot_ids) {
      try {
        const ids = JSON.parse(app.drive_screenshot_ids);
        if (Array.isArray(ids)) {
          for (const sId of ids) {
            await deleteFromGoogleDrive(sId);
          }
        }
      } catch {}
    }

    // 4. Clean up any local files if they existed
    if (app.file_url && app.file_url.startsWith('/uploads/files/')) {
      const filePath = path.join(filesDir, path.basename(app.file_url));
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }

    if (app.icon_url && app.icon_url.startsWith('/uploads/icons/')) {
      const iconPath = path.join(iconsDir, path.basename(app.icon_url));
      if (fs.existsSync(iconPath)) {
        try { fs.unlinkSync(iconPath); } catch {}
      }
    }

    db.prepare('DELETE FROM apps WHERE id = ?').run(id);
    try {
      db.prepare('DELETE FROM download_logs WHERE app_id = ?').run(id);
    } catch {}

    // Persist catalog to local snapshot and Google Drive cloud storage
    try {
      const allApps = getAllAppsFromDb();
      saveCatalogSnapshot(allApps);
      await saveCatalogToGoogleDrive(allApps);
    } catch (catalogErr) {
      console.warn('[GoogleDrive] Catalog sync error on delete:', catalogErr.message);
    }

    res.json({
      success: true,
      message: `App "${app.title}" and its Google Drive cloud storage files have been deleted successfully.`
    });
  } catch (err) {
    console.error('Error deleting app:', err);
    res.status(500).json({ error: 'Failed to delete app: ' + err.message });
  }
});

// Toggle Featured Status
router.patch('/apps/:id/featured', async (req, res) => {
  try {
    await ensureAppsLoaded();
    const { id } = req.params;
    const app = db.prepare('SELECT id, is_featured FROM apps WHERE id = ?').get(id);
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    const newFeatured = app.is_featured ? 0 : 1;
    db.prepare('UPDATE apps SET is_featured = ? WHERE id = ?').run(newFeatured, id);

    // Persist catalog
    try {
      const allApps = getAllAppsFromDb();
      saveCatalogSnapshot(allApps);
      saveCatalogToGoogleDrive(allApps).catch(() => {});
    } catch {}

    res.json({ success: true, is_featured: Boolean(newFeatured) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update featured status' });
  }
});

// Sync Full Catalog from Client / LocalStorage Backup
router.post('/apps/sync-catalog', (req, res) => {
  try {
    const { apps } = req.body;
    if (Array.isArray(apps) && apps.length > 0) {
      restoreAppsToDb(apps);
      const allApps = getAllAppsFromDb();
      saveCatalogSnapshot(allApps);
      saveCatalogToGoogleDrive(allApps).catch(() => {});
      return res.json({ success: true, message: `Restored ${allApps.length} apps.`, count: allApps.length });
    }
    res.json({ success: true, count: getAllAppsFromDb().length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to sync catalog: ' + err.message });
  }
});

// Manually Backup Catalog to Google Drive
router.post('/apps/backup-drive', async (req, res) => {
  try {
    const allApps = getAllAppsFromDb();
    saveCatalogSnapshot(allApps);
    const fileId = await saveCatalogToGoogleDrive(allApps);
    res.json({
      success: true,
      message: `Successfully backed up ${allApps.length} apps to Google Drive.`,
      fileId,
      count: allApps.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to backup catalog to Drive: ' + err.message });
  }
});

// Manually Restore Catalog from Google Drive
router.post('/apps/restore-drive', async (req, res) => {
  try {
    const driveApps = await fetchCatalogFromGoogleDrive();
    if (!driveApps || !Array.isArray(driveApps) || driveApps.length === 0) {
      return res.status(404).json({ error: 'No catalog backup found on Google Drive.' });
    }

    restoreAppsToDb(driveApps);
    saveCatalogSnapshot(driveApps);
    res.json({
      success: true,
      message: `Successfully restored ${driveApps.length} apps from Google Drive cloud backup.`,
      count: driveApps.length,
      apps: driveApps
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore catalog from Drive: ' + err.message });
  }
});

// Export Catalog as JSON
router.get('/apps/export', async (req, res) => {
  try {
    await ensureAppsLoaded();
    const allApps = getAllAppsFromDb();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="myapps_catalog_export.json"');
    res.send(JSON.stringify(allApps, null, 2));
  } catch (err) {
    res.status(500).json({ error: 'Failed to export catalog: ' + err.message });
  }
});

// Toggle Published / Draft Status
router.patch('/apps/:id/status', async (req, res) => {
  try {
    await ensureAppsLoaded();
    const { id } = req.params;
    const { status } = req.body;
    if (!['published', 'draft'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const app = db.prepare('SELECT id FROM apps WHERE id = ?').get(id);
    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    db.prepare('UPDATE apps SET status = ? WHERE id = ?').run(status, id);

    // Persist catalog
    try {
      const allApps = getAllAppsFromDb();
      saveCatalogSnapshot(allApps);
      saveCatalogToGoogleDrive(allApps).catch(() => {});
    } catch {}

    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

export default router;
