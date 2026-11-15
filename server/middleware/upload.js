import multer from 'multer';
import path from 'node:path';
import { iconsDir, screenshotsDir, filesDir } from '../db.js';

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'icon') {
      cb(null, iconsDir);
    } else if (file.fieldname === 'screenshots') {
      cb(null, screenshotsDir);
    } else if (file.fieldname === 'file') {
      cb(null, filesDir);
    } else {
      cb(null, filesDir);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${base}-${uniqueSuffix}${ext}`);
  }
});

// Allow app files up to 500MB, images up to 20MB
export const uploadAppAssets = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB
  }
}).fields([
  { name: 'icon', maxCount: 1 },
  { name: 'file', maxCount: 1 },
  { name: 'screenshots', maxCount: 10 }
]);
