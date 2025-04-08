// jobPosting.controller.ts
import { Response, NextFunction } from 'express';
import { CustomRequest } from '../middleware/authMiddleware'; // ✅ Fixed Import
import JobPosting from '../models/JobPosting';
import User from '../models/User';
import Employer from '../models/Employer';
import Notification from '../models/Notification';

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
export const applyToJob = async (
  req: CustomRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    console.log("🔹 Received Apply Request for Job ID:", req.params.jobId);
    console.log("🔹 User Details:", req.user);

    // 1) Parse job ID
    const jobId = parseInt(req.params.jobId, 10);
    if (isNaN(jobId)) {
      res.status(400).json({ message: 'Invalid job ID.' });
      return;
    }

    // 2) Ensure user is logged in
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: no user in token.' });
      return;
    }

    // 3) Ensure user is an Artist
    if (req.user.user_type !== 'Artist') {
      res.status(403).json({ message: 'Only artists can apply to jobs.' });
      return;
    }

    // 4) Find the job posting
    const jobPosting = await JobPosting.findByPk(jobId);
    if (!jobPosting) {
      console.log("🔴 Job not found for ID:", jobId);
      res.status(404).json({ message: 'Job not found.' });
      return;
    }

    console.log("✅ Job found. Fetching employer...");

    // 5) Get the employer
    const employerRecord = await Employer.findByPk(jobPosting.employer_id);
    if (!employerRecord) {
      res.status(404).json({ message: 'Employer not found for this job posting.' });
      return;
    }
    const employerUserId = employerRecord.user_id;

    // 6) Fetch the artist's user record for fullname
    const artistRecord = await User.findByPk(req.user.id);
    // Fallback to "Artist" if something's missing
    const artistName = artistRecord?.fullname || "An Artist";

    // 7) Build your notification link
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const artistProfileLink = `${baseUrl}/user-profile/${req.user.id}`;

    // 8) Build the message including the artist's full name
    const message = `${artistName} has applied for your job posting (ID: ${jobId}). <a href="${artistProfileLink}" target="_blank">View Profile</a>`;

    // 9) Create the notification
    await Notification.create({
      user_id: employerUserId,
      sender_id: req.user.id, 
      message,
      read_status: false,
      created_at: new Date(),
    });

    console.log("✅ Notification created for employer user ID:", employerUserId);

    res.status(201).json({
      message: 'Application successful, notification sent to employer.',
      artist: {
        id: req.user.id,
        name: artistName,
      },
    });
  } catch (error) {
    console.error('❌ Error applying to job:', error);
    next(error);
  }
};
