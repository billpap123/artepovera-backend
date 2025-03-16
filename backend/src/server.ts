import express from 'express';
import sequelize from './config/db';
import routes from './routes/index';
import dotenv from 'dotenv';
import cors from 'cors';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';

dotenv.config();

// Import models and associations
import './models/associations';

const app = express();

// Ensure the uploads directory exists
const uploadDirectory = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

sequelize.sync({ alter: true })
  .then(() => console.log('Database & tables synced successfully!'))
  .catch((error) => console.error('Error syncing database:', error.message));

// Helmet configuration
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Serve static files correctly
app.use('/uploads', express.static(uploadDirectory));

// CORS middleware
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads')); // Make sure it’s just '../uploads' and not 'uploads/uploads'
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

// File filter to accept only PNG and JPEG images
const fileFilter = (req: any, file: any, cb: FileFilterCallback) => {
  if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

// Initialize multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Middleware to parse JSON and URL-encoded request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fix profile picture URL handling
app.use('/uploads', (req, res, next) => {
  if (req.url.startsWith('/uploads/uploads/')) {
    req.url = req.url.replace('/uploads/uploads/', '/uploads/');
  }
  next();
});

// Use the routes for API calls
app.use('/api', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Sync all database models and start the server
sequelize.sync({ alter: true })
  .then(() => {
    console.log('Database & tables synced successfully!');
  })
  .catch((error) => {
    console.error('Error syncing database:', error.message);
  });

const PORT = process.env.PORT || 50001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
