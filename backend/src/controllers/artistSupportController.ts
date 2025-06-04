// src/controllers/artistSupportController.ts
import { Response } from 'express';
import { CustomRequest } from '../middleware/authMiddleware'; // Assuming this type for req.user
import ArtistSupport from '../models/ArtistSupport';
import User from '../models/User';
import { Op } from 'sequelize';

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
        // Check if the user being supported is actually an artist
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

        let currentSupportCount: number;
        let hasSupported: boolean;

        if (existingSupport) {
            // User has already supported, so unsupport (delete the record)
            await existingSupport.destroy();
            hasSupported = false;
            currentSupportCount = await ArtistSupport.count({
                where: { supported_artist_user_id: profileUserId },
            });
            res.status(200).json({
                message: 'Successfully unsupported artist.',
                hasSupported: hasSupported,
                supportCount: currentSupportCount,
            } as SupportStatusResponse);
        } else {
            // User has not supported yet, so add support (create the record)
            await ArtistSupport.create({
                supporter_artist_user_id: loggedInUserId,
                supported_artist_user_id: profileUserId,
            });
            hasSupported = true;
            currentSupportCount = await ArtistSupport.count({
                where: { supported_artist_user_id: profileUserId },
            });
            res.status(201).json({
                message: 'Successfully supported artist.',
                hasSupported: hasSupported,
                supportCount: currentSupportCount,
            } as SupportStatusResponse);
        }
    } catch (error: any) {
        console.error('Error toggling artist support:', error);
        res.status(500).json({ message: 'Failed to toggle artist support.', error: error.message });
    }
};

/**
 * @description Gets the support count for an artist and checks if the logged-in user (if any) has supported them.
 * @route GET /api/users/:userId/support-status
 */
export const getSupportStatusAndCount = async (req: CustomRequest, res: Response): Promise<void> => {
    const loggedInUserId = req.user?.id; // Optional: user might not be logged in when viewing
    const loggedInUserType = req.user?.user_type;
    const profileUserId = parseInt(req.params.userId, 10);

    if (isNaN(profileUserId)) {
        res.status(400).json({ message: 'Invalid profile user ID.' });
        return;
    }

    try {
        const supportedUserProfile = await User.findByPk(profileUserId);
        if (!supportedUserProfile || supportedUserProfile.user_type !== 'Artist') {
            // Still return a count of 0 if profile not found or not an artist,
            // or decide to send 404 based on your preference.
            // For UX on profile page, might be better to show 0 supports.
            res.status(200).json({ hasSupported: false, supportCount: 0 } as SupportStatusResponse);
            return;
        }

        const supportCount = await ArtistSupport.count({
            where: { supported_artist_user_id: profileUserId },
        });

        let hasSupported = false;
        if (loggedInUserId && loggedInUserType === 'Artist') {
            const userSupport = await ArtistSupport.findOne({
                where: {
                    supporter_artist_user_id: loggedInUserId,
                    supported_artist_user_id: profileUserId,
                },
            });
            if (userSupport) {
                hasSupported = true;
            }
        }

        res.status(200).json({ hasSupported, supportCount } as SupportStatusResponse);
    } catch (error: any) {
        console.error('Error getting artist support status and count:', error);
        res.status(500).json({ message: 'Failed to get artist support status.', error: error.message });
    }
};