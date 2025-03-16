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

export const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// **Portfolio Upload: Save Correct Image Path**
export const createPortfolioItem = async (req: Request, res: Response): Promise<void> => {
    try {
        const { description, artist_id } = req.body;
        const file = req.file;

        if (!file || !artist_id) {
            res.status(400).json({ message: 'Image and artist_id are required' });
            return;
        }

        // Save relative path for database storage
        const imagePath = `uploads/${file.filename}`;

        const portfolioItem = await Portfolio.create({
            artist_id,
            image_url: imagePath,
            description,
        });

        res.status(201).json(portfolioItem);
    } catch (error) {
        console.error('Error creating portfolio item:', error);
        res.status(500).json({ message: 'Failed to create portfolio item' });
    }
};

// **Portfolio Retrieval: Ensure Correct URL for Images**
export const getArtistPortfolio = async (req: Request, res: Response) => {
    try {
        const { artistId } = req.params;

        const artist = await Artist.findOne({ where: { user_id: artistId } });
        if (!artist) {
            res.status(404).json({ message: 'Artist not found' });
            return;
        }

        const portfolioItems = await Portfolio.findAll({
            where: { artist_id: artist.artist_id },
            include: [{ model: Artist, as: 'artist', attributes: ['bio'] }]
        });

        // Base URL from environment or fallback
        const baseURL = process.env.BASE_URL || 'http://localhost:50001';

        // Convert image paths to full URLs
        const updatedPortfolioItems = portfolioItems.map((item) => ({
            ...item.toJSON(),
            image_url: `${baseURL}/${item.image_url}`
        }));

        res.status(200).json(updatedPortfolioItems);
    } catch (error) {
        console.error('Error retrieving portfolio items:', error);
        res.status(500).json({ message: 'Failed to retrieve portfolio items' });
    }
};

// **Update Portfolio Item**
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
        portfolioItem.description = description || portfolioItem.description;

        await portfolioItem.save();

        res.status(200).json(portfolioItem);
    } catch (error) {
        console.error('Error updating portfolio item:', error);
        res.status(500).json({ message: 'Failed to update portfolio item' });
    }
};

// **Delete Portfolio Item**
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
