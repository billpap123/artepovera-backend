// src/controllers/review.controller.ts
import { Request, Response } from 'express';
import Review from '../models/Review';
// Chat model is no longer needed for core review submission
// import Chat from '../models/Chat'; 
import User from '../models/User'; // Still needed to optionally check if reviewedUser exists
import { CustomRequest } from '../middleware/authMiddleware';
import { UniqueConstraintError, ValidationError } from 'sequelize'; // For specific error handling
import  Artist  from '../models/Artist';
import  Employer  from '../models/Employer';

// Artist and Employer imports are no longer needed here as they were for chat participant validation

// Make sure your sequelize instance is correctly imported for use in getAverageRatingForUser
import sequelizeInstance from '../config/db'; // Assuming 'sequelizeInstance' is the name of your exported sequelize connection

export const submitReview = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
        const loggedInUserId = req.user?.id; // This is the reviewer (User.user_id)
        
        // `chatId` is no longer expected from req.body for creating a review
        const { reviewedUserId, overallRating, specificAnswers } = req.body;

        // --- Basic Validation ---
        if (!loggedInUserId) {
            res.status(401).json({ message: 'Unauthorized: Missing reviewer ID.' });
            return;
        }
        // `chatId` removed from this check
        if (reviewedUserId === undefined || overallRating === undefined) {
            res.status(400).json({ message: 'Missing required fields: reviewedUserId, overallRating.' });
            return;
        }

        const numericReviewedUserId = parseInt(reviewedUserId, 10);
        if (isNaN(numericReviewedUserId)) {
            res.status(400).json({ message: "Reviewed User ID must be a valid number." });
            return;
        }

        if (typeof overallRating !== 'number' || overallRating < 1 || overallRating > 5) {
            res.status(400).json({ message: 'Overall rating must be a number between 1 and 5.' });
            return;
        }
        if (loggedInUserId === numericReviewedUserId) {
            res.status(400).json({ message: 'Users cannot review themselves.' });
            return;
        }
        
        // Optional: Check if the user being reviewed actually exists
        const userToReview = await User.findByPk(numericReviewedUserId);
        if (!userToReview) {
            res.status(404).json({ message: 'User to be reviewed not found.' });
            return;
        }
        // --- End Validation ---

        // --- CHAT-SPECIFIC LOGIC REMOVED ---
        // All chat parsing, fetching, and participant validation logic is removed.
        // --- END CHAT-SPECIFIC LOGIC REMOVED ---

        // Prevent duplicate reviews: a reviewer can only review a specific user once.
        // This relies on the unique constraint `uq_reviewer_reviewed_once` (reviewer_user_id, reviewed_user_id)
        // which you should have added to your database table.
        // The database will enforce this. We can also do an explicit check for a cleaner message:
        const existingReview = await Review.findOne({
            where: {
                reviewer_user_id: loggedInUserId,
                reviewed_user_id: numericReviewedUserId
            }
        });

        if (existingReview) {
            // This message will be shown if the explicit check finds a review.
            // If the explicit check is removed, the catch block for UniqueConstraintError will handle it.
            res.status(409).json({ message: "You have already submitted a review for this user." });
            return;
        }

        const newReview = await Review.create({
            // chat_id is no longer provided here; it will be NULL by default in the DB
            // if the column is nullable and has no other default value.
            reviewer_user_id: loggedInUserId,
            reviewed_user_id: numericReviewedUserId,
            overall_rating: overallRating,
            specific_answers: specificAnswers || null, // Ensure specificAnswers can be null if not provided
        });

        // --- CHAT STATUS UPDATE LOGIC REMOVED ---
        // No more chat status updates.
        // --- END CHAT STATUS UPDATE LOGIC REMOVED ---

        res.status(201).json({ message: 'Review submitted successfully!', review: newReview });

    } catch (error: any) {
         console.error("❌ Error submitting review:", error);
         if (error instanceof UniqueConstraintError) {
            // This will be triggered by the DB unique constraint `uq_reviewer_reviewed_once`
            // if the explicit findOne check above is removed or somehow bypassed.
            res.status(409).json({ message: 'You have already submitted a review for this user (constraint error).' });
         } else if (error instanceof ValidationError) { // Sequelize validation errors
             res.status(400).json({ message: 'Validation failed.', errors: error.errors?.map((e: any) => e.message) });
         } else {
             res.status(500).json({ message: 'Failed to submit review.', error: error.message });
         }
    }
};

// --- Define interface for the SUM/COUNT aggregation result (keep as is) ---
interface SumRatingResult {
  ratingSum: number | string | null;
  reviewCount: number | string;
}


