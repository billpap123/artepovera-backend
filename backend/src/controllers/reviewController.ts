// src/controllers/review.controller.ts
import { Request, Response } from 'express';
import Review from '../models/Review';
import Chat from '../models/Chat';
import User from '../models/User';
import sequelize from '../config/db';
import { CustomRequest } from '../middleware/authMiddleware';
import { Sequelize } from 'sequelize'; // Keep needed imports
import Artist from '../models/Artist';
import Employer from '../models/Employer';

export const submitReview = async (req: CustomRequest, res: Response): Promise<void> => {
    try {
        const loggedInUserId = req.user?.id; // This is the reviewer (User.user_id)
        const { chatId, reviewedUserId, overallRating, specificAnswers } = req.body; // reviewedUserId is User.user_id

        // --- Basic Validation ---
        if (!loggedInUserId) { res.status(401).json({ message: 'Unauthorized: Missing reviewer ID.' }); return; }
        if (!chatId || !reviewedUserId || overallRating === undefined) { res.status(400).json({ message: 'Missing required fields: chatId, reviewedUserId, overallRating.' }); return; }
        if (typeof overallRating !== 'number' || overallRating < 1 || overallRating > 5) { res.status(400).json({ message: 'Overall rating must be a number between 1 and 5.' }); return; }
        if (loggedInUserId === reviewedUserId) { res.status(400).json({ message: 'Users cannot review themselves.' }); return; }
        // --- End Validation ---

        const numericChatId = parseInt(chatId, 10);
        const numericReviewedUserId = parseInt(reviewedUserId, 10);

        if (isNaN(numericChatId) || isNaN(numericReviewedUserId)) {
            res.status(400).json({ message: "Chat ID and Reviewed User ID must be numbers." }); return;
        }

        const chat = await Chat.findByPk(numericChatId);
        if (!chat) { res.status(404).json({ message: 'Chat session not found.' }); return; }

        // --- CORRECTED AND MORE EXPLICIT PARTICIPANT CHECK ---
        // 1. Get profiles for the logged-in user (reviewer)
        const reviewerUserWithProfiles = await User.findByPk(loggedInUserId, {
            include: [
                { model: Artist, as: 'artistProfile', attributes: ['artist_id'] },
                { model: Employer, as: 'employerProfile', attributes: ['employer_id'] }
            ]
        });
        if (!reviewerUserWithProfiles) { res.status(404).json({ message: 'Reviewer profile not found.' }); return; }

        // 2. Get profiles for the user being reviewed
        const reviewedUserWithProfiles = await User.findByPk(numericReviewedUserId, {
            include: [
                { model: Artist, as: 'artistProfile', attributes: ['artist_id'] },
                { model: Employer, as: 'employerProfile', attributes: ['employer_id'] }
            ]
        });
        if (!reviewedUserWithProfiles) { res.status(404).json({ message: 'User being reviewed not found.' }); return; }

        // Get the actual Profile PKs (Artist.artist_id or Employer.employer_id)
        const reviewerArtistId = reviewerUserWithProfiles.artistProfile?.artist_id;
        const reviewerEmployerId = reviewerUserWithProfiles.employerProfile?.employer_id;
        const reviewedArtistId = reviewedUserWithProfiles.artistProfile?.artist_id;
        const reviewedEmployerId = reviewedUserWithProfiles.employerProfile?.employer_id;

        // --- Determine roles in THIS specific chat ---
        // chat.artist_user_id stores the Artist PK for this chat
        // chat.employer_user_id stores the Employer PK for this chat
        const chatArtistParticipantId = chat.artist_user_id;
        const chatEmployerParticipantId = chat.employer_user_id;

        // Is the reviewer the artist recorded in this chat?
        const isReviewerTheArtistInChat = reviewerArtistId && reviewerArtistId === chatArtistParticipantId;
        // Is the reviewer the employer recorded in this chat?
        const isReviewerTheEmployerInChat = reviewerEmployerId && reviewerEmployerId === chatEmployerParticipantId;

        // Is the user being reviewed the artist recorded in this chat?
        const isReviewedTheArtistInChat = reviewedArtistId && reviewedArtistId === chatArtistParticipantId;
        // Is the user being reviewed the employer recorded in this chat?
        const isReviewedTheEmployerInChat = reviewedEmployerId && reviewedEmployerId === chatEmployerParticipantId;

        // Valid scenarios:
        // 1. Reviewer is the Artist in chat, AND Reviewed User is the Employer in chat
        // 2. Reviewer is the Employer in chat, AND Reviewed User is the Artist in chat
        const isValidParticipants =
            (isReviewerTheArtistInChat && isReviewedTheEmployerInChat) ||
            (isReviewerTheEmployerInChat && isReviewedTheArtistInChat);

        if (!isValidParticipants) {
            console.warn(`[SUBMIT REVIEW] Auth Fail: ChatID: ${chatId}`);
            console.warn(`  Chat Participants (Profile PKs) - Artist: ${chat.artist_user_id}, Employer: ${chat.employer_user_id}`);
            console.warn(`  Reviewer (User ID ${loggedInUserId}) - Artist PK: ${reviewerArtistId}, Employer PK: ${reviewerEmployerId}`);
            console.warn(`  Reviewed (User ID ${numericReviewedUserId}) - Artist PK: ${reviewedArtistId}, Employer PK: ${reviewedEmployerId}`);
            res.status(403).json({ message: 'Reviewer and reviewed user must be the two distinct artist/employer participants of this chat.' });
            return;
        }
        // --- END CORRECTED PARTICIPANT CHECK ---

        // Prevent duplicate reviews for the same chat by the same reviewer
        const existingReview = await Review.findOne({
            where: {
                chat_id: numericChatId,
                reviewer_user_id: loggedInUserId
            }
        });
        if (existingReview) {
            return void res.status(409).json({ message: "You have already submitted a review for this collaboration/chat."});
        }

        const newReview = await Review.create({
            chat_id: numericChatId,
            reviewer_user_id: loggedInUserId,
            reviewed_user_id: numericReviewedUserId,
            overall_rating: overallRating,
            specific_answers: specificAnswers || null,
        });

        // Update Chat status (for the reviewer)
        try {
            let statusFieldToUpdate: 'artist_rating_status' | 'employer_rating_status' | null = null;
            // Use the flags determined above for clarity
            if (isReviewerTheArtistInChat) {
                statusFieldToUpdate = 'artist_rating_status';
            } else if (isReviewerTheEmployerInChat) {
                statusFieldToUpdate = 'employer_rating_status';
            }

            if (statusFieldToUpdate) {
                await chat.update({ [statusFieldToUpdate]: 'completed' });
                console.log(`[Chat ${numericChatId}] User ${loggedInUserId} rating status set to completed.`);
            } else {
                // This case should ideally not be reached if isValidParticipants is true
                console.warn(`[Chat ${numericChatId}] Could not determine status field to update for reviewer ${loggedInUserId}. This indicates an issue in participant role determination.`);
            }
        } catch (statusError) {
            console.error(`[Chat ${numericChatId}] Failed to update rating status after review submission:`, statusError);
        }

        res.status(201).json({ message: 'Review submitted successfully!', review: newReview });

    } catch (error: any) {
         console.error("❌ Error submitting review:", error);
         if (error.name === 'SequelizeValidationError') {
             res.status(400).json({ message: 'Validation failed.', errors: error.errors?.map((e: any) => e.message) });
         } else {
             res.status(500).json({ message: 'Failed to submit review.', error: error.message });
         }
    }
};

