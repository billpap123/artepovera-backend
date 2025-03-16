import { Request, Response, NextFunction } from 'express';
import Artist from '../models/Artist';
import Employer from '../models/Employer';

export const createProfile = async (req: Request, res: Response, next: NextFunction) => {
    const { user_id, bio, profile_picture, portfolio } = req.body;

    try {
        if (req.params.type === 'artist') {
            const artist = await Artist.create({
                user_id,
                bio,
                profile_picture,
                portfolio,
            });
            return res.status(201).json(artist);
        } else if (req.params.type === 'employer') {
            const employer = await Employer.create({
                user_id,
                bio,
                profile_picture,
            });
            return res.status(201).json(employer);
        }
    } catch (error) {
        console.error('Error creating profile:', error);
        res.status(500).json({ message: 'Error creating profile', error });
    }
};
