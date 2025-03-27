import { Request, Response } from 'express';
import Portfolio from '../models/Portfolio';
import Artist from '../models/Artist';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

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
export const createPortfolioItem = async (req: Request, res: Response): Promise<void> => {
    try {
      const { description, artist_id } = req.body;
      const file = req.file;
  
      if (!file || !artist_id) {
        res.status(400).json({ message: 'Image and artist_id are required' });
        return;
      }
  
      // Check if the artist exists
      let artist = await Artist.findOne({ where: { artist_id } });
      if (!artist) {
        // Optionally auto-create an artist record if not found
        // You might want to include default values for bio, profile_picture, etc.
        artist = await Artist.create({
          user_id: artist_id,  // or however you want to associate it
          bio: '',
          profile_picture: '',
          portfolio: '',
          is_student: false,
        });
      }
  
      // Save relative path for database storage
      const imagePath = `uploads/${file.filename}`;
      // Create the portfolio item
      const portfolioItem = await Portfolio.create({
        artist_id,
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
    } catch (error) {
        console.error('Error deleting portfolio item:', error);
        res.status(500).json({ message: 'Failed to delete portfolio item' });
    }
};
