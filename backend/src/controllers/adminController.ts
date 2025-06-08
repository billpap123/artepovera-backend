// src/controllers/adminController.ts
import { Request, Response } from 'express';
import { Op } from 'sequelize';
import User from '../models/User';
import Artist from '../models/Artist';
import Employer from '../models/Employer';
import JobPosting from '../models/JobPosting';
import Review from '../models/Review';
import ArtistComment from '../models/ArtistComment';
import Portfolio from '../models/Portfolio';
/*
|--------------------------------------------------------------------------
| Dashboard Stats
|--------------------------------------------------------------------------
*/

/**
 * @description Admin: Gets dashboard statistics (total users, artists, employers, jobs).
 * @route GET /api/admin/stats
 */
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const totalUsers = await User.count();
        const totalArtists = await User.count({ where: { user_type: 'Artist' } });
        const totalEmployers = await User.count({ where: { user_type: 'Employer' } });
        const totalJobs = await JobPosting.count();

        res.status(200).json({
            totalUsers,
            totalArtists,
            totalEmployers,
            totalJobs,
        });
    } catch (error: any) {
        console.error("Admin Error: Failed to fetch dashboard stats.", error);
        res.status(500).json({ message: "Failed to fetch dashboard stats." });
    }
};


/*
|--------------------------------------------------------------------------
| User Management
|--------------------------------------------------------------------------
*/

/**
 * @description Admin: Fetches a list of all users.
 * @route GET /api/admin/users
 */
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const users = await User.findAll({
            attributes: ['user_id', 'fullname', 'email', 'user_type'],
            order: [['user_id', 'ASC']],
        });
        res.status(200).json(users);
    } catch (error: any) {
        console.error("Admin Error: Failed to fetch all users.", error);
        res.status(500).json({ message: "Failed to fetch users." });
    }
};

/**
 * @description Admin: Fetches full details for a single user, including their specific profile.
 * @route GET /api/admin/users/:userId
 */
export const getUserById = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = parseInt(req.params.userId, 10);
        if (isNaN(userId)) {
            res.status(400).json({ message: "Invalid user ID." });
            return;
        }

        const user = await User.findByPk(userId, {
            include: [
                { model: Artist, as: 'artistProfile' },
                { model: Employer, as: 'employerProfile' }
            ]
        });

        if (!user) {
            res.status(404).json({ message: "User not found." });
            return;
        }

        res.status(200).json(user);
    } catch (error: any) {
        console.error(`Admin Error: Failed to fetch user ${req.params.userId}.`, error);
        res.status(500).json({ message: "Failed to fetch user details." });
    }
};

/**
 * @description Admin: Deletes a user and all their associated data (due to CASCADE constraints).
 * @route DELETE /api/admin/users/:userId
 */
export const deleteUserByAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
        const userIdToDelete = parseInt(req.params.userId, 10);
        const user = await User.findByPk(userIdToDelete);

        if (!user) {
            res.status(404).json({ message: "User not found." });
            return;
        }
        
        // Ensure an admin cannot delete another admin as a safeguard
        if (user.user_type === 'Admin') {
            res.status(403).json({ message: "Forbidden: Administrators cannot be deleted." });
            return;
        }

        await user.destroy();
        res.status(200).json({ message: `User '${user.fullname}' (ID: ${userIdToDelete}) has been deleted.` });

    } catch (error: any) {
        console.error(`Admin Error: Failed to delete user ${req.params.userId}.`, error);
        res.status(500).json({ message: "Failed to delete user." });
    }
};


/*
|--------------------------------------------------------------------------
| Content Moderation (Reviews, Comments, etc.)
|--------------------------------------------------------------------------
*/

/**
 * @description Admin: Deletes a specific review by its ID.
 * @route DELETE /api/admin/reviews/:reviewId
 */
export const deleteReviewByAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
        const reviewId = parseInt(req.params.reviewId, 10);
        const review = await Review.findByPk(reviewId);

        if (!review) {
            res.status(404).json({ message: "Review not found." });
            return;
        }

        await review.destroy();
        res.status(200).json({ message: `Review with ID ${reviewId} has been deleted.` });
    } catch (error: any) {
        console.error(`Admin Error: Failed to delete review ${req.params.reviewId}.`, error);
        res.status(500).json({ message: "Failed to delete review." });
    }
};

/**
 * @description Admin: Deletes a specific artist comment by its ID.
 * @route DELETE /api/admin/comments/:commentId
 */
