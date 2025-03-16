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
    const { title, description, location } = req.body;

    // Ensure the employer exists
    const employer = await Employer.findOne({ where: { user_id: employerId } });
    if (!employer) {
      res.status(404).json({ message: 'Employer profile not found' });
      return;
    }

    // Create job posting
    const jobPosting = await JobPosting.create({
      employer_id: employer.employer_id, // Use employer's actual ID
      title,
      description,
      location,
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
      attributes: ['job_id', 'title', 'description', 'created_at'],
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
      employerName: jobPosting.employer?.user?.fullname || 'Unknown',
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
    const { title, description, location } = req.body;

    const jobPosting = await JobPosting.findByPk(job_id);
    if (!jobPosting) {
      res.status(404).json({ message: 'Job posting not found' });
      return;
    }

    jobPosting.title = title || jobPosting.title;
    jobPosting.description = description || jobPosting.description;
    jobPosting.location = location || jobPosting.location;

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

    // 5) employer_id in JobPosting references the Employer table's PK
    const employerRecord = await Employer.findByPk(jobPosting.employer_id);
    if (!employerRecord) {
      res.status(404).json({ message: 'Employer not found for this job posting.' });
      return;
    }

    // 6) The actual user ID for the employer is in employerRecord.user_id
    const employerUserId = employerRecord.user_id;

    // 7) Build a date string (Greek locale or your preferred locale)
    const dateString = new Date().toLocaleString('el-GR');

    // 8) Build an HTML message for the notification
    //    Use an environment variable or fallback to localhost for development
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const artistProfileLink = `${baseUrl}/user-profile/${req.user.id}`;
    const message = `An artist has applied for your job posting (ID: ${jobId}). <a href="${artistProfileLink}" target="_blank">View Profile</a>`;

    // 9) Create a notification for the employer
    await Notification.create({
      user_id: employerUserId, // The employer's user ID
      sender_id: req.user.id,  // The artist's user ID
      message,                 // Use 'message', not 'messageHtml'
      read_status: false,
      created_at: new Date(),
    });

    console.log("✅ Notification created for employer user ID:", employerUserId);

    // 10) Return success response
    res.status(201).json({ message: 'Application successful, notification sent to employer.' });
  } catch (error) {
    console.error('❌ Error applying to job:', error);
    next(error);
  }
};