/* -------------------------------------------------------------------------- */
/* GET AVERAGE RATING FOR A USER (Using SUM / COUNT)                          */
/* -------------------------------------------------------------------------- */
export const getAverageRatingForUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = parseInt(req.params.userId, 10);
        if (isNaN(userId)) {
            res.status(400).json({ message: 'Invalid User ID.' }); return;
        }
  
        const result = await Review.findOne({
            where: { reviewed_user_id: userId },
            attributes: [
                [sequelizeInstance.fn('SUM', sequelizeInstance.col('overall_rating')), 'ratingSum'],
                [sequelizeInstance.fn('COUNT', sequelizeInstance.col('review_id')), 'reviewCount']
            ],
            raw: true
        }) as unknown as SumRatingResult | null;
  
        const reviewCount = result?.reviewCount ? parseInt(String(result.reviewCount), 10) : 0;
        let averageRating: number | null = null;
  
        if (reviewCount > 0 && result?.ratingSum != null) { // Using ratingSum here is correct
            const ratingSumValue = parseFloat(String(result.ratingSum)); // Using ratingSum here is correct
            if (!isNaN(ratingSumValue)) {
                 averageRating = parseFloat((ratingSumValue / reviewCount).toFixed(1));
            } else {
                 console.error(`Could not parse ratingSum ('${result.ratingSum}') to number for user ${userId}`);
            }
        }
  
        // CORRECTED CONSOLE.LOG LINE:
        console.log(`[Rating Avg Calc] User: ${userId}, Sum: ${result?.ratingSum}, Count: ${reviewCount}, Average: ${averageRating}`);
        
        res.status(200).json({ averageRating: averageRating, reviewCount: reviewCount });
  
    } catch (error: any) {
        console.error(`Error fetching average rating for user ${req.params.userId}:`, error);
        res.status(500).json({ message: 'Failed to fetch average rating.', error: error.message });
    }
  };
  
// In reviewController.ts
export const checkExistingReview = async (req: CustomRequest, res: Response): Promise<void> => { // Explicit return type
    try {
        const reviewerIdString = req.query.reviewerId as string;
        const reviewedUserIdString = req.query.reviewedUserId as string;

        // More robust parsing and validation
        if (!reviewerIdString || !reviewedUserIdString) {
            res.status(400).json({ message: "Missing reviewerId or reviewedUserId query parameters." });
            return; // Exit after sending response
        }

        const reviewerId = parseInt(reviewerIdString, 10);
        const reviewedUserId = parseInt(reviewedUserIdString, 10);

        if (isNaN(reviewerId) || isNaN(reviewedUserId)) {
            res.status(400).json({ message: "Invalid user IDs. They must be numbers." });
            return; // Exit after sending response
        }

        const review = await Review.findOne({
            where: { reviewer_user_id: reviewerId, reviewed_user_id: reviewedUserId }
        });

        res.status(200).json({ hasReviewed: !!review });
        // No explicit return needed here; sending response ends the handler.

    } catch (error: any) { // Added 'any' for error type, or be more specific
        console.error("Error checking existing review:", error);
        res.status(500).json({ message: "Failed to check review status.", error: error.message });
    }
};

/* -------------------------------------------------------------------------- */
/* GET REVIEWS RECEIVED BY A USER                     */
/* -------------------------------------------------------------------------- */
// No major changes to its core logic. 
// The `chat_id` field in returned reviews will now be `null` for reviews submitted without chat context.

/* -------------------------------------------------------------------------- */
/* GET REVIEWS RECEIVED BY A USER                                             */
/* -------------------------------------------------------------------------- */
export const getReviewsForUser = async (req: Request, res: Response): Promise<void> => {
    try {
         const userId = parseInt(req.params.userId, 10);
         if (isNaN(userId)) { 
             res.status(400).json({ message: 'Invalid User ID.' }); 
             return; 
         }
  
         const reviewsInstances = await Review.findAll({
            where: { reviewed_user_id: userId },
            include: [
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
            // --- THIS IS THE CORRECTED LINE ---
            order: [[sequelizeInstance.col('Review.created_at'), 'DESC']]
            // --- END CORRECTION ---
         });
  
         const formattedReviews = reviewsInstances.map(reviewInstance => {
             const reviewerInstance = reviewInstance.reviewer;
             let formattedReviewerData: any = null;
  
             if (reviewerInstance) {
                 let reviewerProfilePic: string | null = null;
                 if (reviewerInstance.user_type === 'Artist' && reviewerInstance.artistProfile) {
                     reviewerProfilePic = reviewerInstance.artistProfile.profile_picture;
                 } else if (reviewerInstance.user_type === 'Employer' && reviewerInstance.employerProfile) {
                     reviewerProfilePic = reviewerInstance.employerProfile.profile_picture;
                 }
                 formattedReviewerData = {
                     user_id: reviewerInstance.user_id,
                     fullname: reviewerInstance.fullname,
                     user_type: reviewerInstance.user_type,
                     profile_picture: reviewerProfilePic || null
                 };
             }
             
             const plainReviewBase = reviewInstance.get({ plain: true });
  
             return {
                review_id: plainReviewBase.review_id,
                // --- REMOVE THIS LINE ---
                // chat_id: plainReviewBase.chat_id, 
                overall_rating: plainReviewBase.overall_rating,
                specific_answers: plainReviewBase.specific_answers,
                created_at: reviewInstance.createdAt ? reviewInstance.createdAt.toISOString() : null,
                reviewer: formattedReviewerData
            };
         });
  
         res.status(200).json({ reviews: formattedReviews });
  
    } catch (error: any) {
         console.error(`Error fetching reviews for user ${req.params.userId}:`, error);
         res.status(500).json({ message: 'Failed to fetch reviews.', error: error.message });
    }
  };