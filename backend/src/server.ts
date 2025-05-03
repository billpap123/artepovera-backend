// src/server.ts
// Imports needed for Express, Sequelize, Routes, Cors, Helmet, Dotenv, Multer, Cloudinary
import express from 'express';
import sequelize from './config/db';
import routes from './routes/index';
import dotenv from 'dotenv';
import cors from 'cors';
import multer, { FileFilterCallback } from 'multer';
import path from 'path'; // Keep path for potential use (e.g., path.extname)
import helmet from 'helmet';
import { v2 as cloudinary } from 'cloudinary'; // Import Cloudinary SDK

// Load environment variables from .env
dotenv.config();

// Import models and associations (Sequelize relationships)
import './models/associations'; // Ensure this path is correct

// --- Cloudinary Configuration ---
cloudinary.config({
  // These names MUST match the environment variables you set in Render
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // Use https URLs
});
// Log confirmation (avoid logging the secret!)
console.log('[Cloudinary] SDK Configured. Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? 'OK' : 'MISSING!');
// --- End Cloudinary Configuration ---

const app = express();

// --------------------------------------
// REMOVED: Disk path calculation and fs.mkdirSync logic
// --------------------------------------

// --------------------------------------
// Sync database models
// --------------------------------------
sequelize
  .sync({ alter: true }) // Consider changing alter: true to false in production
  .then(() => console.log('Database & tables synced successfully!'))
  .catch((error) => console.error('Error syncing database:', error.message));

// --------------------------------------
// Helmet configuration for security
// --------------------------------------
app.use(
  helmet({
    // Adjust Helmet options as needed, defaults are often good
    crossOriginEmbedderPolicy: false, // Keep if needed for compatibility
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Keep if needed
  })
);

// --------------------------------------
// REMOVED: URL fixing middleware for '/uploads/uploads'
// --------------------------------------

// --------------------------------------
// REMOVED: express.static for '/uploads' - Cloudinary handles serving
// --------------------------------------

// --------------------------------------
// CORS CONFIGURATION
// --------------------------------------
const allowedOrigins = [
  'http://localhost:3000', // For local dev
  'https://artepovera2.vercel.app', // Your main frontend URL
  // Add any other Vercel preview URLs if needed, or use a more dynamic check
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl) OR from allowed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked origin: ${origin}`); // Good to log blocked origins
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
// MULTER SETUP (Using Memory Storage)
// --------------------------------------
const storage = multer.memoryStorage(); // Configure multer to use memory storage

const fileFilter = (req: any, file: any, cb: FileFilterCallback) => {
  // Keep your file type filter
  if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
    cb(null, true);
  } else {
    console.log(`[MULTER] File rejected by filter: ${file.originalname} (${file.mimetype})`);
    cb(null, false);
  }
};

// Create the multer instance configured for memory storage
const upload = multer({
  storage: storage, // Use memory storage
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Keep 5 MB limit
});
// --- End Multer Setup ---

// --------------------------------------
// Parse JSON and URL-encoded bodies
// --------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------------------------
// USE YOUR MAIN API ROUTES
// --------------------------------------
// IMPORTANT: Your actual upload logic using cloudinary.uploader.upload_stream
// needs to be implemented within the route handlers defined in './routes/index'
// where you use the 'upload' middleware (e.g., upload.single('profilePic'))
app.use('/api', routes);
console.log('[SETUP] API routes mounted under /api');

// --------------------------------------
// ERROR HANDLING
// --------------------------------------
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[ERROR] Unhandled error:", err.stack); // Log the full stack
  // Avoid sending stack trace in production
  res.status(err.status || 500).json({
       error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
       // Optionally include stack in dev
       ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
   });
});
// Export the configured multer instance
export { upload }; // <<< ADD THIS LINE

// --------------------------------------
// START THE SERVER
// --------------------------------------
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // REMOVED logs related to the old uploadDirectory
});

// Export 'upload' if needed by your routes file directly (alternative to passing via req)
// export { upload }; // Uncomment if your route setup imports it