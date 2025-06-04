// src/controllers/artistCommentController.ts
import { Request, Response } from 'express';
import { CustomRequest } from '../middleware/authMiddleware';
import ArtistComment from '../models/ArtistComment';
import User from '../models/User'; // User model
import Artist from '../models/Artist'; // Artist model
import Employer from '../models/Employer'; // Employer model

export const createArtistComment = async (req: CustomRequest, res: Response): Promise<void> => {
    const loggedInUserId = req.user?.id;
    const loggedInUserType = req.user?.user_type;
    const profileUserId = parseInt(req.params.userId, 10);
    const { comment_text } = req.body;

    // --- Validations --- (keep your existing validations)
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

        const newCommentInstance = await ArtistComment.create({ // newCommentInstance is a Sequelize instance
            profile_user_id: profileUserId,
            commenter_user_id: loggedInUserId,
            comment_text: comment_text.trim(),
        });

        // Fetch the created comment with commenter details to return to the frontend
        // createdCommentWithDetails is also a Sequelize instance
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
        
        const commenterUserSequelizeInstance = createdCommentWithDetails.commenterArtist;
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

        // Get direct attributes from the plain object for the comment's own fields
        const plainCreatedCommentBase = createdCommentWithDetails.get({ plain: true });

        const responseComment = {
            comment_id: plainCreatedCommentBase.comment_id,
            profile_user_id: plainCreatedCommentBase.profile_user_id,
            commenter_user_id: plainCreatedCommentBase.commenter_user_id, // This is just the ID
            comment_text: plainCreatedCommentBase.comment_text,
            
            // --- MODIFIED TIMESTAMP HANDLING ---
            // Access timestamps from the Sequelize instance (createdCommentWithDetails)
            // and format them for the response with snake_case keys.
            created_at: createdCommentWithDetails.created_at ? createdCommentWithDetails.created_at.toISOString() : null,
            updated_at: createdCommentWithDetails.updated_at ? createdCommentWithDetails.updated_at.toISOString() : null,
            // --- END MODIFICATION ---
            
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
            order: [['created_at', 'DESC']], // DB column is 'created_at'
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
            
            // Get the plain object for most attributes
            const plainCommentBase = commentInstance.get({ plain: true });

            // --- MODIFIED TIMESTAMP HANDLING ---
            // Access standard Sequelize instance properties (camelCase)
            // and format them for the response with snake_case keys.
            const createdAtTimestamp = commentInstance.created_at;
            const updatedAtTimestamp = commentInstance.updated_at;
            // --- END MODIFICATION ---

            return {
                comment_id: plainCommentBase.comment_id,
                profile_user_id: plainCommentBase.profile_user_id,
                commenter_user_id: plainCommentBase.commenter_user_id,
                comment_text: plainCommentBase.comment_text,
                
                // Use the instance's timestamps and format them
                created_at: createdAtTimestamp ? createdAtTimestamp.toISOString() : null,
                updated_at: updatedAtTimestamp ? updatedAtTimestamp.toISOString() : null,
                
                commenter: formattedCommenterData,
            };
        });

        res.status(200).json({ comments: formattedComments });

    } catch (error: any) {
        console.error('Error fetching comments for user profile:', error);
        res.status(500).json({ message: 'Failed to fetch viewpoints.', error: error.message });
    }
};