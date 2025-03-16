import * as multer from 'multer';

declare global {
  namespace Express {
    interface Request {
      file?: multer.File;  // For single-file uploads
      files?: multer.File[]; // (Optional) For multi-file uploads
    }
  }
}
