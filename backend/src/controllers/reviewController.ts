// src/controllers/review.controller.ts
import { Request, Response } from 'express';
import Review from '../models/Review';
import Chat from '../models/Chat';
import User from '../models/User';
import sequelize from '../config/db';
import { CustomRequest } from '../middleware/authMiddleware';
import { Sequelize } from 'sequelize'; // Keep needed imports
// --- FIX: Correct model imports ---
import Artist from '../models/Artist';
import Employer from '../models/Employer';
// --- END FIX ---


// Keep your existing submitReview function here
export const submitReview = async (req: CustomRequest, res: Response): Promise<void> => {
     try {
        const reviewerUserId = req.user?.id;
        const { chatId, reviewedUserId, overallRating, specificAnswers } = req.body;
        // --- Basic Validation ---
        if (!reviewerUserId) { res.status(401).json({ message: 'Unauthorized: Missing reviewer ID.' }); return; }
        if (!chatId || !reviewedUserId || overallRating === undefined) { res.status(400).json({ message: 'Missing required fields: chatId, reviewedUserId, overallRating.' }); return; }
        if (typeof overallRating !== 'number' || overallRating < 1 || overallRating > 5) { res.status(400).json({ message: 'Overall rating must be a number between 1 and 5.' }); return; }
        if (reviewerUserId === reviewedUserId) { res.status(400).json({ message: 'Users cannot review themselves.' }); return; }
        // --- End Validation ---
        const chat = await Chat.findByPk(chatId);
        if (!chat) { res.status(404).json({ message: 'Chat session not found.' }); return; }
        const isReviewerArtist = chat.artist_user_id === reviewerUserId;
        const isReviewerEmployer = chat.employer_user_id === reviewerUserId;
        const isReviewedParticipant = chat.artist_user_id === reviewedUserId || chat.employer_user_id === reviewedUserId;
        if (!(isReviewerArtist || isReviewerEmployer) || !isReviewedParticipant) { res.status(403).json({ message: 'Reviewer or reviewed user is not part of this chat.' }); return; }
        // TODO: Check if review already exists
        const newReview = await Review.create({
            chat_id: chatId, reviewer_user_id: reviewerUserId, reviewed_user_id: reviewedUserId,
            overall_rating: overallRating, specific_answers: specificAnswers || null,
        });
        try { // Update Chat status
            const statusFieldToUpdate = isReviewerArtist ? 'artist_rating_status' : 'employer_rating_status';
            await chat.update({ [statusFieldToUpdate]: 'completed' });
             console.log(`[Chat ${chatId}] User ${reviewerUserId} rating status set to completed.`);
        } catch (statusError) { console.error(`[Chat ${chatId}] Failed to update rating status after review submission:`, statusError); }
        res.status(201).json({ message: 'Review submitted successfully!', review: newReview });
    } catch (error: any) {
         console.error("❌ Error submitting review:", error);
         if (error.name === 'SequelizeValidationError') { res.status(400).json({ message: 'Validation failed.', errors: error.errors?.map((e: any) => e.message) }); }
         else { res.status(500).json({ message: 'Failed to submit review.', error: error.message }); }
    }
};


// Define interface for the aggregation result
interface AverageRatingResult {
    averageRating: number | string | null;
    reviewCount: number | string;
}


// --- Define interface for the SUM/COUNT aggregation result ---
interface SumRatingResult {
  ratingSum: number | string | null; // SUM can return decimal/string or null if no rows
  reviewCount: number | string;     // COUNT returns BIGINT which might be string
}

/* -------------------------------------------------------------------------- */
/* GET AVERAGE RATING FOR A USER (Using SUM / COUNT)                          */
/* -------------------------------------------------------------------------- */
// GET /api/users/:userId/average-rating
export const getAverageRatingForUser = async (req: Request, res: Response): Promise<void> => {
  try {
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) {
          res.status(400).json({ message: 'Invalid User ID.' }); return;
      }

      // Fetch the SUM and COUNT using aggregation
      const result = await Review.findOne({
          where: { reviewed_user_id: userId },
          attributes: [
              // --- CHANGE: Use SUM instead of AVG ---
              [sequelize.fn('SUM', sequelize.col('overall_rating')), 'ratingSum'],
              // --- Keep COUNT ---
              [sequelize.fn('COUNT', sequelize.col('review_id')), 'reviewCount']
          ],
          raw: true // Get plain object
      }) as unknown as SumRatingResult | null; // Use the new interface type assertion

      // Calculate the average manually
      const reviewCount = result?.reviewCount ? parseInt(String(result.reviewCount), 10) : 0;
      let averageRating: number | null = null; // Initialize as null

      // Only calculate average if there are reviews and a sum was returned
      if (reviewCount > 0 && result?.ratingSum != null) {
          const ratingSum = parseFloat(String(result.ratingSum)); // Parse sum safely
          if (!isNaN(ratingSum)) { // Check if sum is a valid number
               // Perform division and format to one decimal place
               averageRating = parseFloat((ratingSum / reviewCount).toFixed(1));
          } else {
               console.error(`Could not parse ratingSum ('${result.ratingSum}') to number for user ${userId}`);
          }
      }

      console.log(`[Rating Avg Calc] User: ${userId}, Sum: ${result?.ratingSum}, Count: ${reviewCount}, Average: ${averageRating}`);

      // Return the calculated average and count
      res.status(200).json({
          averageRating: averageRating, // Calculated average (e.g., 4.5) or null
          reviewCount: reviewCount      // Total number of reviews (e.g., 12)
      });

  } catch (error: any) {
      console.error(`Error fetching average rating for user ${req.params.userId}:`, error);
      res.status(500).json({ message: 'Failed to fetch average rating.', error: error.message });
  }
};


export const getReviewsForUser = async (req: Request, res: Response): Promise<void> => {
  try {
      const userId = parseInt(req.params.userId, 10);
      if (isNaN(userId)) { res.status(400).json({ message: 'Invalid User ID.' }); return; }

      console.log(`[getReviewsForUser - DEBUG] Fetching reviews WITH includes for reviewed_user_id: ${userId}`);

      const reviews = await Review.findAll({
          where: { reviewed_user_id: userId },
          include: [ // <<< KEEPING THE INCLUDE
              {
                  model: User,
                  as: 'reviewer',
                  attributes: ['user_id', 'fullname', 'user_type'],
                  include: [
                      { model: Artist, as: 'artistProfile', attributes: ['profile_picture'], required: false },
                      { model: Employer, as: 'employerProfile', attributes: ['profile_picture'], required: false }
                  ]
              }
          ],
          order: [['created_at', 'DESC']]
      });

      // --- Log the raw result WITH includes ---
      console.log("[DEBUG] Raw 'reviews' fetched WITH includes:", JSON.stringify(reviews, null, 2));
      // --- END LOG ---

      // --- Temporarily REMOVE the formattedReviews map ---
      // const formattedReviews = reviews.map(review => {
      //    // ... formatting logic ...
      // });
      // res.status(200).json({ reviews: formattedReviews });
      // --- END REMOVAL ---

      // --- Send the RAW result directly ---
      console.log("[DEBUG] Sending RAW reviews array to frontend.");
      res.status(200).json({ reviews }); // <<< SEND UNFORMATTED reviews
      // --- END SEND RAW ---

  } catch (error: any) {
      console.error(`Error fetching reviews for user ${req.params.userId}:`, error);
      res.status(500).json({ message: 'Failed to fetch reviews.', error: error.message });
  }
};