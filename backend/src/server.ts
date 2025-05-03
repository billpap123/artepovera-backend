// src/server.ts
// Imports needed for Express, Sequelize, Routes, Cors, Helmet, Dotenv, Cloudinary
import express from 'express';
import sequelize from './config/db';
import routes from './routes/index'; // Imports the configured router
import dotenv from 'dotenv';
import cors from 'cors';
// REMOVED: import multer, { FileFilterCallback } from 'multer'; // Multer is now configured elsewhere
import path from 'path'; // Keep path if needed elsewhere (e.g., by dependencies)
import helmet from 'helmet';
import { v2 as cloudinary } from 'cloudinary'; // Import Cloudinary SDK

// Load environment variables from .env
dotenv.config();

// Import models and associations (Sequelize relationships)
import './models/associations'; // Ensure this path is correct

// --- Cloudinary Configuration ---
// Ensure Cloudinary is configured early
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
// REMOVED: Disk path calculation, fs.mkdirSync logic, and related debug logs
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
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// --------------------------------------
// REMOVED: URL fixing middleware for '/uploads/uploads'
// --------------------------------------

// --------------------------------------
// REMOVED: express.static for '/uploads' and related debug logs
// --------------------------------------

// --------------------------------------
// CORS CONFIGURATION
// --------------------------------------
const allowedOrigins = [
  'http://localhost:3000', // For local dev
  'https://artepovera2.vercel.app', // Your main frontend URL
  // Add any other Vercel preview URLs if needed
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Blocked origin: ${origin}`);
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
// REMOVED: MULTER SETUP (Moved to middleware/multerConfig.ts)
// --------------------------------------
// REMOVED: const storage = multer.memoryStorage();
// REMOVED: const fileFilter = (req: any, file: any, cb: FileFilterCallback) => { ... };
// REMOVED: const upload = multer({ ... });
// --- End Removed Multer Setup ---

// --------------------------------------
// Parse JSON and URL-encoded bodies
// --------------------------------------
// Apply these *before* your routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------------------------
// USE YOUR MAIN API ROUTES
// --------------------------------------
// The 'routes' import already contains the router instance with middleware applied
app.use('/api', routes);
console.log('[SETUP] API routes mounted under /api');

// --------------------------------------
// ERROR HANDLING
// --------------------------------------
// Apply this *after* your routes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[ERROR] Unhandled error:", err.stack); // Log the full stack
  res.status(err.status || 500).json({
       error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
       ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }) // Optionally include stack in dev
   });
});

// --------------------------------------
// REMOVED: export { upload }; // Export was moved to middleware/multerConfig.ts
// --------------------------------------

// --------------------------------------
// START THE SERVER
// --------------------------------------
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // REMOVED logs related to the old uploadDirectory
});

// REMOVED: export { upload }; // Second instance of removed export