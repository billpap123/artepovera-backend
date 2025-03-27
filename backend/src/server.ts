import express from 'express';
import sequelize from './config/db';
import routes from './routes/index';
import dotenv from 'dotenv';
import cors from 'cors';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';

// Load environment variables from .env
dotenv.config();

// Import models and associations (Sequelize relationships)
import './models/associations';

const app = express();

// --------------------------------------
// Ensure the uploads directory exists
// --------------------------------------
const rawUploadFolder = process.env.UPLOAD_FOLDER || 'uploads';
const uploadFolder = rawUploadFolder.replace(/\/+$/, ''); // Remove any trailing slashes
const uploadDirectory = path.join(__dirname, '..', uploadFolder);
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

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
    req.url = req.url.replace('/uploads/uploads/', '/uploads/');
  }
  next();
});

// --------------------------------------
// Serve static files from /uploads
// --------------------------------------
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
    cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const fileFilter = (req: any, file: any, cb: FileFilterCallback) => {
  if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
    cb(null, true);
  } else {
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
app.use('/api', routes);

// --------------------------------------
// ERROR HANDLING
// --------------------------------------
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// --------------------------------------
// START THE SERVER
// --------------------------------------
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
