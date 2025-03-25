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

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
      cb(null, true);
    } else {
      // Force-cast the Error so TS stops complaining
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
export const createPortfolioItem = async (req: Request, res: Response) => {
  try {
    const { description, artist_id } = req.body;
    const file = req.file;

    if (!file || !artist_id) {
      return void res.status(400).json({ message: 'Image and artist_id are required' });
    }

    // Confirm the artist actually exists
    const artist = await Artist.findByPk(artist_id);
    if (!artist) {
      return void res.status(404).json({ message: 'No artist found with that artist_id' });
    }

    // Save relative path
    const imagePath = `uploads/${file.filename}`;

    const newPortfolioItem = await Portfolio.create({
      artist_id: artist.artist_id,
      image_url: imagePath,
      description,
    });

    return void res.status(201).json(newPortfolioItem);
  } catch (error: any) {
    console.error('Error creating portfolio item:', error);
    return void res.status(500).json({ message: 'Failed to create portfolio item' });
  }
};

/**
 * GET /api/portfolios/:artistId
 * Returns all portfolio items for that artist
 */
export const getArtistPortfolio = async (req: Request, res: Response) => {
  try {
    // e.g. GET /api/portfolios/:artistId
    const { artistId } = req.params;
    // 1) Make sure artistId is the PK in the artists table
    const artist = await Artist.findOne({ where: { artist_id: artistId } });
    if (!artist) return res.status(404).json({ message: 'Artist not found' });
    
    const portfolioItems = await Portfolio.findAll({
      where: { artist_id: artist.artist_id },
      include: [{ model: Artist, as: 'artist', attributes: ['bio'] }],
    });
    
    // ...format and return the items...
    

    // Convert image paths to full URLs
    const baseURL = process.env.BASE_URL || 'http://localhost:50001';
    const updatedItems = portfolioItems.map((item) => {
      const json = item.toJSON() as any;
      return {
        ...json,
        image_url: `${baseURL}/${json.image_url}`,
      };
    });

    return void res.status(200).json(updatedItems);
  } catch (error: any) {
    console.error('Error retrieving portfolio items:', error);
    return void res.status(500).json({ message: 'Failed to retrieve portfolio items' });
  }
};

/**
 * PUT /api/portfolios/:id
 * Body: { description? } + optional file "image"
 */
export const updatePortfolioItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { description } = req.body;
    const file = req.file;

    const portfolioItem = await Portfolio.findByPk(id);
    if (!portfolioItem) {
      return void res.status(404).json({ message: 'Portfolio item not found' });
    }

    if (file) {
      portfolioItem.image_url = `uploads/${file.filename}`;
    }
    if (description) {
      portfolioItem.description = description;
    }

    await portfolioItem.save();
    return void res.status(200).json(portfolioItem);
  } catch (error: any) {
    console.error('Error updating portfolio item:', error);
    return void res.status(500).json({ message: 'Failed to update portfolio item' });
  }
};

/**
 * DELETE /api/portfolios/:id
 */
export const deletePortfolioItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const portfolioItem = await Portfolio.findByPk(id);
    if (!portfolioItem) {
      return void res.status(404).json({ message: 'Portfolio item not found' });
    }

    await portfolioItem.destroy();
    return void res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting portfolio item:', error);
    return void res.status(500).json({ message: 'Failed to delete portfolio item' });
  }
};
