import { google } from 'googleapis';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

// Helper to get Google Drive auth client
export function getDriveAuth() {
  let credentials = null;

  // 1. Check if JSON file exists in server/data/
  if (fs.existsSync(keyFilePath)) {
    try {
      const fileData = fs.readFileSync(keyFilePath, 'utf8');
      credentials = JSON.parse(fileData);
    } catch (e) {
      console.error('[GoogleDrive] Error reading key file:', e.message);
    }
  }

  // 2. Check if environment variable has JSON string
  if (!credentials && process.env.GOOGLE_DRIVE_KEY_JSON) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_DRIVE_KEY_JSON);
    } catch (e) {
      console.error('[GoogleDrive] Error parsing GOOGLE_DRIVE_KEY_JSON:', e.message);
    }
  }

  if (!credentials) {
    return null;
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive']
  });

  return { auth, clientEmail: credentials.client_email };
}

// Check configuration status
export function getDriveStatus() {
  const authInfo = getDriveAuth();
  const folderId = extractFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID);
  return {
    configured: Boolean(authInfo),
    clientEmail: authInfo ? authInfo.clientEmail : null,
    folderId: folderId || null
  };
}

// Test Drive Connection & Quota
export async function testDriveConnection() {
  const authInfo = getDriveAuth();
  if (!authInfo) {
    throw new Error('Google Drive service account credentials are not configured yet.');
  }

  const drive = google.drive({ version: 'v3', auth: authInfo.auth });
  
  // Test about
  const about = await drive.about.get({
    fields: 'user, storageQuota'
  });

  let folderName = 'Root Drive';
  const folderId = extractFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID);
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
      folderName = `${folderId} (Check folder sharing permissions)`;
    }
  }

  return {
    success: true,
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
  const folderId = extractFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID);

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
    throw new Error('Google Drive service account credentials are not configured yet.');
  }

  const client = await authInfo.auth.getClient();
  const token = await client.getAccessToken();
  const folderId = extractFolderId(process.env.GOOGLE_DRIVE_FOLDER_ID);

  const metadata = {
    name: fileName
  };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const headers = {
    'Authorization': `Bearer ${token.token}`,
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

// Save Service Account Key from Admin Dashboard
export function saveDriveCredentials(keyJsonString, folderId) {
  const parsed = typeof keyJsonString === 'string' ? JSON.parse(keyJsonString) : keyJsonString;
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('Invalid Service Account JSON. Missing "client_email" or "private_key".');
  }

  fs.writeFileSync(keyFilePath, JSON.stringify(parsed, null, 2), 'utf8');

  if (folderId !== undefined) {
    const cleanId = extractFolderId(folderId);
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
