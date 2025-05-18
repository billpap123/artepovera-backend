// jobPosting.controller.ts
import { Response, NextFunction } from 'express';
import { CustomRequest } from '../middleware/authMiddleware'; // ✅ Fixed Import
import JobPosting from '../models/JobPosting';
import User from '../models/User';
import Employer from '../models/Employer';
import Notification from '../models/Notification';
import JobApplication from '../models/JobApplication';
import { UniqueConstraintError, Sequelize } from 'sequelize'; // Keep Sequelize if needed for other fn()


export const createJobPosting = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: User not found' });
      return;
    }

    // Only Employers can create job postings
    if (req.user.user_type !== 'Employer') {
      res.status(403).json({ message: 'Forbidden: Only employers can post jobs' });
      return;
    }

    // Extract employer ID from authenticated user
    const employerId = req.user.id;
    // Extract new and existing fields from request body
    const {
      title,
      description,
      location,
      city,
      address,
      budget,
      difficulty,
      deadline,
      artistCategory, // front-end uses artistCategory
      insurance,
    } = req.body;

    // Ensure the employer exists
    const employer = await Employer.findOne({ where: { user_id: employerId } });
    if (!employer) {
      res.status(404).json({ message: 'Employer profile not found' });
      return;
    }

    // Create job posting with the new fields
    const jobPosting = await JobPosting.create({
      employer_id: employer.employer_id, // Use employer's actual ID
      title,
      description,
      location,
      city,
      address,
      budget,
      difficulty,
      deadline,
      artist_category: artistCategory, // mapping to model's field name
      insurance,
    });

    res.status(201).json({
      message: 'Job posted successfully!',
      jobPosting,
    });
  } catch (error) {
    console.error('Error creating job posting:', error);
    next(error);
  }
};

export const getAllJobPostings = async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
    const jobPostings = await JobPosting.findAll({
      attributes: [
        'job_id',
        'title',
        'description',
        'city',
        'address',
        'budget',
        'difficulty',
        'deadline',
        'artist_category',
        'insurance',
        'created_at',
      ],
      include: [
        {
          model: Employer,
          as: 'employer',
          include: [{ model: User, as: 'user', attributes: ['fullname'] }],
        },
      ],
    });

    res.status(200).json(
      jobPostings.map((job) => ({
        id: job.job_id,
        title: job.title,
        description: job.description,
        city: job.city,
        address: job.address,
        budget: job.budget,
        difficulty: job.difficulty,
        deadline: job.deadline,
        artistCategory: job.artist_category,
        insurance: job.insurance,
        created_at: job.created_at,
        employerName: job.employer?.user?.fullname || 'Unknown',
      }))
    );
  } catch (error) {
    console.error('Error fetching job postings:', error);
    next(error);
  }
};

/**
 * GET /api/job-postings/:job_id
 * Fetch a single job posting by ID
 */
export const getJobPostingById = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { job_id } = req.params;

    const jobPosting = await JobPosting.findByPk(job_id, {
      include: [
        {
          model: Employer,
          as: 'employer',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['fullname'],
            },
          ],
        },
      ],
    });

    if (!jobPosting) {
      res.status(404).json({ message: 'Job posting not found' });
      return;
    }

    res.json({
      id: jobPosting.job_id,
      title: jobPosting.title,
      description: jobPosting.description,
      city: jobPosting.city,
      address: jobPosting.address,
      budget: jobPosting.budget,
      difficulty: jobPosting.difficulty,
      deadline: jobPosting.deadline,
      artistCategory: jobPosting.artist_category,
      insurance: jobPosting.insurance,
      employerName: jobPosting.employer?.user?.fullname || 'Unknown',
      created_at: jobPosting.created_at,
    });
  } catch (error) {
    console.error('Error fetching job posting:', error);
    next(error);
  }
};

/**
 * PUT /api/job-postings/:job_id
 * Update a specific job posting
 */
export const updateJobPosting = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { job_id } = req.params;
    // Extract new and existing fields from request body
    const {
      title,
      description,
      location,
      city,
      address,
      budget,
      difficulty,
      deadline,
      artistCategory,
      insurance,
    } = req.body;

    const jobPosting = await JobPosting.findByPk(job_id);
    if (!jobPosting) {
      res.status(404).json({ message: 'Job posting not found' });
      return;
    }

    // Update fields if provided, otherwise keep current values
    jobPosting.title = title || jobPosting.title;
    jobPosting.description = description || jobPosting.description;
    jobPosting.location = location || jobPosting.location;
    jobPosting.city = city || jobPosting.city;
    jobPosting.address = address || jobPosting.address;
    jobPosting.budget = budget || jobPosting.budget;
    jobPosting.difficulty = difficulty || jobPosting.difficulty;
    jobPosting.deadline = deadline || jobPosting.deadline;
    jobPosting.artist_category = artistCategory || jobPosting.artist_category;
    jobPosting.insurance = insurance !== undefined ? insurance : jobPosting.insurance;

    await jobPosting.save();

    res.json(jobPosting);
  } catch (error) {
    console.error('Error updating job posting:', error);
    next(error);
  }
};

