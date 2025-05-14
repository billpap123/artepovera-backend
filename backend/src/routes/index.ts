// src/routes/index.ts
import { Router } from 'express';
// REMOVED: import fs from 'fs'; // No longer needed
// REMOVED: import path from 'path'; // No longer needed unless used elsewhere in routes
import * as userController from '../controllers/userController';
import * as artistController from '../controllers/artistController'; // Ensure imported
import * as employerController from '../controllers/employerController'; // Ensure imported
import * as jobPostingController from '../controllers/jobPostingController';
import * as chatController from '../controllers/chatController';
//import * as reviewController from '../controllers/reviewController'; // Keep commented if not used
import { authenticate } from '../middleware/authMiddleware';
// REMOVED: import { uploadProfilePicture } from '../controllers/artistController'; // Correctly removed
import * as portfolioController from '../controllers/portfolioController';
// REMOVED: import { upload } from '../controllers/portfolioController'; // Correctly removed
import * as reviewController from '../controllers/reviewController';

import { getLocations } from '../controllers/locationController';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
} from '../controllers/notificationController';
// Import the centrally configured upload instance from middleware
import { upload } from '../middleware/multerConfig'; // Correct import path
// Import associations to initialize Sequelize relationships (keep if needed)
import '../models/associations';

// ***** REMOVED: Ensure the "uploads" folder exists *****

const router = Router();

// --- Notification routes ---
router.get('/notifications/:userId', authenticate, getNotifications);
router.put('/notifications/:notificationId', authenticate, markNotificationAsRead);
router.put('/notifications/:userId/all-read', authenticate, markAllNotificationsAsRead);
router.delete('/notifications/:notificationId', authenticate, deleteNotification);
router.delete('/notifications/:userId/all', authenticate, deleteAllNotifications);

// --- User routes ---
router.post('/users/register', userController.createUser);
router.post('/users/login', userController.loginUser);
router.get('/users/me', authenticate, userController.getCurrentUser);
router.put('/users/:id', authenticate, userController.updateUser); // Note: Check authorization in controller if allowing update by ID param
router.post("/users/get-names", userController.getUserNames);
router.get('/users/profile/:userId', authenticate, userController.getUserProfile);
router.post('/users/:userId/like', authenticate, userController.toggleLike);
router.get('/users/:userId/like', authenticate, userController.checkLike);

// --- Artist-specific routes (protected) ---
router.post('/artists/profile', authenticate, upload.single('profile_picture'), artistController.updateArtistProfile);
router.get('/artists/:id', authenticate, artistController.getArtistById);
router.delete('/artists/:id', authenticate, artistController.deleteArtist); // Deletes whole artist profile
router.get('/artists', authenticate, artistController.getArtistsWithLocation);
// --- CORRECTED PATH for deleting artist picture ---
router.delete('/artists/profile/picture', authenticate, artistController.deleteArtistProfilePicture);
// --- END CORRECTION ---
// --- ADD NEW CV ROUTES FOR ARTIST PROFILE ---
router.post(
  '/artists/profile/cv',
  authenticate,
  upload.single('cv'), // Middleware to handle 'cv' file field from FormData
  artistController.uploadOrUpdateArtistCv
);

router.delete(
  '/artists/profile/cv',
  authenticate,
  artistController.deleteArtistCv
);
// --- END NEW CV ROUTES ---

// --- Employer-specific routes (protected) ---
router.post('/employers/profile', authenticate, upload.single('profile_picture'), employerController.updateEmployerProfile);
router.get('/employers/:id', authenticate, employerController.getEmployerById);
router.delete('/employers/:id', authenticate, employerController.deleteEmployer); // Deletes whole employer profile
router.get('/employers', authenticate, employerController.getEmployersWithLocation);
// --- ADDED Route for deleting employer picture ---
router.delete('/employers/profile/picture', authenticate, employerController.deleteEmployerProfilePicture);
// --- END ADD ---


// --- Portfolio routes ---
router.post('/portfolios', authenticate, upload.single('image'), portfolioController.createPortfolioItem);
router.get('/portfolios/me', authenticate, portfolioController.getMyPortfolio);
router.get('/portfolios/:artistId', authenticate, portfolioController.getArtistPortfolio);
router.put('/portfolios/:id', authenticate, upload.single('image'), portfolioController.updatePortfolioItem);
router.delete('/portfolios/:id', authenticate, portfolioController.deletePortfolioItem);


// --- Job Posting routes ---
router.post('/job-postings', authenticate, jobPostingController.createJobPosting);
router.get('/job-postings/employer', authenticate, jobPostingController.getJobPostingsByEmployerId);
router.get('/job-postings/:job_id', authenticate, jobPostingController.getJobPostingById);
router.put('/job-postings/:job_id', authenticate, jobPostingController.updateJobPosting);
router.delete('/job-postings/:job_id', authenticate, jobPostingController.deleteJobPosting);
router.get('/job-postings', authenticate, jobPostingController.getAllJobPostings);
router.post('/jobs/:jobId/apply', authenticate, jobPostingController.applyToJob);


// --- Chat routes ---
router.post('/chats', authenticate, chatController.createChat);
router.post('/chats/send', authenticate, chatController.sendMessage);
router.get('/chats/:chat_id/messages', authenticate, chatController.getChatHistory);
router.get('/chats/user/:user_id', authenticate, chatController.fetchMessages);
router.get('/chats/:chat_id/rating-status', authenticate, chatController.getRatingPromptStatus);
router.put('/chats/:chat_id/rating-status', authenticate, chatController.updateRatingPromptStatus);


router.post('/reviews', authenticate, reviewController.submitReview);
// --- ADD THESE ROUTES ---
router.get('/users/:userId/average-rating', reviewController.getAverageRatingForUser); // Publicly viewable? Add authenticate if needed
router.get('/users/:userId/reviews', reviewController.getReviewsForUser); // Publicly viewable? Add authenticate if needed

// --- Location routes ---
router.get('/locations', getLocations); // Public maybe? Or add authenticate


export default router;