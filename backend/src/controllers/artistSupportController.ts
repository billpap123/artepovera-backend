// src/controllers/artistSupportController.ts
import { Response } from 'express';
import { CustomRequest } from '../middleware/authMiddleware';
import ArtistSupport from '../models/ArtistSupport'; // The model for handling "supports"
import User from '../models/User';
import { UniqueConstraintError } from 'sequelize';

interface SupportStatusResponse {
    hasSupported: boolean;
    supportCount: number;
    message?: string;
}

/**
 * @description Allows a logged-in artist to support or unsupport another artist.
 * @route POST /api/users/:userId/support
 */
export const toggleSupport = async (req: CustomRequest, res: Response): Promise<void> => {
    const loggedInUserId = req.user?.id;
    const loggedInUserType = req.user?.user_type;
    const profileUserId = parseInt(req.params.userId, 10);

    // --- Validations ---
    if (!loggedInUserId) {
        res.status(401).json({ message: 'Unauthorized. Please log in.' });
        return;
    }
    if (loggedInUserType !== 'Artist') {
        res.status(403).json({ message: 'Forbidden. Only artists can support other artists.' });
        return;
    }
    if (isNaN(profileUserId)) {
        res.status(400).json({ message: 'Invalid profile user ID.' });
        return;
    }
    if (loggedInUserId === profileUserId) {
        res.status(400).json({ message: 'Artists cannot support themselves.' });
        return;
    }

    try {
        const supportedUserProfile = await User.findByPk(profileUserId);
        if (!supportedUserProfile || supportedUserProfile.user_type !== 'Artist') {
            res.status(404).json({ message: 'Artist profile to support not found or user is not an artist.' });
            return;
        }

        const existingSupport = await ArtistSupport.findOne({
            where: {
                supporter_artist_user_id: loggedInUserId,
                supported_artist_user_id: profileUserId,
            },
        });

        if (existingSupport) {
            // User has already supported, so unsupport (delete the record)
            await existingSupport.destroy();
            const currentSupportCount = await ArtistSupport.count({
                where: { supported_artist_user_id: profileUserId },
            });
            res.status(200).json({
                message: 'Successfully unsupported artist.',
                hasSupported: false,
                supportCount: currentSupportCount,
            } as SupportStatusResponse);
        } else {
            // User has not supported yet, so add support (create the record)
            await ArtistSupport.create({
                supporter_artist_user_id: loggedInUserId,
                supported_artist_user_id: profileUserId,
            });
            const currentSupportCount = await ArtistSupport.count({
                where: { supported_artist_user_id: profileUserId },
            });
            res.status(201).json({
                message: 'Successfully supported artist.',
                hasSupported: true,
                supportCount: currentSupportCount,
            } as SupportStatusResponse);
        }
    } catch (error: any) {
        console.error('Error toggling artist support:', error);
        if (error instanceof UniqueConstraintError) {
            // This is a backup if the findOne check somehow fails
            res.status(409).json({ message: "Support relationship already exists or was modified." });
            return;
        }
        res.status(500).json({ message: 'Failed to toggle artist support.', error: error.message });
    }
};

/**
 * @description Gets the support count for an artist and checks if the logged-in user has supported them.
 * @route GET /api/users/:userId/support-status
 */
export const getSupportStatusAndCount = async (req: CustomRequest, res: Response): Promise<void> => {
    const loggedInUserId = req.user?.id; // This is optional; a user might not be logged in.
    const profileUserId = parseInt(req.params.userId, 10);

    if (isNaN(profileUserId)) {
        res.status(400).json({ message: 'Invalid profile user ID.' });
        return;
    }

    try {
        // We can still get the count even if the user profile doesn't exist or isn't an artist
        const supportCount = await ArtistSupport.count({
            where: { supported_artist_user_id: profileUserId },
        });

        let hasSupported = false;
        // We only check if the current user has supported if they are logged in
        if (loggedInUserId) {
            const userSupport = await ArtistSupport.findOne({
                where: {
                    supporter_artist_user_id: loggedInUserId,
                    supported_artist_user_id: profileUserId,
                },
            });
            hasSupported = !!userSupport; // Convert to boolean: true if found, false if not
        }

        res.status(200).json({ hasSupported, supportCount });
    } catch (error: any) {
        console.error('Error getting artist support status and count:', error);
        res.status(500).json({ message: 'Failed to get artist support status.', error: error.message });
    }
};