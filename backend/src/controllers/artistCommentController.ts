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
    if (!loggedInUserId) { res.status(401).json({ message: "Unauthorized. Please log in to comment." }); return; }
    if (loggedInUserType !== 'Artist') { res.status(403).json({ message: "Forbidden. Only artists can post artistic viewpoints." }); return; }
    if (isNaN(profileUserId)) { res.status(400).json({ message: "Invalid profile user ID." }); return; }
    if (!comment_text || typeof comment_text !== 'string' || comment_text.trim() === "") { res.status(400).json({ message: "Comment text cannot be empty." }); return; }
    if (loggedInUserId === profileUserId) { res.status(400).json({ message: "Artists cannot comment on their own profile." }); return; }

    try {
        const profileUser = await User.findByPk(profileUserId);
        if (!profileUser || profileUser.user_type !== 'Artist') {
            res.status(404).json({ message: "Artist profile to comment on not found or user is not an artist." });
            return;
        }

        const existingComment = await ArtistComment.findOne({
            where: {
                commenter_user_id: loggedInUserId,
                profile_user_id: profileUserId
            }
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

        const createdCommentWithDetails = await ArtistComment.findByPk(newCommentInstance.comment_id, {
            include: [{
                model: User,
                as: 'commenterArtist',
                attributes: ['user_id', 'fullname', 'user_type'],
                include: [
                    { model: Artist, as: 'artistProfile', attributes: ['profile_picture'], required: false },
                    { model: Employer, as: 'employerProfile', attributes: ['profile_picture'], required: false }
                ]
            }]
        });

        if (!createdCommentWithDetails) {
            res.status(404).json({ message: "Failed to retrieve created comment details." });
            return;
        }
        
        // Your logic for formatting the commenter data...
        const commenterUserSequelizeInstance = createdCommentWithDetails.commenterArtist;
        let formattedCommenterData: any = null;
        if (commenterUserSequelizeInstance) {
            let profilePic = null;
            if (commenterUserSequelizeInstance.user_type === 'Artist' && commenterUserSequelizeInstance.artistProfile) {
                profilePic = commenterUserSequelizeInstance.artistProfile.profile_picture;
            } else if (commenterUserSequelizeInstance.user_type === 'Employer' && commenterUserSequelizeInstance.employerProfile) {
                profilePic = commenterUserSequelizeInstance.employerProfile.profile_picture;
            }
            formattedCommenterData = { /* ... your commenter object ... */ };
        }

        const plainCreatedCommentBase = createdCommentWithDetails.get({ plain: true });
        const responseComment = {
            comment_id: plainCreatedCommentBase.comment_id,
            profile_user_id: plainCreatedCommentBase.profile_user_id,
            commenter_user_id: plainCreatedCommentBase.commenter_user_id,
            comment_text: plainCreatedCommentBase.comment_text,
            created_at: createdCommentWithDetails.createdAt ? createdCommentWithDetails.createdAt.toISOString() : null,
            updated_at: createdCommentWithDetails.updatedAt ? createdCommentWithDetails.updatedAt.toISOString() : null,
            commenter: formattedCommenterData
        };

        res.status(201).json({ message: "Viewpoint posted successfully!", comment: responseComment });

    } catch (error: any) {
        console.error("Error creating artist comment:", error);
        // This catch block handles the DB unique constraint as a backup
        if (error instanceof UniqueConstraintError) {
            // --- THIS IS THE FIX ---
            res.status(409).json({ message: "You have already shared a viewpoint on this artist's profile." });
            return; // Exit function after sending response
            // --- END FIX ---
        }
        res.status(500).json({ message: "Failed to post viewpoint.", error: error.message });
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