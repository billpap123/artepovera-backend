// src/controllers/artistCommentController.ts
import { Request, Response } from 'express';
import { CustomRequest } from '../middleware/authMiddleware';
import ArtistComment from '../models/ArtistComment';
import User from '../models/User'; // User model
import Artist from '../models/Artist'; // Artist model
import Employer from '../models/Employer'; // Employer model

export const createArtistComment = async (req: CustomRequest, res: Response): Promise<void> => {
    // ... (initial validations and checks remain the same)
    const loggedInUserId = req.user?.id;
    const loggedInUserType = req.user?.user_type;
    const profileUserId = parseInt(req.params.userId, 10);
    const { comment_text } = req.body;

    if (!loggedInUserId || loggedInUserType !== 'Artist' /* ... other checks */) {
        // ... handle errors
        return;
    }

    try {
        const profileUser = await User.findByPk(profileUserId);
        if (!profileUser || profileUser.user_type !== 'Artist') {
            res.status(404).json({ message: "Artist profile to comment on not found or user is not an artist." });
            return;
        }

        const newComment = await ArtistComment.create({
            profile_user_id: profileUserId,
            commenter_user_id: loggedInUserId,
            comment_text: comment_text.trim(),
        });

        const createdCommentWithDetails = await ArtistComment.findByPk(newComment.comment_id, {
            include: [{
                model: User,
                as: 'commenterArtist', // This is the User instance for the commenter
                attributes: ['user_id', 'fullname', 'user_type'], // Core User attributes
                include: [ // Nested include for profile picture
                    { model: Artist, as: 'artistProfile', attributes: ['profile_picture'], required: false },
                    { model: Employer, as: 'employerProfile', attributes: ['profile_picture'], required: false }
                ]
            }]
        });

        if (!createdCommentWithDetails) {
            res.status(404).json({ message: "Failed to retrieve created comment details." });
            return;
        }
        
        const commenterUserSequelizeInstance = createdCommentWithDetails.commenterArtist; // This IS a User Sequelize instance
        let formattedCommenterData: any = null; // Or a specific interface for the response shape

        if (commenterUserSequelizeInstance) {
            let profilePic = null;
            // Access nested profiles directly on the Sequelize User instance
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

        const plainCreatedCommentBase = createdCommentWithDetails.get({ plain: true });

        const responseComment = {
            comment_id: plainCreatedCommentBase.comment_id,
            profile_user_id: plainCreatedCommentBase.profile_user_id,
            commenter_user_id: plainCreatedCommentBase.commenter_user_id,
            comment_text: plainCreatedCommentBase.comment_text,
            created_at: plainCreatedCommentBase.created_at,
            updated_at: plainCreatedCommentBase.updated_at,
            commenter: formattedCommenterData
        };

        res.status(201).json({ message: "Viewpoint posted successfully!", comment: responseComment });

    } catch (error: any) {
        console.error("Error creating artist comment:", error);
        res.status(500).json({ message: "Failed to post viewpoint.", error: error.message });
    }
};

export const getCommentsForUserProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const profileUserId = parseInt(req.params.userId, 10);
        if (isNaN(profileUserId)) { res.status(400).json({ message: 'Invalid user ID format.' }); return; }

        const profileUser = await User.findByPk(profileUserId);
        if (!profileUser) { res.status(404).json({ message: 'Profile user not found.' }); return; }

        const commentsInstances = await ArtistComment.findAll({ // These are Sequelize instances
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
            const commenterUserSequelizeInstance = commentInstance.commenterArtist; // Access association on the instance
            let formattedCommenterData: any = null; // Or a specific interface

            if (commenterUserSequelizeInstance) {
                let profilePic = null;
                // Access nested profiles directly on the Sequelize User instance
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
            
            const plainCommentBase = commentInstance.get({ plain: true }); // Get plain object of the comment itself
            return {
                comment_id: plainCommentBase.comment_id,
                profile_user_id: plainCommentBase.profile_user_id,
                commenter_user_id: plainCommentBase.commenter_user_id,
                comment_text: plainCommentBase.comment_text,
                created_at: plainCommentBase.created_at,
                updated_at: plainCommentBase.updated_at,
                commenter: formattedCommenterData,
            };
        });

        res.status(200).json({ comments: formattedComments });

    } catch (error: any) {
        console.error('Error fetching comments for user profile:', error);
        res.status(500).json({ message: 'Failed to fetch viewpoints.', error: error.message });
    }
};