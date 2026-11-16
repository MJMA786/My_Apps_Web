import { google } from 'googleapis';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSetting, setSetting, deleteSetting } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = Boolean(process.env.VERCEL);
const keyFilePath = isVercel
  ? path.join('/tmp', 'google-drive-key.json')
  : path.join(__dirname, '..', 'data', 'google-drive-key.json');

// Helper to extract clean folder ID from raw string or full URL
export function extractFolderId(raw) {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  const folderMatch = trimmed.match(/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const idMatch = trimmed.match(/id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  return trimmed;
}

// Helper to extract clean file ID from raw string or full URL (e.g. drive.google.com/file/d/XYZ or ?id=XYZ)
export function extractDriveFileId(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  const dMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch) return dMatch[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed) && !trimmed.includes('http') && !trimmed.includes('/') && !trimmed.includes('.')) {
    return trimmed;
  }
  return null;
}

// Helper to convert Google Drive share/view links into direct download links
export function formatDirectDriveDownloadUrl(url) {
  if (!url) return '';
  const fileId = extractDriveFileId(url);
  if (fileId) {
    return `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
  }
  return url.trim();
}

// Get configured target folder ID
export function getDriveFolderId() {
  const dbFolder = getSetting('google_drive_folder_id');
  if (dbFolder) return extractFolderId(dbFolder);
  const envFolder = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (envFolder) return extractFolderId(envFolder);
  return null;
}

// Get OAuth Config
export function getOAuthConfig() {
  const clientId = getSetting('google_oauth_client_id') || process.env.GOOGLE_OAUTH_CLIENT_ID || '';
  const clientSecret = getSetting('google_oauth_client_secret') || process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
  return { clientId, clientSecret };
}

// Get OAuth Tokens
export function getOAuthTokens() {
  const tokensJson = getSetting('google_oauth_tokens') || process.env.GOOGLE_OAUTH_TOKENS;
  if (!tokensJson) return null;
  try {
    return typeof tokensJson === 'string' ? JSON.parse(tokensJson) : tokensJson;
  } catch (e) {
    console.error('[GoogleDrive] Error parsing OAuth tokens:', e.message);
    return null;
  }
}

// Helper to get Google Drive auth client (Prefers OAuth2 user identity, falls back to Service Account)
export function getDriveAuth() {
  // 1. Try OAuth 2.0 (User personal @gmail.com)
  const oauthConfig = getOAuthConfig();
  const oauthTokens = getOAuthTokens();

  if (oauthConfig.clientId && oauthConfig.clientSecret && oauthTokens) {
    const oauth2Client = new google.auth.OAuth2(
      oauthConfig.clientId,
      oauthConfig.clientSecret
    );
    oauth2Client.setCredentials(oauthTokens);

    oauth2Client.on('tokens', (newTokens) => {
      const merged = { ...oauthTokens, ...newTokens };
      setSetting('google_oauth_tokens', JSON.stringify(merged));
      console.log('[GoogleDrive] OAuth tokens refreshed automatically and stored.');
    });

    return {
      type: 'oauth',
      auth: oauth2Client,
      clientEmail: getSetting('google_oauth_user_email') || 'Google Account'
    };
  }

  // 2. Try Service Account Key
  let credentials = null;
  if (fs.existsSync(keyFilePath)) {
    try {
      const fileData = fs.readFileSync(keyFilePath, 'utf8');
      credentials = JSON.parse(fileData);
    } catch (e) {
      console.error('[GoogleDrive] Error reading key file:', e.message);
    }
  }

  if (!credentials && process.env.GOOGLE_DRIVE_KEY_JSON) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_DRIVE_KEY_JSON);
    } catch (e) {
      console.error('[GoogleDrive] Error parsing GOOGLE_DRIVE_KEY_JSON:', e.message);
    }
  }

  if (credentials) {
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive']
    });
    return {
      type: 'service_account',
      auth,
      clientEmail: credentials.client_email
    };
  }

  return null;
}

// Check configuration status
export function getDriveStatus() {
  const authInfo = getDriveAuth();
  const folderId = getDriveFolderId();
  const oauthConfig = getOAuthConfig();
  const tokens = getOAuthTokens();

  return {
    configured: Boolean(authInfo),
    authType: authInfo ? authInfo.type : null, // 'oauth' or 'service_account'
    clientEmail: authInfo ? authInfo.clientEmail : null,
    folderId: folderId || null,
    oauthClientId: oauthConfig.clientId || null,
    hasClientSecret: Boolean(oauthConfig.clientSecret),
    oauthConnected: Boolean(oauthConfig.clientId && tokens),
    tokens: tokens || null
  };
}

// Generate OAuth 2.0 Authorization URL
export function generateOAuthUrl({ redirectUri, clientId, clientSecret, folderId }) {
  if (clientId) {
    setSetting('google_oauth_client_id', clientId.trim());
  }
  if (clientSecret) {
    setSetting('google_oauth_client_secret', clientSecret.trim());
  }
  if (folderId !== undefined) {
    setSetting('google_drive_folder_id', extractFolderId(folderId));
  }

  const conf = getOAuthConfig();
  if (!conf.clientId || !conf.clientSecret) {
    throw new Error('Google OAuth Client ID and Client Secret are required.');
  }

  const oauth2Client = new google.auth.OAuth2(
    conf.clientId,
    conf.clientSecret,
    redirectUri
  );

  // Encode state with clientId, clientSecret, and folderId so callback NEVER loses them across cold starts!
  const stateData = {
    clientId: conf.clientId,
    clientSecret: conf.clientSecret,
    folderId: extractFolderId(folderId) || ''
  };
  const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // Ensures a refresh_token is always returned on consent
    state,
    scope: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/userinfo.email'
    ]
  });

  return authUrl;
}

// Handle OAuth 2.0 Code Exchange Callback
export async function handleOAuthCallback({ code, redirectUri, state }) {
  if (!code) {
    throw new Error('Authorization code is missing.');
  }

  let stateData = {};
  if (state) {
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    } catch (e) {
      console.warn('[GoogleDrive] Could not decode state parameter:', e.message);
    }
  }

  const dbConf = getOAuthConfig();
  const clientId = stateData.clientId || dbConf.clientId;
  const clientSecret = stateData.clientSecret || dbConf.clientSecret;
  const folderId = stateData.folderId || getDriveFolderId();

  if (!clientId || !clientSecret) {
    throw new Error('OAuth configuration missing.');
  }

  setSetting('google_oauth_client_id', clientId.trim());
  setSetting('google_oauth_client_secret', clientSecret.trim());
  if (folderId) setSetting('google_drive_folder_id', extractFolderId(folderId));

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  setSetting('google_oauth_tokens', JSON.stringify(tokens));

  // Fetch real user email
  let email = 'Google Account';
  try {
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const about = await drive.about.get({ fields: 'user' });
    if (about.data.user && about.data.user.emailAddress) {
      email = about.data.user.emailAddress;
    }
  } catch (err) {
    console.warn('[GoogleDrive] Could not fetch user email in callback:', err.message);
  }

  setSetting('google_oauth_user_email', email);

  return {
    success: true,
    email,
    tokens,
    clientId,
    clientSecret,
    folderId
  };
}

// Disconnect OAuth 2.0
export function disconnectOAuth() {
  deleteSetting('google_oauth_tokens');
  deleteSetting('google_oauth_user_email');
  return { success: true };
}

// Save OAuth Config (without redirecting)
export function saveOAuthConfig({ clientId, clientSecret, folderId }) {
  if (clientId) setSetting('google_oauth_client_id', clientId.trim());
  if (clientSecret) setSetting('google_oauth_client_secret', clientSecret.trim());
  if (folderId !== undefined) setSetting('google_drive_folder_id', extractFolderId(folderId));
  return { success: true };
}

// Sync full Drive auth credentials from client session/localStorage
export function syncDriveAuth({ tokens, clientId, clientSecret, folderId, email }) {
  if (tokens) {
    const existingTokens = getOAuthTokens();
    const incomingTokens = typeof tokens === 'string' ? JSON.parse(tokens) : tokens;
    const merged = { ...(existingTokens || {}), ...(incomingTokens || {}) };
    // Always preserve refresh_token if present in existing
    if (!merged.refresh_token && existingTokens && existingTokens.refresh_token) {
      merged.refresh_token = existingTokens.refresh_token;
    }
    setSetting('google_oauth_tokens', JSON.stringify(merged));
  }
  if (clientId) setSetting('google_oauth_client_id', clientId.trim());
  if (clientSecret) setSetting('google_oauth_client_secret', clientSecret.trim());
  if (folderId !== undefined && folderId !== null) setSetting('google_drive_folder_id', extractFolderId(folderId));
  if (email) setSetting('google_oauth_user_email', email.trim());
  return { success: true };
}

// Test Drive Connection & Quota (Works for both OAuth and Service Account)
export async function testDriveConnection() {
  const authInfo = getDriveAuth();
  if (!authInfo) {
    throw new Error('Google Drive is not connected yet. Connect your Google Account or Service Account in Settings.');
  }

  const drive = google.drive({ version: 'v3', auth: authInfo.auth });
  
  // Test about
  const about = await drive.about.get({
    fields: 'user, storageQuota'
  });

  let folderName = 'Root Drive';
  const folderId = getDriveFolderId();
  if (folderId) {
    try {
      const folderRes = await drive.files.get({
        fileId: folderId,
        fields: 'id, name, driveId',
        supportsAllDrives: true
      });
      folderName = folderRes.data.name;
    } catch (err) {
      console.warn('[GoogleDrive] Warning verifying folder:', err.message);
      folderName = `${folderId} (Check folder access)`;
    }
  }

  return {
    success: true,
    authType: authInfo.type,
    user: about.data.user,
    storageQuota: about.data.storageQuota,
    folderId: folderId || null,
    folderName
  };
}

// Upload a local file to Google Drive & Make Publicly Readable (Server-side)
export async function uploadToGoogleDrive({ filePath, originalName, mimeType }) {
  const authInfo = getDriveAuth();
  if (!authInfo) {
    throw new Error('Google Drive is not configured.');
  }

  const drive = google.drive({ version: 'v3', auth: authInfo.auth });
  const folderId = getDriveFolderId();

  const fileMetadata = {
    name: originalName
  };

  if (folderId) {
    fileMetadata.parents = [folderId];
  }

  const media = {
    mimeType: mimeType || 'application/octet-stream',
    body: fs.createReadStream(filePath)
  };

  console.log(`[GoogleDrive] Uploading "${originalName}" to Google Drive...`);
  const uploadRes = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    supportsAllDrives: true,
    fields: 'id, name, size, webViewLink, webContentLink'
  });

  const fileId = uploadRes.data.id;

  // Make file publicly readable
  try {
    await drive.permissions.create({
      fileId: fileId,
      supportsAllDrives: true,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
  } catch (permErr) {
    console.warn('[GoogleDrive] Could not set public permission:', permErr.message);
  }

  // Direct download link format
  const directDownloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
  const previewUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;

  // Remove local temp file to keep disk 100% clean
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[GoogleDrive] Removed local temp file: ${filePath}`);
    }
  } catch (unlinkErr) {
    console.warn('[GoogleDrive] Local file cleanup warning:', unlinkErr.message);
  }

  return {
    driveFileId: fileId,
    name: uploadRes.data.name,
    size: uploadRes.data.size,
    directDownloadUrl,
    previewUrl,
    webViewLink: uploadRes.data.webViewLink
  };
}

