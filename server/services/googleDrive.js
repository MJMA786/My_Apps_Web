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
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
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
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (folderId) {
    try {
      const folderRes = await drive.files.get({
        fileId: folderId,
        fields: 'id, name'
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

// Upload a local file to Google Drive & Make Publicly Readable
export async function uploadToGoogleDrive({ filePath, originalName, mimeType }) {
  const authInfo = getDriveAuth();
  if (!authInfo) {
    throw new Error('Google Drive is not configured.');
  }

  const drive = google.drive({ version: 'v3', auth: authInfo.auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const fileMetadata = {
    name: originalName
  };

  if (folderId && folderId.trim()) {
    fileMetadata.parents = [folderId.trim()];
  }

  const media = {
    mimeType: mimeType || 'application/octet-stream',
    body: fs.createReadStream(filePath)
  };

  console.log(`[GoogleDrive] Uploading "${originalName}" to Google Drive...`);
  const uploadRes = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, name, size, webViewLink, webContentLink'
  });

  const fileId = uploadRes.data.id;

  // Make file publicly readable
  try {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });
  } catch (permErr) {
    console.warn('[GoogleDrive] Could not set public permission:', permErr.message);
  }

  // Direct download link format
  // Google's direct download endpoint
  const directDownloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
  
  // For images / preview:
  const previewUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;

  // Remove local temp file to keep disk 100% clean!
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

// Delete a file from Google Drive (Frees up quota immediately)
export async function deleteFromGoogleDrive(driveFileId) {
  if (!driveFileId) return false;
  const authInfo = getDriveAuth();
  if (!authInfo) return false;

  try {
    const drive = google.drive({ version: 'v3', auth: authInfo.auth });
    console.log(`[GoogleDrive] Deleting file ${driveFileId} from Google Drive...`);
    await drive.files.delete({ fileId: driveFileId });
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
    if (!isVercel) {
      try {
        const envPath = path.join(__dirname, '..', '.env');
        let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        if (envContent.includes('GOOGLE_DRIVE_FOLDER_ID=')) {
          envContent = envContent.replace(/GOOGLE_DRIVE_FOLDER_ID=.*(\r?\n|$)/, `GOOGLE_DRIVE_FOLDER_ID=${folderId.trim()}$1`);
        } else {
          envContent += `\nGOOGLE_DRIVE_FOLDER_ID=${folderId.trim()}\n`;
        }
        fs.writeFileSync(envPath, envContent, 'utf8');
      } catch {}
    }
    process.env.GOOGLE_DRIVE_FOLDER_ID = folderId.trim();
  }

  return {
    success: true,
    clientEmail: parsed.client_email,
    folderId: folderId || null
  };
}
