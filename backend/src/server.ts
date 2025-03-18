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

// Ensure the uploads directory exists
const uploadDirectory = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

// Sync database models (only once)
sequelize.sync({ alter: true })
  .then(() => console.log('Database & tables synced successfully!'))
  .catch((error) => console.error('Error syncing database:', error.message));

// Helmet configuration for security headers
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Serve static files (profile pictures, etc.) from /uploads
app.use('/uploads', express.static(uploadDirectory));

// Read allowed origin from environment or fallback to localhost:3000
const corsOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use the same ../uploads directory
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

// Accept only PNG/JPEG images
const fileFilter = (req: any, file: any, cb: FileFilterCallback) => {
  if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

// Initialize multer
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Parse JSON and URL-encoded request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fix profile picture URL handling
app.use('/uploads', (req, res, next) => {
  if (req.url.startsWith('/uploads/uploads/')) {
    req.url = req.url.replace('/uploads/uploads/', '/uploads/');
  }
  next();
});

// Use your main API routes
app.use('/api', routes);

// Global error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Read PORT from environment or default to 5001
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
