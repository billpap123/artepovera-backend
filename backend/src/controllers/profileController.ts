// src/controllers/profileController.ts
import { Request, Response, NextFunction } from 'express';
import Artist from '../models/Artist';
import Employer from '../models/Employer';

export const createProfile = async (req: Request, res: Response, next: NextFunction) => {
    const { user_id, bio, profile_picture, portfolio } = req.body; // 'portfolio' is destructured but shouldn't be used directly in Artist.create

    try {
        // Assuming req.params.type is correctly set by your route
        if (req.params.type === 'artist') {
            const artist = await Artist.create({
                user_id,
                bio,
                profile_picture,
                // portfolio, // <<< REMOVE THIS LINE
                // is_student, cv_url, cv_public_id would be set here if applicable and sent in body
            });
            return res.status(201).json(artist);
        } else if (req.params.type === 'employer') {
            // Employer model also doesn't have a direct 'portfolio' field
            const employer = await Employer.create({
                user_id,
                bio,
                profile_picture,
            });
            return res.status(201).json(employer);
        } else {
            // It's good practice to handle the case where type is not 'artist' or 'employer'
            return res.status(400).json({ message: "Invalid profile type specified." });
        }
    } catch (error) {
        console.error('Error creating profile:', error);
        // Pass to a global error handler or send a generic response
        // Using next(error) assumes you have an error handling middleware set up
        // If not, send a response directly:
        res.status(500).json({ message: 'Error creating profile', error: (error as Error).message });
    }
};