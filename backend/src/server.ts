// src/server.ts
import express from 'express';
import sequelize from './config/db';
import routes from './routes/index'; // Imports the configured router
import dotenv from 'dotenv';
import cors from 'cors';
// REMOVED: import multer, { FileFilterCallback } from 'multer'; // Multer is now configured in middleware/multerConfig.ts
import path from 'path'; // Keep path if it might be used by a dependency or other part of your app
import helmet from 'helmet';
import { v2 as cloudinary } from 'cloudinary'; // Import Cloudinary SDK

// Load environment variables from .env
dotenv.config();

// Import models and associations (Sequelize relationships)
// This line ensures all models are registered and associations are set up.
import './models/associations'; // Ensure this path is correct and it imports all models and then sets up associations

// --- Cloudinary Configuration ---
// Ensure Cloudinary is configured early
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // Use https URLs
});
console.log('[Cloudinary] SDK Configured. Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME ? 'OK' : 'MISSING!');
// --- End Cloudinary Configuration ---

const app = express();

// --------------------------------------
// REMOVED: Disk path calculation, fs.mkdirSync logic, and related debug logs
// --------------------------------------

// --------------------------------------
// MODIFIED: Database Connection Check (removed sync)
// --------------------------------------
sequelize
  .authenticate()
  .then(() => console.log('Database connection established successfully.'))
  .catch((error) => console.error('Unable to connect to the database:', error.message));
// REMOVED: sequelize.sync({ alter: true }) block

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
  'http://localhost:3000',
  'https://artepovera2.vercel.app',
  // Add any other specific Vercel preview URLs if needed
  // Or for more flexible preview URL handling:
  // /https:\/\/artepovera2-.*-vasilis-projects-01b75e68\.vercel\.app/ // Regex example
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl) OR from allowed origins
      // For regex, you'd need a different check:
      // if (!origin || allowedOrigins.some(pattern => typeof pattern === 'string' ? pattern === origin : pattern.test(origin))) {
      if (!origin || allowedOrigins.includes(origin)) { // Simple check for now
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
// REMOVED: MULTER SETUP (This now lives in src/middleware/multerConfig.ts)
// --------------------------------------

// --------------------------------------
// Parse JSON and URL-encoded bodies
// --------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------------------------
// USE YOUR MAIN API ROUTES
// --------------------------------------
app.use('/api', routes);
console.log('[SETUP] API routes mounted under /api');

// --------------------------------------
// ERROR HANDLING
// --------------------------------------
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[ERROR] Unhandled error:", err.stack);
  res.status(err.status || 500).json({
       error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
       ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
   });
});

// --------------------------------------
// REMOVED: export { upload }; // This was moved to src/middleware/multerConfig.ts
// --------------------------------------

// --------------------------------------
// START THE SERVER
// --------------------------------------
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// REMOVED: Redundant export { upload };