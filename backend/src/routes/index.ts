import { Router } from 'express';
import * as userController from '../controllers/userController';
import * as artistController from '../controllers/artistController';
import * as employerController from '../controllers/employerController';
import * as jobPostingController from '../controllers/jobPostingController';
import * as chatController from '../controllers/chatController';
//import * as reviewController from '../controllers/reviewController';
import { authenticate } from '../middleware/authMiddleware';
import { uploadProfilePicture } from '../controllers/artistController';
import * as portfolioController from '../controllers/portfolioController';
import { upload } from '../controllers/portfolioController';
import { getLocations } from '../controllers/locationController';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
} from '../controllers/notificationController';
// Import associations to initialize Sequelize relationships
import '../models/associations';

const router = Router();
// Notification routes// Notification routes
router.get('/notifications/:userId', authenticate, getNotifications);
router.put('/notifications/:notificationId', authenticate, markNotificationAsRead);
router.put('/notifications/:userId/all-read', authenticate, markAllNotificationsAsRead);
router.delete('/notifications/:notificationId', authenticate, deleteNotification);
router.delete('/notifications/:userId/all', authenticate, deleteAllNotifications);


// User routes
router.post('/users/register', userController.createUser);
router.post('/users/login', userController.loginUser);
router.get('/users/me', authenticate, userController.getCurrentUser);
router.put('/users/:id', authenticate, userController.updateUser);
router.post("/users/get-names", userController.getUserNames);


// Get User Profile by ID
router.get('/users/profile/:userId', authenticate, userController.getUserProfile);
router.post('/users/:userId/like', authenticate, userController.toggleLike);
router.get('/users/:userId/like', authenticate, userController.checkLike);

// Artist-specific routes (protected)
router.post('/artists/profile/:id', authenticate, uploadProfilePicture, artistController.updateArtistProfile);
router.get('/artists/:id', authenticate, artistController.getArtistById);
router.delete('/artists/:id', authenticate, artistController.deleteArtist);

// Employer-specific routes (protected)
router.post('/employers/profile/:id', authenticate, uploadProfilePicture, employerController.updateEmployerProfile);
router.get('/employers/:id', authenticate, employerController.getEmployerById);
router.delete('/employers/:id', authenticate, employerController.deleteEmployer);

// Portfolio routes
router.post('/portfolios', authenticate, upload.single('image'), portfolioController.createPortfolioItem);
router.get('/portfolios/:artistId', authenticate, portfolioController.getArtistPortfolio);
router.put('/portfolios/:id', authenticate, upload.single('image'), portfolioController.updatePortfolioItem);
router.delete('/portfolios/:id', authenticate, portfolioController.deletePortfolioItem);

/* --------------------------------
 * JOB POSTING ROUTES
 * -------------------------------- */
// Create a job posting
router.post('/job-postings', authenticate, jobPostingController.createJobPosting);
router.get('/job-postings/employer', authenticate, jobPostingController.getJobPostingsByEmployerId);

// Fetch a single job posting by job_id
router.get('/job-postings/:job_id', authenticate, jobPostingController.getJobPostingById);

// Update a job posting
router.put('/job-postings/:job_id', authenticate, jobPostingController.updateJobPosting);

// Delete a job posting
router.delete('/job-postings/:job_id', authenticate, jobPostingController.deleteJobPosting);

// Fetch all job postings
router.get('/job-postings', authenticate, jobPostingController.getAllJobPostings);

// Fetch job postings by employer ID (?employer_id=xxx)

router.post('/jobs/:jobId/apply', authenticate, jobPostingController.applyToJob);
// Chat routes
router.post('/chats', authenticate, chatController.createChat); // Create chat after mutual likes
router.post('/chats/send', authenticate, chatController.sendMessage); // Send message
router.get('/chats/:chat_id/messages', authenticate, chatController.getChatHistory); // Get chat history by chat ID
router.get('/chats/user/:user_id', authenticate, chatController.fetchMessages); // Fetch recent messages for a user

// Review routes
//router.post('/reviews', authenticate, reviewController.createReview);
//router.get('/reviews/chat/:chat_id', authenticate, reviewController.getReviewsByChatId);
//router.get('/reviews/chat/:chat_id/average', authenticate, reviewController.getAverageRatingByChatId);

// Location routes for artists and employers
router.get('/artists', authenticate, artistController.getArtistsWithLocation);
router.get('/employers', authenticate, employerController.getEmployersWithLocation);
router.get('/locations', getLocations);

export default router;
