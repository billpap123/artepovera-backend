// src/controllers/artistCommentController.ts
import { Request, Response } from 'express';
import { CustomRequest } from '../middleware/authMiddleware'; // Your custom request type for req.user
import ArtistComment from '../models/ArtistComment';
import User from '../models/User';
import Artist from '../models/Artist'; // If you need to specifically ensure commenter/profile is an artist via Artist model

export const createArtistComment = async (req: CustomRequest, res: Response): Promise<void> => {
    const loggedInUserId = req.user?.id;
    const loggedInUserType = req.user?.user_type;
    const profileUserId = parseInt(req.params.userId, 10); // ID of the profile being commented on
    const { comment_text } = req.body;

    if (!loggedInUserId) {
        res.status(401).json({ message: "Unauthorized. Please log in to comment." });
        return;
    }
    if (loggedInUserType !== 'Artist') {
        res.status(403).json({ message: "Forbidden. Only artists can post artistic viewpoints." });
        return;
    }
    if (isNaN(profileUserId)) {
        res.status(400).json({ message: "Invalid profile user ID." });
        return;
    }
    if (!comment_text || typeof comment_text !== 'string' || comment_text.trim() === "") {
        res.status(400).json({ message: "Comment text cannot be empty." });
        return;
    }
    if (loggedInUserId === profileUserId) {
        res.status(400).json({ message: "Artists cannot comment on their own profile." });
        return;
    }

    try {
        // Verify the profile being commented on belongs to an artist
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

        // Fetch the created comment with commenter details to return to the frontend
        const createdCommentWithDetails = await ArtistComment.findByPk(newComment.comment_id, {
            include: [{
                model: User,
                as: 'commenterArtist', // Must match association alias
                attributes: ['user_id', 'fullname', 'user_type'],
                // If profile_picture is nested in Artist/Employer sub-profiles:
                // include: [ 
                //   { model: Artist, as: 'artistProfile', attributes: ['profile_picture'], required: false }
                // ]
                // OR if User model has profile_picture directly:
                // attributes: ['user_id', 'fullname', 'user_type', 'profile_picture']
            }]
        });
        
        // Simple mapping if profile_picture is directly on User. Adjust if nested.
        const commenterData = createdCommentWithDetails?.commenterArtist?.get({ plain: true });
        const responseComment = {
            ...createdCommentWithDetails?.get({ plain: true }),
            commenter: commenterData ? {
                user_id: commenterData.user_id,
                fullname: commenterData.fullname,
                user_type: commenterData.user_type,
                profile_picture: commenterData.profile_picture || null // Assuming User model has profile_picture
            } : null
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
        if (isNaN(profileUserId)) {
            res.status(400).json({ message: 'Invalid user ID format.' });
            return;
        }

        // Optional: Check if the profile user exists
        const profileUser = await User.findByPk(profileUserId);
        if (!profileUser) {
            res.status(404).json({ message: 'Profile user not found.' });
            return;
        }
        // if (profileUser.user_type !== 'Artist') {
        //     return res.status(200).json({ comments: [] }); // Or 400 if comments only for artists
        // }

        const comments = await ArtistComment.findAll({
            where: { profile_user_id: profileUserId },
            include: [{
                model: User,
                as: 'commenterArtist', // Must match association alias
                attributes: ['user_id', 'fullname', 'user_type'], // Add 'profile_picture' if directly on User model
                // Example if profile_picture is in a nested Artist model associated with User:
                // include: [{
                //     model: Artist,
                //     as: 'artistProfile', // assuming 'artistProfile' is the alias for User -> Artist
                //     attributes: ['profile_picture'],
                //     required: false
                // }]
            }],
            order: [['created_at', 'DESC']],
        });

        // Map to structure profile picture correctly if it's nested
        const formattedComments = comments.map(comment => {
            const plainComment = comment.get({ plain: true }) as any; // Use 'as any' carefully or define proper types
            const commenterUser = plainComment.commenterArtist;
            let commenterProfilePic = null;

            if (commenterUser) {
                // Assuming User model *might* have artistProfile which has profile_picture
                // Adjust this logic based on your actual User/Artist/Employer model structure
                // For simplicity, let's assume profile_picture might be directly on commenterUser for now
                commenterProfilePic = commenterUser.profile_picture || (commenterUser.artistProfile?.profile_picture) || (commenterUser.employerProfile?.profile_picture) || null;
            }
            
            return {
                ...plainComment,
                commenter: commenterUser ? {
                    user_id: commenterUser.user_id,
                    fullname: commenterUser.fullname,
                    user_type: commenterUser.user_type,
                    profile_picture: commenterProfilePic
                } : null,
            };
        });

        res.status(200).json({ comments: formattedComments });

    } catch (error: any) {
        console.error('Error fetching comments for user profile:', error);
        res.status(500).json({ message: 'Failed to fetch viewpoints.', error: error.message });
    }
};