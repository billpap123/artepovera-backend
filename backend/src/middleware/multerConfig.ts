// src/middleware/multerConfig.ts

import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';

// Use memory storage for Cloudinary
const storage = multer.memoryStorage();

// Updated file filter logic
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  // Define a list of allowed MIME types
  const allowedMimeTypes = [
    'image/png',
    'image/jpeg',
    'image/gif',        // Optional: if you want to allow GIFs
    'application/pdf',  // <<< ADDED for PDFs
    'video/mp4',        // <<< ADDED for MP4 videos
    'video/quicktime',  // <<< ADDED for MOV videos (common for Apple devices)
    'video/webm',       // <<< ADDED for WebM videos
    // You can add more video types if needed, e.g.:
    // 'video/x-msvideo', // AVI
    // 'video/x-matroska', // MKV
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true); // Accept file
  } else {
    console.log(`[MULTER] File rejected: ${file.originalname} (Type: ${file.mimetype}). Allowed types: ${allowedMimeTypes.join(', ')}`);
    // Optionally, you can pass an error to the callback to provide feedback to the user
    // For example: cb(new Error('Invalid file type. Only images, PDFs, and common video formats are allowed.') as any, false);
    cb(null, false); // Reject file (frontend should handle the error message)
  }
};

// Create and configure the Multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // Increased limit to 25MB (adjust as needed for videos)
});

// Export the configured instance
export { upload };