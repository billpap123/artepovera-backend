// src/server.ts
import express from 'express';
import sequelize from './config/db';
import routes from './routes/index';
import dotenv from 'dotenv';
import cors from 'cors';
import multer, { FileFilterCallback } from 'multer';
import path from 'path'; // Ensure path is imported
import fs from 'fs';   // Ensure fs is imported
import helmet from 'helmet';

// Load environment variables from .env
dotenv.config();

// Import models and associations (Sequelize relationships)
import './models/associations';

const app = express();

// --- START DEBUG LOGGING ---
console.log('--- Upload Directory Debug ---');
// --------------------------------------
// Determine and ensure the uploads directory exists
// --------------------------------------
// If using persistent disk, set PERSISTENT_UPLOAD_DIR to the mount path (e.g., /var/data/uploads)
// Otherwise, fallback to the default "uploads" folder
const persistentUploadDir = process.env.PERSISTENT_UPLOAD_DIR;
console.log(`[DEBUG] [ENV] PERSISTENT_UPLOAD_DIR: ${persistentUploadDir}`); // Log Env Var

const rawUploadFolder = persistentUploadDir || process.env.UPLOAD_FOLDER || 'uploads';
const uploadDirectory = persistentUploadDir
  ? rawUploadFolder  // rawUploadFolder already contains the absolute persistent disk path (e.g., /var/data/uploads)
  : path.join(__dirname, '..', rawUploadFolder); // fallback to relative path

console.log(`[DEBUG] [CONFIG] Resolved uploadDirectory: ${uploadDirectory}`); // Log the path actually used!

// Check if directory exists/create it
if (!fs.existsSync(uploadDirectory)) {
  try {
    console.log(`[DEBUG] [FS] Directory does not exist. Attempting to create: ${uploadDirectory}`); // Log creation attempt
    fs.mkdirSync(uploadDirectory, { recursive: true });
    console.log(`[DEBUG] [FS] Directory created successfully: ${uploadDirectory}`); // Log success
  } catch (err) {
    console.error(`[ERROR] [FS] Failed to create directory ${uploadDirectory}:`, err); // Log specific error
  }
} else {
   console.log(`[DEBUG] [FS] Directory already exists: ${uploadDirectory}`); // Log if exists
}
// --- END DEBUG LOGGING ---


// --------------------------------------
// Sync database models
// --------------------------------------
sequelize
  .sync({ alter: true })
  .then(() => console.log('Database & tables synced successfully!'))
  .catch((error) => console.error('Error syncing database:', error.message));

// --------------------------------------
// Helmet configuration for security
// --------------------------------------
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// --------------------------------------
// Fix profile picture URL handling (remove double "/uploads")
// --------------------------------------
app.use('/uploads', (req, res, next) => {
  if (req.url.startsWith('/uploads/uploads/')) {
    // console.log(`[DEBUG] Fixing double uploads URL: ${req.url}`); // Optional: log URL fixing
    req.url = req.url.replace('/uploads/uploads/', '/uploads/');
  }
  next();
});

// --------------------------------------
// Serve static files from /uploads
// --------------------------------------
console.log(`[DEBUG] [STATIC] Setting up static server for route '/uploads' from path: ${uploadDirectory}`); // Log static setup
app.use('/uploads', express.static(uploadDirectory));

// --------------------------------------
// CORS CONFIGURATION
// --------------------------------------
const allowedOrigins = [
  'http://localhost:3000',
  'https://artepovera2.vercel.app',
  'https://artepovera2-dyloo5rwa-vasilis-projects-01b75e68.vercel.app',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // console.warn(`[CORS] Blocked origin: ${origin}`); // Optional: log blocked origins
        callback(new Error(`CORS: Origin ${origin} not allowed.`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  })
);

// Allow preflight requests for all routes
app.options('*', cors());

// --------------------------------------
// MULTER SETUP (file uploads)
// --------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Log the destination being used for *this specific upload*
    console.log(`[DEBUG] [MULTER] Destination check for file '${file.originalname}'. Using path: ${uploadDirectory}`);
    // Optional: Check existence again right before upload, though less critical with startup check
    // if (!fs.existsSync(uploadDirectory)) { console.error(`[ERROR] [MULTER] Destination directory ${uploadDirectory} missing JUST BEFORE upload!`); }
    cb(null, uploadDirectory); // Use the resolved uploadDirectory
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    // console.log(`[DEBUG] [MULTER] Generating filename: ${uniqueName}`); // Optional: log filename
    cb(null, uniqueName);
  },
});

const fileFilter = (req: any, file: any, cb: FileFilterCallback) => {
  if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
    cb(null, true);
  } else {
    // console.log(`[DEBUG] [MULTER] File rejected by filter: ${file.originalname} (${file.mimetype})`); // Optional: log rejected files
    cb(null, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

// --------------------------------------
// Parse JSON and URL-encoded bodies
// --------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------------------------
// USE YOUR MAIN API ROUTES
// --------------------------------------
// Example: Assuming your routes might use the 'upload' middleware
// Make sure routes needing upload are defined *after* multer setup
// E.g., app.post('/api/profile/picture', upload.single('profilePic'), yourRouteHandler);
app.use('/api', routes);

// --------------------------------------
// ERROR HANDLING
// --------------------------------------
app.use((err: any, req: any, res: any, next: any) => {
  console.error("[ERROR] Unhandled error:", err.stack); // Log the full stack
  res.status(500).json({ error: 'Internal Server Error' });
});

// --------------------------------------
// START THE SERVER
// --------------------------------------
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // Log final confirmation after server starts
  console.log(`[INFO] Upload directory configured as: ${uploadDirectory}`);
  console.log(`[INFO] Static files for /uploads route served from: ${uploadDirectory}`);
});