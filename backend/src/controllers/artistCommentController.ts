// src/controllers/artistCommentController.ts
import { Request, Response } from 'express';
import { CustomRequest } from '../middleware/authMiddleware';
import ArtistComment from '../models/ArtistComment';
import User from '../models/User';
import Artist from '../models/Artist';
import { UniqueConstraintError, Sequelize } from 'sequelize';
import  Employer from '../models/Employer';

/**
 * --- UPDATED ---
 * Creates a new artistic viewpoint, now including a mandatory support_rating.
 */
export const createArtistComment = async (req: CustomRequest, res: Response): Promise<void> => {
    const loggedInUserId = req.user?.id;
    const loggedInUserType = req.user?.user_type;
    
    // --- THIS IS THE FIX ---
    // This line was missing. We need to define profileUserId to use it in the validation checks below.
    const profileUserId = parseInt(req.params.userId, 10);
    
    const { comment_text, support_rating } = req.body;

    // --- Validations ---
    if (!loggedInUserId || loggedInUserType !== 'Artist') {
        res.status(403).json({ message: "Forbidden. Only artists can post artistic viewpoints." });
        return;
    }
    if (!comment_text || !support_rating || typeof support_rating !== 'number' || support_rating < 1 || support_rating > 5) {
        res.status(400).json({ message: "A valid comment and a support rating (1-5) are required." });
        return;
    }
    // This check now works correctly because profileUserId is defined
    if (loggedInUserId === profileUserId) {
        res.status(400).json({ message: "Artists cannot comment on their own profile." });
        return;
    }

    try {
        const profileUser = await User.findByPk(profileUserId);
        if (!profileUser || profileUser.user_type !== 'Artist') {
            res.status(404).json({ message: "Artist profile to comment on not found." });
            return;
        }

        const existingComment = await ArtistComment.findOne({
            where: { commenter_user_id: loggedInUserId, profile_user_id: profileUserId }
        });
        if (existingComment) {
            res.status(409).json({ message: "You have already shared a viewpoint on this artist's profile." });
            return;
        }

        const newCommentInstance = await ArtistComment.create({
            profile_user_id: profileUserId,
            commenter_user_id: loggedInUserId,
            comment_text: comment_text.trim(),
            support_rating: support_rating,
        });

        const createdCommentWithDetails = await ArtistComment.findByPk(newCommentInstance.comment_id, {
            include: [{
                model: User,
                as: 'commenterArtist',
                attributes: ['user_id', 'fullname', 'user_type', 'profile_picture'],
            }]
        });

        res.status(201).json({ message: "Viewpoint posted successfully!", comment: createdCommentWithDetails });

    } catch (error: any) {
        console.error("Error creating artist comment:", error);
        res.status(500).json({ message: "Failed to post viewpoint." });
    }
};

/**
 * --- UPDATED ---
 * Fetches all comments for a user, now including the support_rating for each.
 */
export const getCommentsForUserProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const profileUserId = parseInt(req.params.userId, 10);
        if (isNaN(profileUserId)) { 
            res.status(400).json({ message: 'Invalid user ID format.' }); 
            return; 
        }

        const commentsInstances = await ArtistComment.findAll({
            where: { profile_user_id: profileUserId },
            // --- THIS IS THE FIX ---
            // This 'include' block now matches the one in your 'create' function.
            // It fetches the commenter's User model, AND their nested Artist/Employer profile
            // to get the profile picture correctly.
            include: [{
                model: User,
                as: 'commenterArtist',
                attributes: ['user_id', 'fullname', 'user_type'],
                include: [
                    { model: Artist, as: 'artistProfile', attributes: ['profile_picture'], required: false },
                    // Including Employer profile as well for completeness, though less likely for this feature
                    { model: Employer, as: 'employerProfile', attributes: ['profile_picture'], required: false }
                ]
            }],
            order: [['created_at', 'DESC']],
        });

        // This detailed mapping logic is now necessary to handle the nested data correctly.
        const formattedComments = commentsInstances.map(commentInstance => {
            const commenterUser = commentInstance.commenterArtist;
            let formattedCommenter = null;

            if (commenterUser) {
                const profilePic = (commenterUser.user_type === 'Artist' && commenterUser.artistProfile)
                    ? commenterUser.artistProfile.profile_picture
                    : null; // Or handle employer case if needed

                formattedCommenter = {
                    user_id: commenterUser.user_id,
                    fullname: commenterUser.fullname,
                    user_type: commenterUser.user_type,
                    profile_picture: profilePic,
                };
            }
            
            return {
                comment_id: commentInstance.comment_id,
                profile_user_id: commentInstance.profile_user_id,
                commenter_user_id: commentInstance.commenter_user_id,
                comment_text: commentInstance.comment_text,
                support_rating: commentInstance.support_rating,
                created_at: commentInstance.createdAt,
                updated_at: commentInstance.updatedAt,
                commenter: formattedCommenter, // Use the newly formatted object
            };
        });

        res.status(200).json({ comments: formattedComments });

    } catch (error: any) {
        console.error('Error fetching comments for user profile:', error);
        res.status(500).json({ message: 'Failed to fetch viewpoints.', error: error.message });
    }
};

/**
 * --- NEW FUNCTION ---
 * Calculates the average support rating and total count for a given artist profile.
 */
export const getAverageSupportRating = async (req: Request, res: Response): Promise<void> => {
    try {
        const profileUserId = parseInt(req.params.userId, 10);
        if (isNaN(profileUserId)) {
            res.status(400).json({ message: 'Invalid user ID.' });
            return;
        }

        const result: any = await ArtistComment.findOne({
            where: { profile_user_id: profileUserId },
            attributes: [
                [Sequelize.fn('AVG', Sequelize.col('support_rating')), 'averageRating'],
                [Sequelize.fn('COUNT', Sequelize.col('comment_id')), 'viewpointCount']
            ],
            raw: true,
        });

        const averageRating = result && result.averageRating ? parseFloat(parseFloat(result.averageRating).toFixed(1)) : null;
        const viewpointCount = result && result.viewpointCount ? parseInt(result.viewpointCount, 10) : 0;
        
        res.status(200).json({ averageRating, viewpointCount });

    } catch (error: any) {
        console.error('Error fetching average support rating:', error);
        res.status(500).json({ message: 'Failed to fetch average support rating.' });
    }
};

/**
 * --- UNCHANGED ---
 * Checks if the logged-in user has already commented on a specific profile.
 */
export const checkExistingComment = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
        const commenterId = req.user?.id;
        const profileUserId = parseInt(req.params.userId, 10);

        if (!commenterId) {
            res.status(200).json({ hasCommented: false });
            return;
        }
        if (isNaN(profileUserId)) {
            res.status(400).json({ message: "Invalid profile user ID." });
            return;
        }

        const comment = await ArtistComment.findOne({
            where: { 
                commenter_user_id: commenterId,
                profile_user_id: profileUserId 
            }
        });

        res.status(200).json({ hasCommented: !!comment });

    } catch (error: any) {
        console.error("Error checking existing artist comment:", error);
        res.status(500).json({ message: "Failed to check comment status." });
    }
};