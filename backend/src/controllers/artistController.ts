import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import Artist from '../models/Artist';
import { CustomRequest } from '../middleware/authMiddleware';
import User from '../models/User'; // Assuming location is stored here
import { Sequelize } from 'sequelize';

// Use an environment variable for the upload folder, defaulting to 'uploads/'
const uploadFolder = process.env.UPLOAD_FOLDER || 'uploads';

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
    cb(null, true); // No error, accept the file
  } else {
    cb(null, false); // Reject the file without throwing an error
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
export const uploadProfilePicture = upload.single('profile_picture');

export const updateArtistProfile = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    // Step 1: Retrieve user ID from the token
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized: Missing or invalid user ID' });
      return;
    }

    // Step 2: Extract fields from the request
    const { bio } = req.body;
    const profile_picture = req.file ? `${uploadFolder}/${req.file.filename}` : undefined;

    // Step 3: Find the artist profile associated with the user
    const artist = await Artist.findOne({ where: { user_id: userId } });
    if (!artist) {
      res.status(404).json({ message: 'Artist profile not found' });
      return;
    }

    // Step 4: Update the artist profile fields if provided
    if (bio) artist.bio = bio;
    if (profile_picture) artist.profile_picture = profile_picture;

    // Step 5: Save the updated artist profile
    await artist.save();

    // Step 6: Return a consistent and clean response
    res.status(200).json({
      message: 'Artist profile updated successfully',
      artist: {
        artist_id: artist.artist_id,
        bio: artist.bio,
        profile_picture: artist.profile_picture,
      },
    });
  } catch (error) {
    console.error('Error updating artist profile:', error.stack); // Log full error stack
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

export const getArtistById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("Fetching artist for ID:", req.params.id);
    const artist = await Artist.findOne({
      where: { artist_id: req.params.id },
      attributes: ['bio', 'profile_picture'],
    });
    if (artist) {
      res.json(artist);
    } else {
      console.log("Artist not found for ID:", req.params.id);
      res.status(404).json({ message: 'Artist not found' });
    }
  } catch (error) {
    console.error('Error fetching artist by ID:', error);
    next(error); // Pass the error to error-handling middleware
  }
};

// Delete artist
export const deleteArtist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const artist = await Artist.findByPk(id);
    if (!artist) {
      res.status(404).json({ message: 'Artist not found' });
      return;
    }
    await artist.destroy();
    res.status(204).send(); // No content response
  } catch (error) {
    console.error('Error deleting artist:', error);
    next(error); // Pass the error to error-handling middleware
  }
};

export const getArtistsWithLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const artists = await User.findAll({
      where: { user_type: 'Artist' },
      attributes: [
        'user_id',
        'fullname',
        [Sequelize.fn('ST_X', Sequelize.col('location')), 'longitude'], // Extract longitude
        [Sequelize.fn('ST_Y', Sequelize.col('location')), 'latitude'],  // Extract latitude
      ],
    });

    res.status(200).json(artists);
  } catch (error) {
    console.error('Error fetching artists with location:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
