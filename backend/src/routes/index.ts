// src/routes/index.ts
import { Router } from 'express';
// REMOVED: import fs from 'fs'; // No longer needed
// REMOVED: import path from 'path'; // No longer needed unless used elsewhere in routes
import * as userController from '../controllers/userController';
import * as artistController from '../controllers/artistController';
import * as employerController from '../controllers/employerController';
import * as jobPostingController from '../controllers/jobPostingController';
import * as chatController from '../controllers/chatController';
//import * as reviewController from '../controllers/reviewController'; // Keep commented if not used
import { authenticate } from '../middleware/authMiddleware';
// REMOVED: import { uploadProfilePicture } from '../controllers/artistController'; // Incorrect import
import * as portfolioController from '../controllers/portfolioController';
// REMOVED: import { upload } from '../controllers/portfolioController'; // Incorrect import
import { getLocations } from '../controllers/locationController';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
} from '../controllers/notificationController';
// Import the centrally configured upload instance from server.ts (adjust path if needed)
import { upload } from '../server'; // <<< ADD THIS IMPORT

// Import associations to initialize Sequelize relationships (keep if needed)
import '../models/associations';

// ***** REMOVED: Ensure the "uploads" folder exists *****
// const uploadsDir = ...
// if (!fs.existsSync...

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
router.put('/users/:id', authenticate, userController.updateUser); // Note: usually update /users/me instead of by ID
router.post("/users/get-names", userController.getUserNames);
router.get('/users/profile/:userId', authenticate, userController.getUserProfile);
router.post('/users/:userId/like', authenticate, userController.toggleLike);
router.get('/users/:userId/like', authenticate, userController.checkLike);

// --- Artist-specific routes (protected) ---
// Use upload.single with the correct field name ('profile_picture')
// Changed route path - assumes update is for the logged-in user based on token
router.post('/artists/profile', authenticate, upload.single('profile_picture'), artistController.updateArtistProfile);
// GET and DELETE might still use ID param if viewing/deleting *other* artists is allowed
router.get('/artists/:id', authenticate, artistController.getArtistById);
router.delete('/artists/:id', authenticate, artistController.deleteArtist);
router.get('/artists', authenticate, artistController.getArtistsWithLocation); // Route for getting artists with location


// --- Employer-specific routes (protected) ---
// Use upload.single with the correct field name ('profile_picture')
// Changed route path - assumes update is for the logged-in user based on token
router.post('/employers/profile', authenticate, upload.single('profile_picture'), employerController.updateEmployerProfile);
// GET and DELETE might still use ID param
router.get('/employers/:id', authenticate, employerController.getEmployerById);
router.delete('/employers/:id', authenticate, employerController.deleteEmployer);
router.get('/employers', authenticate, employerController.getEmployersWithLocation); // Route for getting employers with location


// --- Portfolio routes ---
// Use the imported 'upload' instance and correct field name 'image'
router.post('/portfolios', authenticate, upload.single('image'), portfolioController.createPortfolioItem);
router.get('/portfolios/me', authenticate, portfolioController.getMyPortfolio); // Get logged-in user's portfolio
router.get('/portfolios/:artistId', authenticate, portfolioController.getArtistPortfolio); // Get specific artist's portfolio
router.put('/portfolios/:id', authenticate, upload.single('image'), portfolioController.updatePortfolioItem); // Use imported upload
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


// --- Review routes ---
// Keep commented if not implemented
// router.post('/reviews', authenticate, reviewController.createReview);
// router.get('/reviews/chat/:chat_id', authenticate, reviewController.getReviewsByChatId);
// router.get('/reviews/chat/:chat_id/average', authenticate, reviewController.getAverageRatingByChatId);


// --- Location routes ---
router.get('/locations', getLocations); // Public maybe? Or add authenticate


export default router;