// Create Resumable Upload Session for Direct Browser-to-Drive Upload (Bypasses Vercel payload limit)
export async function createResumableUploadSession({ fileName, mimeType, fileSize, origin }) {
  const authInfo = getDriveAuth();
  if (!authInfo) {
    throw new Error('Google Drive is not connected yet.');
  }

  let tokenString = '';
  if (authInfo.type === 'oauth') {
    const tokenRes = await authInfo.auth.getAccessToken();
    tokenString = tokenRes.token;
  } else {
    const client = await authInfo.auth.getClient();
    const tokenRes = await client.getAccessToken();
    tokenString = tokenRes.token;
  }

  const folderId = getDriveFolderId();

  const metadata = {
    name: fileName
  };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const headers = {
    'Authorization': `Bearer ${tokenString}`,
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Upload-Content-Type': mimeType || 'application/octet-stream'
  };

  if (fileSize) {
    headers['X-Upload-Content-Length'] = String(fileSize);
  }

  if (origin) {
    headers['Origin'] = origin;
  }

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true';
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(metadata)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Drive API error (${response.status}): ${errText}`);
  }

  const sessionUrl = response.headers.get('location');
  if (!sessionUrl) {
    throw new Error('Failed to retrieve resumable upload session location from Google Drive.');
  }

  return { sessionUrl };
}

// Finalize Resumable Upload (Make publicly readable and get direct download link)
export async function finishResumableUpload({ fileId }) {
  if (!fileId) {
    throw new Error('fileId is required to finalize Google Drive upload');
  }

  const authInfo = getDriveAuth();
  if (!authInfo) {
    throw new Error('Google Drive is not configured.');
  }

  const drive = google.drive({ version: 'v3', auth: authInfo.auth });

  // Make file publicly readable
  try {
    await drive.permissions.create({
      fileId,
      supportsAllDrives: true,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
  } catch (permErr) {
    console.warn('[GoogleDrive] Could not set public permission on direct upload:', permErr.message);
  }

  // Get file metadata
  let name = '';
  let size = 0;
  let webViewLink = '';
  try {
    const fileRes = await drive.files.get({
      fileId,
      fields: 'id, name, size, webViewLink, webContentLink',
      supportsAllDrives: true
    });
    name = fileRes.data.name;
    size = fileRes.data.size;
    webViewLink = fileRes.data.webViewLink;
  } catch (err) {
    console.warn('[GoogleDrive] Warning fetching file details after direct upload:', err.message);
  }

  const directDownloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
  const previewUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;

  return {
    driveFileId: fileId,
    name,
    size,
    directDownloadUrl,
    previewUrl,
    webViewLink
  };
}

// Delete a file from Google Drive (Frees up quota immediately)
export async function deleteFromGoogleDrive(driveFileId) {
  if (!driveFileId) return false;
  const authInfo = getDriveAuth();
  if (!authInfo) return false;

  try {
    const drive = google.drive({ version: 'v3', auth: authInfo.auth });
    console.log(`[GoogleDrive] Deleting file ${driveFileId} from Google Drive...`);
    await drive.files.delete({ 
      fileId: driveFileId,
      supportsAllDrives: true 
    });
    console.log(`[GoogleDrive] Successfully deleted ${driveFileId} from Drive. Storage freed!`);
    return true;
  } catch (err) {
    console.warn(`[GoogleDrive] Could not delete file ${driveFileId}:`, err.message);
    return false;
  }
}

// Save Service Account Key from Admin Dashboard (Legacy / Workspace fallback)
export function saveDriveCredentials(keyJsonString, folderId) {
  const parsed = typeof keyJsonString === 'string' ? JSON.parse(keyJsonString) : keyJsonString;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('Invalid Service Account JSON. Missing "client_email" or "private_key".');
  }

  fs.writeFileSync(keyFilePath, JSON.stringify(parsed, null, 2), 'utf8');

  if (folderId !== undefined) {
    const cleanId = extractFolderId(folderId);
    setSetting('google_drive_folder_id', cleanId);
    if (!isVercel) {
      try {
        const envPath = path.join(__dirname, '..', '.env');
        let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        if (envContent.includes('GOOGLE_DRIVE_FOLDER_ID=')) {
          envContent = envContent.replace(/GOOGLE_DRIVE_FOLDER_ID=.*(\r?\n|$)/, `GOOGLE_DRIVE_FOLDER_ID=${cleanId}$1`);
        } else {
          envContent += `\nGOOGLE_DRIVE_FOLDER_ID=${cleanId}\n`;
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
      } catch {}
    }
    process.env.GOOGLE_DRIVE_FOLDER_ID = cleanId;
  }

  return {
    success: true,
    clientEmail: parsed.client_email,
    folderId: extractFolderId(folderId) || null
  };
}

// Save entire apps catalog to Google Drive as myapps_catalog.json (Zero-loss cloud sync)
export async function saveCatalogToGoogleDrive(appsList) {
  try {
    const authInfo = getDriveAuth();
    if (!authInfo) return null;

    const drive = google.drive({ version: 'v3', auth: authInfo.auth });
    const folderId = getDriveFolderId();
    const content = JSON.stringify(appsList, null, 2);

    // Check if myapps_catalog.json already exists in Drive
    let fileId = getSetting('google_drive_catalog_file_id');
    if (fileId) {
      try {
        await drive.files.get({ fileId, fields: 'id, trashed', supportsAllDrives: true });
      } catch {
        fileId = null;
      }
    }

    if (!fileId) {
      let query = "name = 'myapps_catalog.json' and trashed = false";
      if (folderId) {
        query += ` and '${folderId}' in parents`;
      }
      try {
        const searchRes = await drive.files.list({
          q: query,
          fields: 'files(id, name)',
          spaces: 'drive',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });
        if (searchRes.data.files && searchRes.data.files.length > 0) {
          fileId = searchRes.data.files[0].id;
          setSetting('google_drive_catalog_file_id', fileId);
        }
      } catch (listErr) {
        console.warn('[GoogleDrive] Could not list files for catalog search:', listErr.message);
      }
    }

    const { Readable } = await import('node:stream');
    const mediaStream = Readable.from([content]);

    if (fileId) {
      // Update existing file
      await drive.files.update({
        fileId,
        media: {
          mimeType: 'application/json',
          body: mediaStream
        },
        supportsAllDrives: true
      });
      console.log(`[GoogleDrive] Updated catalog backup (${appsList.length} apps) on Google Drive.`);
      return fileId;
    } else {
      // Create new file
      const fileMetadata = {
        name: 'myapps_catalog.json',
        mimeType: 'application/json'
      };
      if (folderId) {
        fileMetadata.parents = [folderId];
      }
      const createRes = await drive.files.create({
        requestBody: fileMetadata,
        media: {
          mimeType: 'application/json',
          body: mediaStream
        },
        fields: 'id',
        supportsAllDrives: true
      });
      fileId = createRes.data.id;
      setSetting('google_drive_catalog_file_id', fileId);
      console.log(`[GoogleDrive] Created new catalog backup (${appsList.length} apps) on Google Drive: ${fileId}`);
      return fileId;
    }
  } catch (err) {
    console.warn('[GoogleDrive] Error saving catalog to Google Drive:', err.message);
    return null;
  }
}

// Fetch apps catalog from Google Drive
export async function fetchCatalogFromGoogleDrive() {
  try {
    const authInfo = getDriveAuth();
    if (!authInfo) return null;

    const drive = google.drive({ version: 'v3', auth: authInfo.auth });
    const folderId = getDriveFolderId();

    let fileId = getSetting('google_drive_catalog_file_id');
    if (!fileId) {
      let query = "name = 'myapps_catalog.json' and trashed = false";
      if (folderId) {
        query += ` and '${folderId}' in parents`;
      }
      try {
        const searchRes = await drive.files.list({
          q: query,
          fields: 'files(id, name)',
          spaces: 'drive',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });
        if (searchRes.data.files && searchRes.data.files.length > 0) {
          fileId = searchRes.data.files[0].id;
          setSetting('google_drive_catalog_file_id', fileId);
        }
      } catch (listErr) {
        console.warn('[GoogleDrive] Could not list files for catalog read:', listErr.message);
      }
    }

    if (!fileId) return null;

    const fileRes = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'text' }
    );

    const apps = typeof fileRes.data === 'string' ? JSON.parse(fileRes.data) : fileRes.data;
    if (Array.isArray(apps)) {
      return apps;
    }
    return null;
  } catch (err) {
    console.warn('[GoogleDrive] Error fetching catalog from Google Drive:', err.message);
    return null;
  }
}