/**
 * DELETE /api/job-postings/:job_id
 * Delete a specific job posting
 */
export const deleteJobPosting = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { job_id } = req.params;
    const jobPosting = await JobPosting.findByPk(job_id);

    if (!jobPosting) {
      res.status(404).json({ message: 'Job posting not found' });
      return;
    }

    await jobPosting.destroy();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting job posting:', error);
    next(error);
  }
};

/**
 * GET /api/job-postings/employer?employer_id=XX
 * Fetch job postings for a specific employer
 */
export const getJobPostingsByEmployerId = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const employerId = parseInt(req.query.employer_id as string, 10);

    if (isNaN(employerId)) {
      res.status(400).json({ message: 'Valid employer ID is required' });
      return;
    }

    const jobPostings = await JobPosting.findAll({
      where: { employer_id: employerId },
      include: [
        {
          model: Employer,
          as: 'employer',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['fullname'],
            },
          ],
        },
      ],
    });

    res.json(jobPostings);
  } catch (error) {
    console.error('Error fetching job postings by employer ID:', error);
    next(error);
  }
};

// --- THIS IS THE FUNCTION TO UPDATE ---
export const applyToJob = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    const loggedInUserId = req.user?.id; // This is the User.user_id of the artist

    console.log("🔹 Received Apply Request for Job ID:", jobId, "by User ID:", loggedInUserId);

    if (isNaN(jobId)) {
      res.status(400).json({ message: 'Invalid job ID.' });
      return;
    }
    if (!loggedInUserId) {
      res.status(401).json({ message: 'Unauthorized: no user in token.' });
      return;
    }
    if (req.user?.user_type !== 'Artist') {
      res.status(403).json({ message: 'Only artists can apply to jobs.' });
      return;
    }

    // Fetch applying artist's user details (for name primarily)
    const artistUser = await User.findByPk(loggedInUserId);
    if (!artistUser) { // Should be redundant if req.user.id is from valid token
        res.status(404).json({ message: 'Applying artist user not found.' });
        return;
    }

    const jobPosting = await JobPosting.findByPk(jobId);
    if (!jobPosting) {
      console.log("🔴 Job not found for ID:", jobId);
      res.status(404).json({ message: 'Job not found.' });
      return;
    }

    // --- CHECK IF ALREADY APPLIED ---
    const existingApplication = await JobApplication.findOne({
      where: {
        job_id: jobId,
        artist_user_id: loggedInUserId // artist_user_id in JobApplication model stores User.user_id
      }
    });

    if (existingApplication) {
      console.log(`🔶 User ${loggedInUserId} already applied to job ${jobId}.`);
      res.status(409).json({ message: 'You have already applied to this job.' }); // 409 Conflict
      return;
    }
    // --- END CHECK ---

    console.log("✅ Job found. Fetching employer for notification...");
    const employerRecord = await Employer.findByPk(jobPosting.employer_id, {
        include: [{model: User, as: 'user', attributes: ['user_id', 'fullname']}] // Ensure 'user' alias is correct
    });
    if (!employerRecord || !employerRecord.user) {
      res.status(404).json({ message: 'Employer details not found for this job posting.' });
      return;
    }
    const employerUserIdForNotification = employerRecord.user.user_id; // User ID of employer
    const artistName = artistUser.fullname || "An Artist";

    // --- Create the Job Application Record ---
    const newApplication = await JobApplication.create({
        job_id: jobId,
        artist_user_id: loggedInUserId, // Storing User.user_id of the artist
        application_date: new Date(),
        // status will default to 'pending' as per model definition
    });
    console.log(`✅ Job application created with ID: ${newApplication.application_id}`);
    // --- End Create ---

// --- CORRECTED NOTIFICATION LINK ---
const frontendBaseUrl = process.env.FRONTEND_URL || 'https://artepovera2.vercel.app'; // Fallback to your live URL
const artistProfileLink = `${frontendBaseUrl}/user-profile/${loggedInUserId}`; // Use User ID of the artist

const notificationMessage = `${artistName} has applied for your job posting titled "${jobPosting.title}". <a href="${artistProfileLink}" target="_blank" rel="noopener noreferrer">View profile</a>`;
// --- END CORRECTION ---

await Notification.create({
  user_id: employerUserIdForNotification,
  sender_id: loggedInUserId,
  message: notificationMessage,
  // read_status defaults to false, created_at defaults to NOW
});
console.log("✅ Notification created for employer user ID:", employerUserIdForNotification);
    res.status(201).json({
      message: 'Application successful! The employer has been notified.',
      application: { // Send back some details of the created application
        application_id: newApplication.application_id,
        job_id: newApplication.job_id,
        artist_user_id: newApplication.artist_user_id,
        status: newApplication.status,
        application_date: newApplication.application_date
      }
    });
  } catch (error: any) {
    console.error('❌ Error applying to job:', error);
    // --- Check for Sequelize UniqueConstraintError for duplicate application attempts ---
    if (error instanceof UniqueConstraintError) { // Use the imported error type
        res.status(409).json({ message: 'You have already applied to this job (constraint error).' });
        return;
    }
    // --- END CHECK ---
    next(error); // Pass other errors to the global error handler
  }
};