// --- Define interface for the SUM/COUNT aggregation result ---
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
              [sequelize.fn('SUM', sequelize.col('overall_rating')), 'ratingSum'],
              [sequelize.fn('COUNT', sequelize.col('review_id')), 'reviewCount']
          ],
          raw: true
      }) as unknown as SumRatingResult | null;

      const reviewCount = result?.reviewCount ? parseInt(String(result.reviewCount), 10) : 0;
      let averageRating: number | null = null;

      if (reviewCount > 0 && result?.ratingSum != null) {
          const ratingSum = parseFloat(String(result.ratingSum));
          if (!isNaN(ratingSum)) {
               averageRating = parseFloat((ratingSum / reviewCount).toFixed(1));
          } else {
               console.error(`Could not parse ratingSum ('${result.ratingSum}') to number for user ${userId}`);
          }
      }

      console.log(`[Rating Avg Calc] User: ${userId}, Sum: ${result?.ratingSum}, Count: ${reviewCount}, Average: ${averageRating}`);
      res.status(200).json({ averageRating: averageRating, reviewCount: reviewCount });

  } catch (error: any) {
      console.error(`Error fetching average rating for user ${req.params.userId}:`, error);
      res.status(500).json({ message: 'Failed to fetch average rating.', error: error.message });
  }
};

// GET REVIEWS RECEIVED BY A USER
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
                  as: 'reviewer',
                  attributes: ['user_id', 'fullname', 'user_type'],
                  include: [
                      { model: Artist, as: 'artistProfile', attributes: ['profile_picture'], required: false },
                      { model: Employer, as: 'employerProfile', attributes: ['profile_picture'], required: false }
                  ]
              }
          ],
          order: [['created_at', 'DESC']] // Use actual DB column name if model isn't underscored or using 'field'
       });

       console.log(`[getReviewsForUser] Found ${reviews.length} reviews.`);

       const formattedReviews = reviews.map((review, index) => {
           // console.log(`\n[MAP DEBUG ${index+1}] Processing review ID: ${review.review_id}`);
           const reviewData = review.get({ plain: true }) as any;
           // console.log("[MAP DEBUG] review.get({ plain: true }) output:", JSON.stringify(reviewData, null, 2));
           const reviewerData = reviewData.reviewer;
           // console.log("[MAP DEBUG] Reviewer data object:", JSON.stringify(reviewerData, null, 2));
           let reviewerProfilePic: string | null = null;
           if (reviewerData) {
                reviewerProfilePic = reviewerData.artistProfile?.profile_picture || reviewerData.employerProfile?.profile_picture || null;
                // console.log("[MAP DEBUG] Extracted reviewerProfilePic:", reviewerProfilePic);
           } // else { console.log("[MAP DEBUG] No reviewer data found in included object."); }
           const finalReviewer = reviewerData ? {
               user_id: reviewerData.user_id,
               fullname: reviewerData.fullname,
               profile_picture: reviewerProfilePic
           } : null;
           // console.log("[MAP DEBUG] Final reviewer object created:", JSON.stringify(finalReviewer, null, 2));
           const formattedReview = {
               review_id: reviewData.review_id,
               chat_id: reviewData.chat_id,
               overall_rating: reviewData.overall_rating,
               specific_answers: reviewData.specific_answers,
               created_at: reviewData.created_at, // This relies on Review model having underscored: true
               reviewer: finalReviewer
           };
           //  console.log("[MAP DEBUG] Final formatted review object:", JSON.stringify(formattedReview, null, 2));
            return formattedReview;
       });

       console.log("[getReviewsForUser] Sending formatted reviews to frontend.");
       res.status(200).json({ reviews: formattedReviews });

  } catch (error: any) {
       console.error(`Error fetching reviews for user ${req.params.userId}:`, error);
       res.status(500).json({ message: 'Failed to fetch reviews.', error: error.message });
  }
};