// src/controllers/review.controller.ts
import { Request, Response } from 'express';
import Review from '../models/Review';
import User from '../models/User';
import Artist from '../models/Artist';
import Employer from '../models/Employer';
import { CustomRequest } from '../middleware/authMiddleware';
import { UniqueConstraintError, ValidationError, Sequelize } from 'sequelize'; // <<< CORRECT: Import Sequelize object

export const submitReview = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
        const loggedInUserId = req.user?.id;
        // Destructure all possible fields from the request body
        const { reviewedUserId, overallRating, specificAnswers } = req.body;

        // --- 1. New, More Detailed Validation ---
        if (!loggedInUserId) {
            res.status(401).json({ message: 'Unauthorized: Missing reviewer ID.' });
            return;
        }

        // The most important piece of data now is 'dealMade' inside specificAnswers
        if (!reviewedUserId || !specificAnswers || !specificAnswers.dealMade) {
            res.status(400).json({ message: 'Missing required fields. reviewedUserId and dealMade are required.' });
            return;
        }

        const { dealMade, communicationRating_noDeal, noDealPrimaryReason } = specificAnswers;

        // Validate the "yes" path
        if (dealMade === 'yes') {
            if (typeof overallRating !== 'number' || overallRating < 1 || overallRating > 5) {
                res.status(400).json({ message: 'For a completed deal, a valid overall rating (1-5) is required.' });
                return;
            }
        } 
        // Validate the "no" path
        else if (dealMade === 'no') {
            if (typeof communicationRating_noDeal !== 'number' || communicationRating_noDeal < 1 || communicationRating_noDeal > 5) {
                res.status(400).json({ message: 'For an incomplete deal, a valid communication rating (1-5) is required.' });
                return;
            }
            if (!noDealPrimaryReason) {
                res.status(400).json({ message: 'For an incomplete deal, a primary reason is required.' });
                return;
            }
        } else {
            res.status(400).json({ message: "Invalid value for 'dealMade'. Must be 'yes' or 'no'." });
            return;
        }

        const numericReviewedUserId = parseInt(reviewedUserId, 10);
        if (isNaN(numericReviewedUserId) || loggedInUserId === numericReviewedUserId) {
            res.status(400).json({ message: 'Invalid request. Cannot review yourself.' });
            return;
        }
        
        const existingReview = await Review.findOne({
            where: { reviewer_user_id: loggedInUserId, reviewed_user_id: numericReviewedUserId }
        });
        if (existingReview) {
            res.status(409).json({ message: "You have already submitted a review for this user." });
            return;
        }

        // --- 2. New Data Preparation for Sequelize ---
        // This object now perfectly matches our updated database schema and Sequelize model
        const reviewDataToCreate = {
            reviewer_user_id: loggedInUserId,
            reviewed_user_id: numericReviewedUserId,
            
            // Map frontend data to the correct database columns
            deal_made: dealMade === 'yes', // Convert to boolean
            overall_rating: dealMade === 'yes' ? overallRating : null,
            communication_rating_no_deal: dealMade === 'no' ? communicationRating_noDeal : null,
            no_deal_primary_reason: dealMade === 'no' ? noDealPrimaryReason : null,
            
            // Still save the whole object in the JSON field for flexibility and other data like comments
            specific_answers: specificAnswers,
        };

        const newReviewInstance = await Review.create(reviewDataToCreate);

        // Fetch the full review with associations to send back to the frontend
        const createdReviewWithDetails = await Review.findByPk(newReviewInstance.review_id, {
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
            ]
        });

        res.status(201).json({ message: 'Review submitted successfully!', review: createdReviewWithDetails });

    } catch (error: any) {
         if (error instanceof UniqueConstraintError) {
            res.status(409).json({ message: 'You have already submitted a review for this user.' });
         } else if (error instanceof ValidationError) {
             res.status(400).json({ message: 'Validation failed.', errors: error.errors?.map((e: any) => e.message) });
         } else {
             console.error("❌ Error submitting review:", error);
             res.status(500).json({ message: 'Failed to submit review.', error: error.message });
         }
    }
};




// --- Your other functions are already correct and don't need changes ---

