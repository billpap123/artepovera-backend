// employerController.ts
import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import Employer from '../models/Employer';
import { CustomRequest } from '../middleware/authMiddleware';
import User from '../models/User'; // Assuming location is stored here

// Use an environment variable for the upload folder, defaulting to 'uploads/'
const uploadFolder = process.env.UPLOAD_FOLDER || 'uploads/';

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadFolder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, uniqueSuffix);
  },
});

// File filter to only allow PNG and JPEG images
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
    cb(null, true);
  } else {
    cb(null, false); // Reject other file types
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
export const uploadProfilePicture = upload.single('profile_picture');

// Handle profile updates
export const updateEmployerProfile = async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { bio } = req.body;
    // Store a relative path using the configured upload folder
    const profile_picture = req.file ? `${uploadFolder}/${req.file.filename}` : undefined;
    const userId = req.user?.id;

    if (!userId) {
      res.status(400).json({ error: 'User ID missing in request' });
      return;
    }

    let employer = await Employer.findOne({ where: { user_id: userId } });

    if (!employer) {
      employer = await Employer.create({
        user_id: userId,
        bio,
        profile_picture,
      });
    } else {
      employer.bio = bio || employer.bio;
      employer.profile_picture = profile_picture || employer.profile_picture;
      await employer.save();
    }

    res.status(200).json(employer);
  } catch (error) {
    console.error('Error updating employer profile:', error);
    res.status(500).json({ message: 'Failed to update employer profile' });
  }
};

// Get employer by ID
export const getEmployerById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employer = await Employer.findByPk(req.params.id);
    if (employer) {
      res.json(employer);
    } else {
      res.status(404).json({ message: 'Employer not found' });
    }
  } catch (error) {
    console.error('Error fetching employer:', error);
    next(error);
  }
};

// Delete employer
export const deleteEmployer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const employer = await Employer.findByPk(id);
    if (!employer) {
      res.status(404).json({ message: 'Employer not found' });
      return;
    }
    await employer.destroy();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting employer:', error);
    next(error);
  }
};

// Get all employers with their location
export const getEmployersWithLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employers = await User.findAll({
      where: { user_type: 'Employer' },
      attributes: ['user_id', 'fullname', 'latitude', 'longitude'] // Ensure these fields exist
    });

    res.json(employers);
  } catch (error) {
    console.error('Error fetching employers with location:', error);
    next(error);
  }
};
