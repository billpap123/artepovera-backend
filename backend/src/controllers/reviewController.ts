// src/controllers/review.controller.ts
import { Response } from 'express';
import { CustomRequest } from '../middleware/authMiddleware'; // Adjust path if needed
import Review from '../models/Review';
import Chat from '../models/Chat';
import User from '../models/User';

export const submitReview = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
        const reviewerUserId = req.user?.id;
        // Get data from request body - ensure frontend sends these
        const { chatId, reviewedUserId, overallRating, specificAnswers } = req.body;

        // --- Basic Validation ---
        if (!reviewerUserId) {
            res.status(401).json({ message: 'Unauthorized: Missing reviewer ID.' }); return;
        }
        if (!chatId || !reviewedUserId || overallRating === undefined) {
            res.status(400).json({ message: 'Missing required fields: chatId, reviewedUserId, overallRating.' }); return;
        }
        if (typeof overallRating !== 'number' || overallRating < 1 || overallRating > 5) {
            res.status(400).json({ message: 'Overall rating must be a number between 1 and 5.' }); return;
        }
        if (reviewerUserId === reviewedUserId) {
             res.status(400).json({ message: 'Users cannot review themselves.' }); return;
        }
        // --- End Validation ---

        // Verify chat exists and involves both users
        const chat = await Chat.findByPk(chatId);
        if (!chat) {
            res.status(404).json({ message: 'Chat session not found.' }); return;
        }
        const isReviewerArtist = chat.artist_user_id === reviewerUserId;
        const isReviewerEmployer = chat.employer_user_id === reviewerUserId;
        const isReviewedParticipant = chat.artist_user_id === reviewedUserId || chat.employer_user_id === reviewedUserId;

        if (!(isReviewerArtist || isReviewerEmployer) || !isReviewedParticipant) {
             res.status(403).json({ message: 'Reviewer or reviewed user is not part of this chat.' }); return;
        }

        // TODO: Check if this user has already reviewed the other user for this specific chat
        // const existingReview = await Review.findOne({ where: { chat_id: chatId, reviewer_user_id: reviewerUserId }});
        // if (existingReview) { /* Handle already reviewed */ }

        // Create the review
        const newReview = await Review.create({
            chat_id: chatId,
            reviewer_user_id: reviewerUserId,
            reviewed_user_id: reviewedUserId,
            overall_rating: overallRating,
            specific_answers: specificAnswers || null, // Store answers object or null
        });

        // --- Update the Chat's rating status for the reviewer ---
        try {
            const statusFieldToUpdate = isReviewerArtist ? 'artist_rating_status' : 'employer_rating_status';
            await chat.update({ [statusFieldToUpdate]: 'completed' });
             console.log(`[Chat ${chatId}] User ${reviewerUserId} rating status set to completed.`);
        } catch (statusError) {
            console.error(`[Chat ${chatId}] Failed to update rating status after review submission:`, statusError);
            // Log error but don't fail the review submission itself
        }
        // --- End Status Update ---

        res.status(201).json({ message: 'Review submitted successfully!', review: newReview });

    } catch (error: any) {
        console.error("❌ Error submitting review:", error);
        // Handle potential validation errors from the model
         if (error.name === 'SequelizeValidationError') {
            res.status(400).json({ message: 'Validation failed.', errors: error.errors?.map((e: any) => e.message) });
        } else {
            res.status(500).json({ message: 'Failed to submit review.', error: error.message });
        }
    }
};

// Add other functions later: getReviewsForUser, getAverageRatingForUser