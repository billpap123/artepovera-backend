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



// GET REVIEWS RECEIVED BY A USER (with detailed mapping logs)
export const getReviewsForUser = async (req: Request, res: Response): Promise<void> => {
  try {
       const userId = parseInt(req.params.userId, 10);
       if (isNaN(userId)) { res.status(400).json({ message: 'Invalid User ID.' }); return; }

       console.log(`[getReviewsForUser] Fetching reviews WITH includes for reviewed_user_id: ${userId}`);

       const reviews = await Review.findAll({
          where: { reviewed_user_id: userId },
          include: [
              {
                  model: User,
                  as: 'reviewer', // Alias for the reviewer User model
                  attributes: ['user_id', 'fullname', 'user_type'],
                  include: [ // Nested include for profile pic
                      { model: Artist, as: 'artistProfile', attributes: ['profile_picture'], required: false },
                      { model: Employer, as: 'employerProfile', attributes: ['profile_picture'], required: false }
                  ]
              }
          ],
          order: [['created_at', 'DESC']]
       });

       console.log(`[getReviewsForUser] Found ${reviews.length} reviews.`);

       // Format the response to simplify reviewer info
       const formattedReviews = reviews.map((review, index) => {
           console.log(`\n[MAP DEBUG ${index+1}] Processing review ID: ${review.review_id}`); // Log start of map item

           // Use .get() for plain object which often handles associations better than toJSON()
           const reviewData = review.get({ plain: true }) as any;
           console.log("[MAP DEBUG] review.get({ plain: true }) output:", JSON.stringify(reviewData, null, 2)); // Log the plain object

           const reviewerData = reviewData.reviewer; // Access the nested reviewer object
           console.log("[MAP DEBUG] Reviewer data object:", JSON.stringify(reviewerData, null, 2));

           let reviewerProfilePic: string | null = null;
           if (reviewerData) {
                // Try to get pic from either nested profile
                reviewerProfilePic = reviewerData.artistProfile?.profile_picture || reviewerData.employerProfile?.profile_picture || null;
                console.log("[MAP DEBUG] Extracted reviewerProfilePic:", reviewerProfilePic);
           } else {
               console.log("[MAP DEBUG] No reviewer data found in included object.");
           }

           // Create the simplified reviewer object
           const finalReviewer = reviewerData ? {
               user_id: reviewerData.user_id,
               fullname: reviewerData.fullname,
               profile_picture: reviewerProfilePic // Assign the extracted pic here
           } : null;
           console.log("[MAP DEBUG] Final reviewer object created:", JSON.stringify(finalReviewer, null, 2));

           // Construct the final object for this review
           const formattedReview = {
               review_id: reviewData.review_id,
               chat_id: reviewData.chat_id,
               overall_rating: reviewData.overall_rating,
               specific_answers: reviewData.specific_answers,
               // Access correct timestamp field (assuming underscored:true in Review model)
               created_at: reviewData.created_at,
               reviewer: finalReviewer
           };
            console.log("[MAP DEBUG] Final formatted review object:", JSON.stringify(formattedReview, null, 2));
            return formattedReview;
       });

       console.log("[getReviewsForUser] Sending formatted reviews to frontend.");
       res.status(200).json({ reviews: formattedReviews });

  } catch (error: any) {
       console.error(`Error fetching reviews for user ${req.params.userId}:`, error);
       res.status(500).json({ message: 'Failed to fetch reviews.', error: error.message });
  }
};