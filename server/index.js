import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import './db.js'; // Initializes database and seeds
import { uploadsDir } from './db.js';
import { syncDriveAuth } from './services/googleDrive.js';
import authRoutes from './routes/auth.js';
import appsRoutes from './routes/apps.js';
import adminRoutes from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Auto-hydrate Drive authentication if passed by client via x-drive-auth header (solves serverless ephemeral cold starts)
app.use((req, res, next) => {
  const driveAuthHeader = req.headers['x-drive-auth'];
  if (driveAuthHeader) {
    try {
      const data = typeof driveAuthHeader === 'string' ? JSON.parse(driveAuthHeader) : driveAuthHeader;
      syncDriveAuth(data);
    } catch (e) {
      console.warn('[Server] Error restoring drive auth from header:', e.message);
    }
  }
  next();
});

// Serve Uploads Directory
app.use('/uploads', express.static(uploadsDir));

// Serve generic fallback icon if requested
app.get('/demo-icons/:name', (req, res) => {
  const fallbackSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <rect width="100" height="100" rx="22" fill="#4F46E5"/>
    <path d="M50 25 L75 40 V70 L50 85 L25 70 V40 Z" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linejoin="round"/>
    <circle cx="50" cy="55" r="10" fill="#FFFFFF"/>
  </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(fallbackSVG);
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/apps', appsRoutes);
app.use('/api/admin', adminRoutes);

// System Status Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Serve Frontend in Production
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    }
  });
}

// Start Server if run directly
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 MyAppsWeb Server running on port ${PORT}`);
    console.log(`🔗 API Base: http://localhost:${PORT}/api`);
    console.log(`👤 Default Admin: admin / admin123`);
    console.log(`===============================================`);
  });
}

export default app;
