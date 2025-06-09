// src/controllers/review.controller.ts
import { Request, Response } from 'express';
import Review from '../models/Review';
import User from '../models/User';
import { CustomRequest } from '../middleware/authMiddleware';
import { UniqueConstraintError, ValidationError, Sequelize } from 'sequelize'; // <<< IMPORT Sequelize
import Artist  from '../models/Artist';
import Employer  from '../models/Employer';


export const submitReview = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
        const loggedInUserId = req.user?.id;
        const { reviewedUserId, overallRating, specificAnswers } = req.body;

        // --- Basic Validation ---
        if (!loggedInUserId) {
            res.status(401).json({ message: 'Unauthorized: Missing reviewer ID.' });
            return;
        }
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
        const userToReview = await User.findByPk(numericReviewedUserId);
        if (!userToReview) {
            res.status(404).json({ message: 'User to be reviewed not found.' });
            return;
        }
        
        const existingReview = await Review.findOne({
            where: {
                reviewer_user_id: loggedInUserId,
                reviewed_user_id: numericReviewedUserId
            }
        });

        if (existingReview) {
            res.status(409).json({ message: "You have already submitted a review for this user." });
            return;
        }

        const newReviewInstance = await Review.create({
            reviewer_user_id: loggedInUserId,
            reviewed_user_id: numericReviewedUserId,
            overall_rating: overallRating,
            specific_answers: specificAnswers || null,
        });

        // Format the response to include correctly named timestamps
        const responseReview = {
            review_id: newReviewInstance.review_id,
            reviewer_user_id: newReviewInstance.reviewer_user_id,
            reviewed_user_id: newReviewInstance.reviewed_user_id,
            overall_rating: newReviewInstance.overall_rating,
            specific_answers: newReviewInstance.specific_answers,
            created_at: newReviewInstance.createdAt ? newReviewInstance.createdAt.toISOString() : null,
            updated_at: newReviewInstance.updatedAt ? newReviewInstance.updatedAt.toISOString() : null,
        };

        res.status(201).json({ message: 'Review submitted successfully!', review: responseReview });

    } catch (error: any) {
         console.error("❌ Error submitting review:", error);
         if (error instanceof UniqueConstraintError) {
            res.status(409).json({ message: 'You have already submitted a review for this user (constraint error).' });
         } else if (error instanceof ValidationError) {
             res.status(400).json({ message: 'Validation failed.', errors: error.errors?.map((e: any) => e.message) });
         } else {
             res.status(500).json({ message: 'Failed to submit review.', error: error.message });
         }
    }
};

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
  
        const result = await Review.findOne({
            where: { reviewed_user_id: userId },
            attributes: [
                // --- USE 'Sequelize' (capital S) from the import ---
                [Sequelize.fn('SUM', Sequelize.col('overall_rating')), 'ratingSum'],
                [Sequelize.fn('COUNT', Sequelize.col('review_id')), 'reviewCount']
            ],
            raw: true
        }) as unknown as SumRatingResult | null;
  
        const reviewCount = result?.reviewCount ? parseInt(String(result.reviewCount), 10) : 0;
        let averageRating: number | null = null;
  
        if (reviewCount > 0 && result?.ratingSum != null) {
            const ratingSumValue = parseFloat(String(result.ratingSum));
            if (!isNaN(ratingSumValue)) {
                 averageRating = parseFloat((ratingSumValue / reviewCount).toFixed(1));
            }
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
            // --- USE 'Sequelize' (capital S) from the import ---
            order: [[Sequelize.col('Review.created_at'), 'DESC']]
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
                 overall_rating: plainReviewBase.overall_rating,
                 specific_answers: plainReviewBase.specific_answers,
                 created_at: reviewInstance.createdAt ? reviewInstance.createdAt.toISOString() : null,
                 updated_at: reviewInstance.updatedAt ? reviewInstance.updatedAt.toISOString() : null,
                 reviewer: formattedReviewerData
             };
         });
  
         res.status(200).json({ reviews: formattedReviews });
  
    } catch (error: any) {
         console.error(`Error fetching reviews for user ${req.params.userId}:`, error);
         res.status(500).json({ message: 'Failed to fetch reviews.', error: error.message });
    }
  };