interface SumRatingResult {
  ratingSum: number | string | null;
  reviewCount: number | string;
}

export const getAverageRatingForUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = parseInt(req.params.userId, 10);
        if (isNaN(userId)) {
            res.status(400).json({ message: 'Invalid User ID.' }); return;
        }
  
        // This query correctly ignores NULL ratings from "no" deals, so no change is needed.
        const result = await Review.findOne({
            where: { reviewed_user_id: userId },
            attributes: [
                [Sequelize.fn('SUM', Sequelize.col('overall_rating')), 'ratingSum'],
                [Sequelize.fn('COUNT', Sequelize.col('review_id')), 'reviewCount']
            ],
            raw: true
        }) as unknown as { ratingSum: number | null, reviewCount: string } | null;
  
        const reviewCount = result?.reviewCount ? parseInt(result.reviewCount, 10) : 0;
        let averageRating: number | null = null;
  
        if (reviewCount > 0 && result?.ratingSum != null) {
            averageRating = parseFloat((result.ratingSum / reviewCount).toFixed(1));
        }
        
        res.status(200).json({ averageRating: averageRating, reviewCount: reviewCount });
  
    } catch (error: any) {
        console.error(`Error fetching average rating for user ${req.params.userId}:`, error);
        res.status(500).json({ message: 'Failed to fetch average rating.', error: error.message });
    }
};
  
export const checkExistingReview = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
        const reviewerIdString = req.query.reviewerId as string;
        const reviewedUserIdString = req.query.reviewedUserId as string;

        if (!reviewerIdString || !reviewedUserIdString) {
            res.status(400).json({ message: "Missing reviewerId or reviewedUserId query parameters." });
            return;
        }
        const reviewerId = parseInt(reviewerIdString, 10);
        const reviewedUserId = parseInt(reviewedUserIdString, 10);

        if (isNaN(reviewerId) || isNaN(reviewedUserId)) {
            res.status(400).json({ message: "Invalid user IDs. They must be numbers." });
            return;
        }

        const review = await Review.findOne({
            where: { reviewer_user_id: reviewerId, reviewed_user_id: reviewedUserId }
        });

        res.status(200).json({ hasReviewed: !!review });

    } catch (error: any) {
        console.error("Error checking existing review:", error);
        res.status(500).json({ message: "Failed to check review status.", error: error.message });
    }
};

export const getReviewsForUser = async (req: Request, res: Response): Promise<void> => {
    try {
         const userId = parseInt(req.params.userId, 10);
         if (isNaN(userId)) { 
             res.status(400).json({ message: 'Invalid User ID.' }); 
             return; 
         }
  
         // This query will fetch all data, including the new fields in specific_answers.
         // The frontend will then filter the results into two lists. No changes are needed here.
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
            order: [[Sequelize.col('Review.created_at'), 'DESC']]
         });
  
         // We must reconstruct the response to match the frontend's expectations now.
         const formattedReviews = reviewsInstances.map(review => {
            const reviewerData = review.reviewer ? {
                user_id: review.reviewer.user_id,
                fullname: review.reviewer.fullname,
                user_type: review.reviewer.user_type,
                profile_picture: review.reviewer.user_type === 'Artist' 
                    ? review.reviewer.artistProfile?.profile_picture 
                    : review.reviewer.employerProfile?.profile_picture,
            } : null;

             return {
                 review_id: review.review_id,
                 overall_rating: review.overall_rating,
                 // The frontend expects the full `specific_answers` object.
                 // We stored most important data in top-level columns, so we reconstruct it.
                 specific_answers: {
                    dealMade: review.deal_made ? 'yes' : 'no',
                    communicationRating_noDeal: review.communication_rating_no_deal,
                    noDealPrimaryReason: review.no_deal_primary_reason,
                    // Pass along any other answers like comments that are in the JSON blob.
                    ...(review.specific_answers as object || {})
                 },
                 created_at: review.createdAt,
                 reviewer: reviewerData,
             };
         });
  
         res.status(200).json({ reviews: formattedReviews });
  
    } catch (error: any) {
         console.error(`Error fetching reviews for user ${req.params.userId}:`, error);
         res.status(500).json({ message: 'Failed to fetch reviews.', error: error.message });
    }
  };
