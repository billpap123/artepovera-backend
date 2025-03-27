import { Request, Response } from 'express';
import Portfolio from '../models/Portfolio';
import Artist from '../models/Artist';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { CustomRequest } from '../middleware/authMiddleware';

// Use environment variable for the upload directory, or default to '../../uploads'
const defaultUploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

// Ensure the uploads directory exists
if (!fs.existsSync(defaultUploadsDir)) {
  fs.mkdirSync(defaultUploadsDir, { recursive: true });
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, defaultUploadsDir); // Absolute path
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, uniqueSuffix);
  },
});

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
    cb(null, true); // Accept the file
  } else {
    cb(new Error('Only PNG and JPEG files are allowed') as any, false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ─────────────────────────────────────────────────────────────
// CREATE A NEW PORTFOLIO ITEM
// ─────────────────────────────────────────────────────────────
export const createPortfolioItem = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const { description } = req.body;
    const file = req.file;

    if (!file) {
      res.status(400).json({ message: 'Image is required' });
      return;
    }

    // Instead of taking artist_id from the body, we use the authenticated user's id.
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized: User not found in token' });
      return;
    }

    // Find the artist record by the user's id (assuming Artist has a user_id field)
    const artist = await Artist.findOne({ where: { user_id: userId } });
    if (!artist) {
      res.status(404).json({ message: 'Artist profile not found. Please create your artist profile first.' });
      return;
    }

    // Save relative path for database storage
    const imagePath = `uploads/${file.filename}`;

    // Create the portfolio item using the actual artist_id from the Artist record
    const portfolioItem = await Portfolio.create({
      artist_id: artist.artist_id,
      image_url: imagePath,
      description,
    });

    res.status(201).json(portfolioItem);
    return;
  } catch (error: any) {
    console.error('Error creating portfolio item:', error);
    res.status(500).json({ message: 'Failed to create portfolio item', error: error.message });
    return;
  }
};

// ─────────────────────────────────────────────────────────────
// GET ALL PORTFOLIO ITEMS FOR A GIVEN ARTIST
// ─────────────────────────────────────────────────────────────
export const getArtistPortfolio = async (req: Request, res: Response): Promise<void> => {
  try {
    // Retrieve artistId from route parameters
    const { artistId } = req.params;

    // Query the Portfolio table for items that match this artistId
    const portfolioItems = await Portfolio.findAll({
      where: { artist_id: artistId },
      include: [{ model: Artist, as: 'artist', attributes: ['bio'] }],
    });

    // If no portfolio items exist, return an empty array
    if (!portfolioItems || portfolioItems.length === 0) {
      res.status(200).json([]);
      return;
    }

    // Construct full URL for each image
    const baseURL = process.env.BASE_URL || 'http://localhost:50001';
    const updatedPortfolioItems = portfolioItems.map((item) => {
      const itemData = item.toJSON();
      // Remove any leading slashes from the stored image URL to avoid double slashes
      const cleanImageUrl = (itemData.image_url as string).replace(/^\/+/, '');
      return {
        ...itemData,
        image_url: `${baseURL}/${cleanImageUrl}`,
      };
    });

    res.status(200).json(updatedPortfolioItems);
    return;
  } catch (error: any) {
    console.error('Error retrieving portfolio items:', error);
    res.status(500).json({ message: 'Failed to retrieve portfolio items', error: error.message });
    return;
  }
};

// ─────────────────────────────────────────────────────────────
// UPDATE A PORTFOLIO ITEM
// ─────────────────────────────────────────────────────────────
export const updatePortfolioItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { description } = req.body;
    const file = req.file;

    const portfolioItem = await Portfolio.findByPk(id);
    if (!portfolioItem) {
      res.status(404).json({ message: 'Portfolio item not found' });
      return;
    }

    // If a new file was uploaded, update the image path
    if (file) {
      portfolioItem.image_url = `uploads/${file.filename}`;
    }

    // Update description if provided
    if (description) {
      portfolioItem.description = description;
    }

    await portfolioItem.save();
    res.status(200).json(portfolioItem);
    return;
  } catch (error) {
    console.error('Error updating portfolio item:', error);
    res.status(500).json({ message: 'Failed to update portfolio item' });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE A PORTFOLIO ITEM
// ─────────────────────────────────────────────────────────────
export const deletePortfolioItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const portfolioItem = await Portfolio.findByPk(id);

    if (!portfolioItem) {
      res.status(404).json({ message: 'Portfolio item not found' });
      return;
    }

    await portfolioItem.destroy();
    res.status(204).send();
    return;
  } catch (error) {
    console.error('Error deleting portfolio item:', error);
    res.status(500).json({ message: 'Failed to delete portfolio item' });
  }
};
