// src/controllers/review.controller.ts
import { Request, Response } from 'express';
import Review from '../models/Review';
import Chat from '../models/Chat';
import User from '../models/User';
import sequelize from '../config/db';
import { CustomRequest } from '../middleware/authMiddleware';
import { Artist, Employer } from 'models';

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
    } catch (error: any) { /* ... existing error handling ... */ }
};


// Define interface for the aggregation result
interface AverageRatingResult {
    averageRating: number | string | null;
    reviewCount: number | string;
}

/* -------------------------------------------------------------------------- */
/* GET AVERAGE RATING FOR A USER                                              */
/* -------------------------------------------------------------------------- */
// GET /api/users/:userId/average-rating
export const getAverageRatingForUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = parseInt(req.params.userId, 10);
        if (isNaN(userId)) {
            res.status(400).json({ message: 'Invalid User ID.' }); return;
        }

        // --- FIX: Use double type assertion ---
        const result = await Review.findOne({
            where: { reviewed_user_id: userId },
            attributes: [
                [sequelize.fn('AVG', sequelize.col('overall_rating')), 'averageRating'],
                [sequelize.fn('COUNT', sequelize.col('review_id')), 'reviewCount']
            ],
            raw: true // Get plain object
        }) as unknown as AverageRatingResult | null; // <<< CORRECTED TYPE ASSERTION
        // --- End Fix ---


        const averageRating = result?.averageRating ? parseFloat(parseFloat(String(result.averageRating)).toFixed(1)) : null;
        const reviewCount = result?.reviewCount ? parseInt(String(result.reviewCount), 10) : 0;

        res.status(200).json({
            averageRating: averageRating,
            reviewCount: reviewCount
        });

    } catch (error: any) {
        console.error(`Error fetching average rating for user ${req.params.userId}:`, error);
        res.status(500).json({ message: 'Failed to fetch average rating.', error: error.message });
    }
};

/* -------------------------------------------------------------------------- */
/* GET REVIEWS RECEIVED BY A USER                                             */
/* -------------------------------------------------------------------------- */
// GET /api/users/:userId/reviews
export const getReviewsForUser = async (req: Request, res: Response): Promise<void> => {
  try {
       const userId = parseInt(req.params.userId, 10);
       if (isNaN(userId)) {
           res.status(400).json({ message: 'Invalid User ID.' }); return;
       }

       const reviews = await Review.findAll({
          where: { reviewed_user_id: userId },
          include: [
              {
                  // Include the User who wrote the review
                  model: User,
                  as: 'reviewer', // Alias for the reviewer User model
                  attributes: ['user_id', 'fullname', 'user_type'], // Get basic info + user_type
                  // --- ADD NESTED INCLUDE for profile picture ---
                  include: [
                      {
                          model: Artist,
                          as: 'artistProfile', // <<< Use the alias defined in User<>Artist association
                          attributes: ['profile_picture'],
                          required: false // Use LEFT JOIN
                      },
                      {
                          model: Employer,
                          as: 'employerProfile', // <<< Use the alias defined in User<>Employer association
                          attributes: ['profile_picture'],
                          required: false // Use LEFT JOIN
                      }
                  ]
                  // --- END NESTED INCLUDE ---
              }
          ],
          order: [['created_at', 'DESC']]
       });

       // Optional: Clean up the response structure if needed before sending
       const formattedReviews = reviews.map(review => {
           const reviewJson = review.toJSON() as any; // Type assertion needed for nested includes sometimes
           // Combine profile pictures into a single field for easier frontend use
           const reviewerProfilePic = reviewJson.reviewer?.artistProfile?.profile_picture || reviewJson.reviewer?.employerProfile?.profile_picture || null;
           // Return a cleaner reviewer object
           const finalReviewer = reviewJson.reviewer ? {
               user_id: reviewJson.reviewer.user_id,
               fullname: reviewJson.reviewer.fullname,
               profile_picture: reviewerProfilePic
           } : null;

           // Return the review with the simplified reviewer
           return {
               ...reviewJson, // Spread existing review fields (review_id, rating, comment, etc.)
               reviewer: finalReviewer // Overwrite with the simplified reviewer object
           };
       });

       res.status(200).json({ reviews: formattedReviews }); // Send the formatted reviews

  } catch (error: any) {
       console.error(`Error fetching reviews for user ${req.params.userId}:`, error);
       res.status(500).json({ message: 'Failed to fetch reviews.', error: error.message });
  }
};