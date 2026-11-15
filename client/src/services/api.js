const API_BASE = '/api';

// Safe Response Parser to prevent "Unexpected token A in JSON"
async function parseJsonResponse(res, defaultError = 'Request failed') {
  const text = await res.text();
  
  if (res.status === 413 || text.includes('Request Entity Too Large') || text.includes('Request En')) {
    throw new Error("File is too large for Vercel's direct serverless upload (limit is 4.5 MB). Please select 'External Mirror URL' and paste your Google Drive link.");
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(text || `${defaultError} (${res.status})`);
  }
  if (!res.ok) {
    throw new Error(data.error || data.message || `${defaultError} (${res.status})`);
  }
  return data;
}

// Helper for authorized headers
function getAuthHeaders(isFormData = false) {
  const token = localStorage.getItem('myapps_token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

export const api = {
  // Public App APIs
  async getFeaturedApps() {
    const res = await fetch(`${API_BASE}/apps/featured`);
    if (!res.ok) throw new Error('Failed to fetch featured apps');
    return res.json();
  },

  async getApps(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.category) query.append('category', params.category);
    if (params.platform) query.append('platform', params.platform);
    if (params.sort) query.append('sort', params.sort);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);

    const res = await fetch(`${API_BASE}/apps?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch apps');
    return res.json();
  },

  async getAppBySlug(slug) {
    const res = await fetch(`${API_BASE}/apps/${slug}`);
    if (!res.ok) throw new Error('App not found');
    return res.json();
  },

  async getCategories() {
    const res = await fetch(`${API_BASE}/apps/categories`);
    if (!res.ok) throw new Error('Failed to fetch categories');
    return res.json();
  },

  async getPlatforms() {
    const res = await fetch(`${API_BASE}/apps/platforms`);
    if (!res.ok) throw new Error('Failed to fetch platforms');
    return res.json();
  },

  getDownloadUrl(slug) {
    return `${API_BASE}/apps/${slug}/download`;
  },

  // Auth APIs
  async login(username, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return parseJsonResponse(res, 'Login failed');
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Unauthorized');
    return res.json();
  },

  async updateProfile(profileData) {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(profileData)
    });
    return parseJsonResponse(res, 'Failed to update profile');
  },

  // Admin APIs
  async getAdminStats() {
    const res = await fetch(`${API_BASE}/admin/stats`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch admin stats');
    return res.json();
  },

  async getAdminApps(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.status) query.append('status', params.status);
    if (params.category) query.append('category', params.category);
    if (params.platform) query.append('platform', params.platform);

    const res = await fetch(`${API_BASE}/admin/apps?${query.toString()}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch admin apps');
    return res.json();
  },

  async getAdminAppById(id) {
    const res = await fetch(`${API_BASE}/admin/apps/${id}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch app');
    return res.json();
  },

  async createApp(payload) {
    const isFormData = payload instanceof FormData;
    const res = await fetch(`${API_BASE}/admin/apps`, {
      method: 'POST',
      headers: getAuthHeaders(isFormData),
      body: isFormData ? payload : JSON.stringify(payload)
    });
    return parseJsonResponse(res, 'Failed to create app');
  },

  async updateApp(id, payload) {
    const isFormData = payload instanceof FormData;
    const res = await fetch(`${API_BASE}/admin/apps/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(isFormData),
      body: isFormData ? payload : JSON.stringify(payload)
    });
    return parseJsonResponse(res, 'Failed to update app');
  },

  async deleteApp(id) {
    const res = await fetch(`${API_BASE}/admin/apps/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete app');
    return data;
  },

  async toggleFeatured(id) {
    const res = await fetch(`${API_BASE}/admin/apps/${id}/featured`, {
      method: 'PATCH',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to toggle featured status');
    return res.json();
  },

  async updateStatus(id, status) {
    const res = await fetch(`${API_BASE}/admin/apps/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Failed to update status');
    return res.json();
  },

  // Google Drive Cloud Storage APIs
  async getDriveStatus() {
    const res = await fetch(`${API_BASE}/admin/drive/status`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch Drive status');
    return res.json();
  },

  async testDriveConnection() {
    const res = await fetch(`${API_BASE}/admin/drive/test`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Drive test failed');
    return data;
  },

  async saveDriveConfig(configData) {
    const res = await fetch(`${API_BASE}/admin/drive/config`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(configData)
    });
    return parseJsonResponse(res, 'Failed to save Drive config');
  },

  async initDriveUpload({ fileName, mimeType, fileSize }) {
    const res = await fetch(`${API_BASE}/admin/drive/init-upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ fileName, mimeType, fileSize })
    });
    return parseJsonResponse(res, 'Failed to initialize Google Drive upload session');
  },

  async finishDriveUpload(fileId) {
    const res = await fetch(`${API_BASE}/admin/drive/finish-upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ fileId })
    });
    return parseJsonResponse(res, 'Failed to finalize Google Drive upload');
  },

  // Direct Browser-to-Google Drive Upload with real-time Progress Tracking
  // Completely bypasses Vercel 4.5MB serverless limits
  async uploadFileToDrive(file, onProgress) {
    // 1. Get resumable upload session from backend
    const initRes = await fetch(`${API_BASE}/admin/drive/init-upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size
      })
    });
    const initData = await parseJsonResponse(initRes, 'Failed to initialize Drive upload session');
    const { sessionUrl } = initData;

    // 2. Upload file directly to Google Drive via XMLHttpRequest
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', sessionUrl, true);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent, event.loaded, event.total);
          }
        };
      }

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const driveFile = JSON.parse(xhr.responseText);
            // 3. Finalize upload (sets public read permission & gets download link)
            const finishRes = await fetch(`${API_BASE}/admin/drive/finish-upload`, {
              method: 'POST',
              headers: getAuthHeaders(),
              body: JSON.stringify({ fileId: driveFile.id })
            });
            const finishData = await parseJsonResponse(finishRes, 'Failed to finalize Drive upload');
            resolve(finishData);
          } catch (e) {
            reject(new Error('Failed to finalize uploaded Drive file: ' + e.message));
          }
        } else {
          let errDetail = xhr.responseText;
          try {
            const parsed = JSON.parse(xhr.responseText);
            if (parsed.error && parsed.error.message) {
              errDetail = parsed.error.message;
            }
          } catch {}

          if (xhr.status === 403 && (errDetail.includes('storage quota') || errDetail.includes('Service Accounts do not have storage quota'))) {
            reject(new Error('GOOGLE_DRIVE_QUOTA_ERROR: Service Accounts cannot upload directly to personal @gmail.com folders. Use the External Mirror URL tab to paste your Google Drive share link!'));
          } else {
            reject(new Error(`Google Drive upload failed (${xhr.status}): ${errDetail}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during Google Drive direct upload.'));
      };

      xhr.send(file);
    });
  }
};
