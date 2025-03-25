// src/controllers/portfolioController.ts
import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Portfolio from '../models/Portfolio';
import Artist from '../models/Artist';

// Where to store uploaded images
const defaultUploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
if (!fs.existsSync(defaultUploadsDir)) {
  fs.mkdirSync(defaultUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, defaultUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, uniqueSuffix);
  },
});

// If you want an error thrown for non-PNG/JPEG, you can cast it.
// Otherwise you can do: cb(null, false) to “silently” reject.
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
    cb(null, true);
  } else {
    // Force-cast the Error so TS stops complaining:
    cb(new Error('Only PNG/JPEG allowed') as unknown as null, false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

/**
 * POST /api/portfolios
 * Body: { image (file), description, artist_id }
 */
export const createPortfolioItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { description, artist_id } = req.body;
    const file = req.file;

    if (!file || !artist_id) {
      res.status(400).json({ message: 'Image and artist_id are required' });
      return; // just return
    }

    // Confirm the artist actually exists
    const artist = await Artist.findByPk(artist_id);
    if (!artist) {
      res.status(404).json({ message: 'No artist found with that artist_id' });
      return;
    }

    // Save relative path
    const imagePath = `uploads/${file.filename}`;

    const newPortfolioItem = await Portfolio.create({
      artist_id: artist.artist_id,
      image_url: imagePath,
      description,
    });

    res.status(201).json(newPortfolioItem);
    return;
  } catch (error) {
    console.error('Error creating portfolio item:', error);
    res.status(500).json({ message: 'Failed to create portfolio item' });
    return;
  }
};

/**
 * GET /api/portfolios/:artistId
 * Returns all portfolio items for that artist
 */
export const getArtistPortfolio = async (req: Request, res: Response): Promise<void> => {
  try {
    const { artistId } = req.params;

    // 1) Check if that artist PK exists
    const artist = await Artist.findOne({ where: { artist_id: artistId } });
    if (!artist) {
      res.status(404).json({ message: 'Artist not found' });
      return;
    }

    // 2) Find all portfolio items
    const portfolioItems = await Portfolio.findAll({
      where: { artist_id: artist.artist_id },
      include: [{ model: Artist, as: 'artist', attributes: ['bio'] }],
    });

    // Convert relative image paths to absolute
    const baseURL = process.env.BASE_URL || 'http://localhost:50001';
    const updatedItems = portfolioItems.map((item) => {
      const json = item.toJSON() as any;
      return {
        ...json,
        image_url: `${baseURL}/${json.image_url}`,
      };
    });

    res.status(200).json(updatedItems);
    return;
  } catch (error) {
    console.error('Error retrieving portfolio items:', error);
    res.status(500).json({ message: 'Failed to retrieve portfolio items' });
    return;
  }
};

/**
 * PUT /api/portfolios/:id
 * Body: { description? } + optional file "image"
 */
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

    if (file) {
      portfolioItem.image_url = `uploads/${file.filename}`;
    }
    if (description) {
      portfolioItem.description = description;
    }

    await portfolioItem.save();
    res.status(200).json(portfolioItem);
    return;
  } catch (error) {
    console.error('Error updating portfolio item:', error);
    res.status(500).json({ message: 'Failed to update portfolio item' });
    return;
  }
};

/**
 * DELETE /api/portfolios/:id
 */
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
    return;
  }
};
