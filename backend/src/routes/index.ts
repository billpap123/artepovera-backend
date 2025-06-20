// src/routes/index.ts
import { Router } from 'express';
// REMOVED: import fs from 'fs'; // No longer needed
import { Server } from 'socket.io'; // <-- Add this import

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
import * as artistSupportController from '../controllers/artistSupportController';
import * as artistCommentController from '../controllers/artistCommentController'; // <<< ADD THIS
import { isAdmin } from '../middleware/adminMiddleware';
import * as adminController from '../controllers/adminController';
import { getAllCategories } from '../controllers/category.controller';

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
import { 
  createArtistComment, 
  getCommentsForUserProfile, 
  checkExistingComment,
  getAverageSupportRating // <-- ADD THIS IMPORT
} from '../controllers/artistCommentController';

// ***** REMOVED: Ensure the "uploads" folder exists *****

export default (io: Server, onlineUsers: Map<number, string>) => {
  const router = Router();

  router.use((req, _res, next) => {
    (req as any).io = io;                 // ✨ το είχες
    (req as any).onlineUsers = onlineUsers; // ✨ αυτό λείπει
    next();
  });





// This creates the endpoint: GET /api/categories/
router.get('/', getAllCategories);

router.get(
  '/artists/my-applications', // Endpoint for the logged-in artist to get their applications
  authenticate,
  artistController.getMyArtistApplications // Points to the new function in artistController
);
// --- Notification routes ---
router.get('/notifications/:userId', authenticate, getNotifications);
router.put('/notifications/:notificationId', authenticate, markNotificationAsRead);
router.put('/notifications/:userId/all-read', authenticate, markAllNotificationsAsRead);
router.delete('/notifications/:notificationId', authenticate, deleteNotification);
router.delete('/notifications/:userId/all', authenticate, deleteAllNotifications);

// Route to toggle support for a user (profile user ID in params)
// Applying to /api/users/:userId/support where :userId is the one being supported
router.post(
  '/users/:userId/support',
  authenticate, // Ensures user is logged in
  artistSupportController.toggleSupport
);
router.get(
  '/users/:userId/average-support',
  getAverageSupportRating
);



// Route to get support status and count for a user (profile user ID in params)
// Applying to /api/users/:userId/support-status
router.get(
  '/users/:userId/support-status',
  authenticate, // Make authenticate optional if you want non-logged-in users to see count
                 // If authenticate is kept, req.user will be null for non-logged-in, handled by controller
  artistSupportController.getSupportStatusAndCount
);
// If you want GET /support-status to be public (not requiring login to see counts),
// you might make a version of 'authenticate' that sets req.user but doesn't reject if no token,
// or simply remove 'authenticate' and let the controller handle req.user being potentially undefined.
// For simplicity, I've kept 'authenticate', assuming the controller handles optional req.user for GET.

// --- User routes ---
router.post('/users/register', userController.createUser);
router.post('/users/login', userController.loginUser);
router.get('/users/me', authenticate, userController.getCurrentUser);
router.put('/users/:id', authenticate, userController.updateUser); // Note: Check authorization in controller if allowing update by ID param
router.post("/users/get-names", userController.getUserNames);
router.get('/users/profile/:userId', authenticate, userController.getUserProfile);
router.post('/users/:userId/like', authenticate, userController.toggleLike);
router.get('/users/:userId/like', authenticate, userController.checkLike);
// --- NEW ACCOUNT MANAGEMENT ROUTES (Now correctly grouped) ---
router.put('/users/update-email', authenticate, userController.updateUserEmail);
router.put('/users/update-password', authenticate, userController.updateUserPassword);
router.delete('/users/me', authenticate, userController.deleteOwnAccount);

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






// Creates a chat between the logged-in user and a receiver
router.post(
  '/chats', 
  authenticate, 
  chatController.createChat
);

// Sends a message to a specific chat
router.post(
  '/chats/send', 
  authenticate, 
  chatController.sendMessage
);

// Gets all messages for a specific chat
router.get(
  '/chats/:chat_id/messages', 
  authenticate, 
  chatController.getChatHistory
);
// Route to get all applications for the logged-in user
router.get('/my-applications', authenticate, jobPostingController.getMyApplications);

// Gets all of the logged-in user's chats
router.get(
  '/chats/my-chats', // A new, cleaner route path
  authenticate, 
  chatController.fetchUserChats // Use the new function name
);
router.get(
  '/job-postings/my', // A dedicated, secure route
  authenticate,       // Ensures user is logged in
  jobPostingController.getMyJobPostings
);


router.post('/reviews', authenticate, reviewController.submitReview);
// --- ADD THESE ROUTES ---
router.get('/users/:userId/average-rating', reviewController.getAverageRatingForUser); // Publicly viewable? Add authenticate if needed
router.get('/users/:userId/reviews', reviewController.getReviewsForUser); // Publicly viewable? Add authenticate if needed

// --- Location routes ---
router.get('/locations', getLocations); // Public maybe? Or add authenticate

// --- ARTIST PROFILE COMMENTS / VIEWPOINTS ROUTES ---
router.get(
  '/users/:userId/comments', // userId is the ID of the profile whose comments are being fetched
  artistCommentController.getCommentsForUserProfile
);

router.post(
  '/users/:userId/comments', // userId is the ID of the profile being commented on
  authenticate, // Ensures the commenter is logged in
  artistCommentController.createArtistComment

);

// --- ADD THIS NEW ROUTE FOR CHECKING ---
router.get(
  '/users/:userId/comments/check', // A clear path for checking status
  authenticate, // User must be logged in to check if *they* have commented
  artistCommentController.checkExistingComment
);
// --- END ARTIST PROFILE COMMENTS ROUTES ---

// --- ADD THIS NEW ROUTE ---
router.get(
  '/reviews/check', // Matches the path your frontend is calling
  authenticate,     // Ensures user is logged in to check this status
  reviewController.checkExistingReview
);

// --- ADMIN ROUTES ---
router.get('/admin/stats', authenticate, isAdmin, adminController.getDashboardStats);
router.get('/admin/users', authenticate, isAdmin, adminController.getAllUsers);
router.get('/admin/users/:userId', authenticate, isAdmin, adminController.getUserById);
router.delete('/admin/users/:userId', authenticate, isAdmin, adminController.deleteUserByAdmin);
router.get('/admin/reviews', authenticate, isAdmin, adminController.getAllReviews);
router.get('/admin/comments', authenticate, isAdmin, adminController.getAllArtistComments);

router.delete('/admin/reviews/:reviewId', authenticate, isAdmin, adminController.deleteReviewByAdmin);
router.delete('/admin/comments/:commentId', authenticate, isAdmin, adminController.deleteArtistCommentByAdmin);


// Add these new routes for moderation
router.get('/admin/portfolios', authenticate, isAdmin, adminController.getAllPortfolioItems);
router.delete('/admin/portfolios/:portfolioId', authenticate, isAdmin, adminController.deletePortfolioItemByAdmin);

router.get('/admin/jobs', authenticate, isAdmin, adminController.getAllJobPostings);
router.delete('/admin/jobs/:jobId', authenticate, isAdmin, adminController.deleteJobPostingByAdmin);

router.post('/job-postings', authenticate, jobPostingController.createJobPosting);
router.get('/job-postings', authenticate, jobPostingController.getAllJobPostings);
router.get('/job-postings/my', authenticate, jobPostingController.getMyJobPostings); // For employers to see their own jobs
router.get('/job-postings/employer', authenticate, jobPostingController.getJobPostingsByEmployerId);
router.get('/job-postings/:job_id', authenticate, jobPostingController.getJobPostingById);
router.put('/job-postings/:job_id', authenticate, jobPostingController.updateJobPosting);
router.delete('/job-postings/:job_id', authenticate, jobPostingController.deleteJobPosting);
router.post('/job-postings/:jobId/apply', authenticate, jobPostingController.applyToJob); // Route for an artist to apply
return router;

};