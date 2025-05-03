// src/middleware/multerConfig.ts

import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express'; // Import Request type if needed

// Use memory storage for Cloudinary
const storage = multer.memoryStorage();

// Keep your file filter logic
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
    cb(null, true);
  } else {
    console.log(`[MULTER] File rejected by filter: ${file.originalname} (${file.mimetype})`);
    cb(null, false); // Reject file
    // Optionally pass an error:
    // cb(new Error('Invalid file type. Only PNG/JPEG allowed.') as any, false);
  }
};

// Create and configure the Multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
});

// Export the configured instance
export { upload };