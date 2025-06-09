// src/controllers/artistCommentController.ts
import { Request, Response } from 'express';
import { CustomRequest } from '../middleware/authMiddleware';
import ArtistComment from '../models/ArtistComment';
import User from '../models/User';
import Artist from '../models/Artist';
import Employer from '../models/Employer';
import { UniqueConstraintError } from 'sequelize'; // Import for better error handling


export const createArtistComment = async (req: CustomRequest, res: Response): Promise<void> => {
    const loggedInUserId = req.user?.id;
    const loggedInUserType = req.user?.user_type;
    const profileUserId = parseInt(req.params.userId, 10);
    const { comment_text } = req.body;

    // --- Validations ---
    if (!loggedInUserId || loggedInUserType !== 'Artist') {
        res.status(403).json({ message: "Forbidden. Only artists can post artistic viewpoints." });
        return;
    }
    if (isNaN(profileUserId) || !comment_text || typeof comment_text !== 'string' || comment_text.trim() === "") {
        res.status(400).json({ message: "Invalid input." });
        return;
    }
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
        });

        // --- THIS IS THE FIX ---
        // After creating, immediately fetch the new comment again, this time with its associations.
        // This ensures the frontend gets the commenter's name and picture for an instant update.
        const createdCommentWithDetails = await ArtistComment.findByPk(newCommentInstance.comment_id, {
            include: [{
                model: User,
                as: 'commenterArtist', // This gets the User who commented
                attributes: ['user_id', 'fullname', 'user_type'],
                include: [ // This gets their profile picture from their specific profile
                    { model: Artist, as: 'artistProfile', attributes: ['profile_picture'], required: false },
                    { model: Employer, as: 'employerProfile', attributes: ['profile_picture'], required: false }
                ]
            }]
        });
        // --- END FIX ---

        // Now, send the complete, detailed comment object back to the frontend
        res.status(201).json({ message: "Viewpoint posted successfully!", comment: createdCommentWithDetails });

    } catch (error: any) {
        if (error instanceof UniqueConstraintError) {
            res.status(409).json({ message: "You have already posted a viewpoint on this profile." });
            return;
        }
        console.error("Error creating artist comment:", error);
        res.status(500).json({ message: "Failed to post viewpoint." });
    }
};
export const getCommentsForUserProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const profileUserId = parseInt(req.params.userId, 10);
        if (isNaN(profileUserId)) { res.status(400).json({ message: 'Invalid user ID format.' }); return; }

        const profileUser = await User.findByPk(profileUserId);
        if (!profileUser) { res.status(404).json({ message: 'Profile user not found.' }); return; }

        const commentsInstances = await ArtistComment.findAll({
            where: { profile_user_id: profileUserId },
            include: [{
                model: User,
                as: 'commenterArtist',
                attributes: ['user_id', 'fullname', 'user_type'],
                include: [
                    { model: Artist, as: 'artistProfile', attributes: ['profile_picture'], required: false },
                    { model: Employer, as: 'employerProfile', attributes: ['profile_picture'], required: false }
                ]
            }],
            order: [['created_at', 'DESC']],
        });

        const formattedComments = commentsInstances.map(commentInstance => {
            const commenterUserSequelizeInstance = commentInstance.commenterArtist;
            let formattedCommenterData: any = null;

            if (commenterUserSequelizeInstance) {
                let profilePic = null;
                if (commenterUserSequelizeInstance.user_type === 'Artist' && commenterUserSequelizeInstance.artistProfile) {
                    profilePic = commenterUserSequelizeInstance.artistProfile.profile_picture;
                } else if (commenterUserSequelizeInstance.user_type === 'Employer' && commenterUserSequelizeInstance.employerProfile) {
                    profilePic = commenterUserSequelizeInstance.employerProfile.profile_picture;
                }
                formattedCommenterData = {
                    user_id: commenterUserSequelizeInstance.user_id,
                    fullname: commenterUserSequelizeInstance.fullname,
                    user_type: commenterUserSequelizeInstance.user_type,
                    profile_picture: profilePic || null
                };
            }
            
            const plainCommentBase = commentInstance.get({ plain: true });

            return {
                comment_id: plainCommentBase.comment_id,
                profile_user_id: plainCommentBase.profile_user_id,
                commenter_user_id: plainCommentBase.commenter_user_id,
                comment_text: plainCommentBase.comment_text,
                created_at: commentInstance.createdAt ? commentInstance.createdAt.toISOString() : null,
                updated_at: commentInstance.updatedAt ? commentInstance.updatedAt.toISOString() : null,
                commenter: formattedCommenterData,
            };
        });

        res.status(200).json({ comments: formattedComments });

    } catch (error: any) {
        console.error('Error fetching comments for user profile:', error);
        res.status(500).json({ message: 'Failed to fetch viewpoints.', error: error.message });
    }
};

export const checkExistingComment = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
        const commenterId = req.user?.id; // Get ID from authenticated token
        const profileUserId = parseInt(req.params.userId, 10);

        if (!commenterId) {
            // If there's no logged-in user, they haven't commented.
            // Sending hasCommented: false is safe.
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

        // Send back true if a comment was found, false otherwise
        res.status(200).json({ hasCommented: !!comment });

    } catch (error: any) {
        console.error("Error checking existing artist comment:", error);
        res.status(500).json({ message: "Failed to check comment status." });
    }
};