export const deleteArtistCommentByAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
        const commentId = parseInt(req.params.commentId, 10);
        const comment = await ArtistComment.findByPk(commentId);

        if (!comment) {
            res.status(404).json({ message: "Comment not found." });
            return;
        }

        await comment.destroy();
        res.status(200).json({ message: `Artist comment with ID ${commentId} has been deleted.` });
    } catch (error: any) {
        console.error(`Admin Error: Failed to delete artist comment ${req.params.commentId}.`, error);
        res.status(500).json({ message: "Failed to delete artist comment." });
    }
};

export const getAllReviews = async (req: Request, res: Response): Promise<void> => {
    try {
        const reviews = await Review.findAll({
            include: [
                { model: User, as: 'reviewer', attributes: ['user_id', 'fullname'] },
                { model: User, as: 'reviewed', attributes: ['user_id', 'fullname'] } // Corrected alias from previous files
            ],
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json(reviews);
    } catch (error: any) {
        console.error("Admin Error: Failed to fetch all reviews.", error);
        res.status(500).json({ message: "Failed to fetch reviews." });
    }
};

/**
 * @description Admin: Fetches ALL artist comments in the system for moderation.
 * @route GET /api/admin/comments
 */
export const getAllArtistComments = async (req: Request, res: Response): Promise<void> => {
    try {
        const comments = await ArtistComment.findAll({
            include: [
                { model: User, as: 'commenterArtist', attributes: ['user_id', 'fullname'] },
                { model: User, as: 'commentedProfileUser', attributes: ['user_id', 'fullname'] }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json(comments);
    } catch (error: any) {
        console.error("Admin Error: Failed to fetch all artist comments.", error);
        res.status(500).json({ message: "Failed to fetch artist comments." });
    }
};


/**
 * @description Admin: Fetches ALL portfolio items.
 * @route GET /api/admin/portfolios
 */
export const getAllPortfolioItems = async (req: Request, res: Response): Promise<void> => {
    try {
        const items = await Portfolio.findAll({
            include: [{
                model: Artist,
                as: 'artist',
                attributes: ['artist_id'],
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['user_id', 'fullname']
                }]
            }],
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json(items);
    } catch (error: any) {
        console.error("Admin Error: Failed to fetch portfolio items.", error);
        res.status(500).json({ message: "Failed to fetch portfolio items." });
    }
};

/**
 * @description Admin: Deletes a specific portfolio item by its ID.
 * @route DELETE /api/admin/portfolios/:portfolioId
 */
export const deletePortfolioItemByAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
        const portfolioId = parseInt(req.params.portfolioId, 10);
        const item = await Portfolio.findByPk(portfolioId);
        if (!item) {
            res.status(404).json({ message: "Portfolio item not found." });
            return;
        }
        await item.destroy(); // This should also handle deleting the image from Cloudinary if you've set up hooks
        res.status(200).json({ message: `Portfolio item ID ${portfolioId} has been deleted.` });
    } catch (error: any) {
        console.error(`Admin Error: Failed to delete portfolio item ${req.params.portfolioId}.`, error);
        res.status(500).json({ message: "Failed to delete portfolio item." });
    }
};

/**
 * @description Admin: Fetches ALL job postings.
 * @route GET /api/admin/jobs
 */
export const getAllJobPostingsByAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
        const jobs = await JobPosting.findAll({
            include: [{
                model: Employer,
                as: 'employer',
                attributes: ['employer_id'],
                include: [{
                    model: User,
                    as: 'user',
                    attributes: ['user_id', 'fullname']
                }]
            }],
            order: [['createdAt', 'DESC']]
        });
        res.status(200).json(jobs);
    } catch (error: any) {
        console.error("Admin Error: Failed to fetch job postings.", error);
        res.status(500).json({ message: "Failed to fetch job postings." });
    }
};

/**
 * @description Admin: Deletes a specific job posting by its ID.
 * @route DELETE /api/admin/jobs/:jobId
 */
export const deleteJobPostingByAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
        const jobId = parseInt(req.params.jobId, 10);
        const job = await JobPosting.findByPk(jobId);
        if (!job) {
            res.status(404).json({ message: "Job posting not found." });
            return;
        }
        await job.destroy();
        res.status(200).json({ message: `Job posting ID ${jobId} has been deleted.` });
    } catch (error: any) {
        console.error(`Admin Error: Failed to delete job posting ${req.params.jobId}.`, error);
        res.status(500).json({ message: "Failed to delete job posting." });
    }
};
