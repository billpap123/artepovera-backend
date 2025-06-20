// src/controllers/jobPosting.controller.ts
import { Response, NextFunction } from 'express';
import { CustomRequest } from '../middleware/authMiddleware';
import JobPosting from '../models/JobPosting';
import User from '../models/User';
import Employer from '../models/Employer';
import Notification from '../models/Notification';
import JobApplication from '../models/JobApplication';
import { UniqueConstraintError, Sequelize } from 'sequelize'; // The main Sequelize object
import Category from '../models/Category'; // <-- 1. IMPORT THE NEW CATEGORY MODEL
import { pushNotification } from '../utils/socketHelpers';          // ⭐



/**
 * @description Fetches all job applications submitted by the currently logged-in artist.
 * @route GET /api/my-applications
 */
export const getMyApplications = async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
  // 1. Ensure a user is logged in and is an 'Artist'
  const loggedInUserId = req.user?.id;
  const userType = req.user?.user_type;

  if (!loggedInUserId) {
      res.status(401).json({ message: "Unauthorized. Please log in." });
      return;
  }

  if (userType !== 'Artist') {
      res.status(403).json({ message: "Forbidden. Only artists can view their applications." });
      return;
  }

  try {
      // 2. Fetch all applications for the logged-in user
      const applications = await JobApplication.findAll({
          where: { artist_user_id: loggedInUserId },
          include: [
              {
                  model: JobPosting,
                  as: 'jobPostingDetails', // This is correct
                  include: [
                      {
                          model: Employer,
                          as: 'employer',
                          attributes: ['profile_picture'],
                          include: [{
                              model: User,
                              as: 'user',
                              attributes: ['fullname']
                          }]
                      }
                  ]
              }
          ],
          order: [['application_date', 'DESC']]
      });

      if (!applications || applications.length === 0) {
          res.status(200).json([]);
          return;
      }
      
      const reshapedApplications = applications.map(app => {
        const appJSON = app.toJSON();

        // --- THIS IS THE FIX for the TypeScript error ---
        // We cast appJSON to `any` to tell TypeScript we know 'jobPostingDetails' exists
        // on this object at runtime, even if it's not in the base model interface.
        return {
          ...appJSON,
          jobPosting: (appJSON as any).jobPostingDetails, // <-- Corrected Line
          jobPostingDetails: undefined, 
        };
        // --- END OF FIX ---
      });
      
      res.status(200).json(reshapedApplications);

  } catch (error) {
      console.error('Error fetching user applications:', error);
      next(error);
  }
};
export const getMyJobPostings = async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
      const loggedInUserId = req.user?.id;
      const loggedInUserType = req.user?.user_type;

      // Authorization: Ensure the user is a logged-in employer
      if (!loggedInUserId || loggedInUserType !== 'Employer') {
          res.status(403).json({ message: "Forbidden: You must be an employer to view this page." });
          return;
      }

      // Find the employer profile linked to the user ID
      const employer = await Employer.findOne({ where: { user_id: loggedInUserId } });
      if (!employer) {
          res.status(404).json({ message: "Employer profile not found." });
          return;
      }

      // Fetch all jobs associated with that employer_id
      const jobPostings = await JobPosting.findAll({
          where: { employer_id: employer.employer_id },
          order: [['created_at', 'DESC']] // Show the most recent jobs first
      });

      res.status(200).json(jobPostings);

  } catch (error) {
      console.error("Error fetching employer's job postings:", error);
      next(error); // Pass error to your global handler
  }
};

/**
 * @description Creates a new, detailed job posting based on the new schema.
 * @route POST /api/job-postings
 */
export const createJobPosting = async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
  const loggedInUserId = req.user?.id;
  if (!loggedInUserId || req.user?.user_type !== 'Employer') {
      res.status(403).json({ message: "Forbidden: Only employers can post jobs." });
      return;
  }

  try {
      const employer = await Employer.findOne({ where: { user_id: loggedInUserId } });
      if (!employer) {
          res.status(404).json({ message: "Employer profile not found." });
          return;
      }

      const {
          title, category, description, location, presence,
          start_date, end_date, application_deadline,
          payment_total, payment_is_monthly, payment_monthly_amount, number_of_months,
          insurance, desired_keywords, requirements
      } = req.body;

      if (!title || !category || !presence) {
          res.status(400).json({ message: "Title, Category, and Presence are required." });
          return;
      }

      const [categoryRecord] = await Category.findOrCreate({
          where: { name: category.trim() },
          defaults: { name: category.trim() },
      });

      let finalTotalPayment = 0;
      if (payment_is_monthly) {
        if (!payment_monthly_amount || !number_of_months || payment_monthly_amount <= 0 || number_of_months <= 0) {
          res.status(400).json({ message: "Monthly wage and number of months are required for monthly payment."});
          return;
        }
        finalTotalPayment = payment_monthly_amount * number_of_months;
      } else {
        if (!payment_total || payment_total <= 0) {
          res.status(400).json({ message: "A valid total payment is required."});
          return;
        }
        finalTotalPayment = payment_total;
      }

      const newJobPosting = await JobPosting.create({
          employer_id: employer.employer_id,
          title,
          category: categoryRecord.name,
          description, location, presence,
          start_date: start_date || null,
          end_date: end_date || null,
          application_deadline: application_deadline || null,
          payment_total: finalTotalPayment,
          payment_is_monthly: !!payment_is_monthly,
          payment_monthly_amount: payment_is_monthly ? payment_monthly_amount : null,
          number_of_months: payment_is_monthly ? number_of_months : null,
          insurance: insurance !== undefined ? insurance : null,
          desired_keywords,
          requirements,
      });

      res.status(201).json({ message: "Job posting created successfully!", jobPosting: newJobPosting });

  } catch (error) {
      console.error('Error creating job posting:', error);
      next(error);
  }
};


export const getAllJobPostings = async (req: CustomRequest, res: Response, next: NextFunction) => {
  try {
      const jobPostings = await JobPosting.findAll({
          include: [
              {
                  model: Employer,
                  as: 'employer',
                  attributes: ['employer_id', 'user_id', 'profile_picture'],
                  include: [{
                      model: User,
                      as: 'user',
                      attributes: ['user_id', 'fullname']
                  }],
              },
          ],
          // --- THIS IS THE CORRECTED ORDER CLAUSE ---
          // Use the actual database column name (snake_case)
          order: [[Sequelize.col('JobPosting.created_at'), 'DESC']]
      });
      
      res.status(200).json(jobPostings);
  } catch (error) {
      console.error('Error fetching job postings:', error);
      next(error);
  }
};




/**
* @description Fetch a single job posting by ID with the new detailed structure.
* @route GET /api/job-postings/:job_id
*/
// src/controllers/jobPosting.controller.ts

export const getJobPostingById = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { job_id } = req.params;

    // --- STEP 1: Use a simpler, stable query ---
    // We will fetch the profile_picture from the Employer model directly,
    // which avoids the nested query problem.
    const jobPosting = await JobPosting.findByPk(job_id, {
      include: [
        {
          model: Employer,
          as: 'employer',
          attributes: ['employer_id', 'user_id', 'profile_picture'], // Get picture from Employer
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['user_id', 'fullname'], // Get user details, but not the picture here
            },
          ],
        },
      ],
    });

    if (!jobPosting) {
      res.status(404).json({ message: 'Job posting not found' });
      return;
    }

    // --- STEP 2: Reshape the data to match the frontend's expectation ---
    // Convert the Sequelize instance to a plain JavaScript object
    const jobData = jobPosting.toJSON();

    // If the employer and user exist, manually move the profile picture
    // so the final object has the shape: job.employer.user.profile_picture
    if (jobData.employer && jobData.employer.user) {
      // Use 'as any' to bypass TypeScript's strict check for this one assignment
      (jobData.employer.user as any).profile_picture = jobData.employer.profile_picture;
    }
    
    // --- STEP 3: Send the correctly shaped data to the frontend ---
    res.json(jobData);

  } catch (error) {
    console.error('Error fetching job posting:', error);
    next(error);
  }
};


// --- Your other functions (update, delete, applyToJob, etc.) ---

/**
* @description Update a specific job posting with new fields.
* @route PUT /api/job-postings/:job_id
*/
export const updateJobPosting = async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
      const { job_id } = req.params;
      const jobPosting = await JobPosting.findByPk(job_id);
      if (!jobPosting) {
          // FIX: Removed 'return'
          res.status(404).json({ message: 'Job posting not found' });
          return;
      }
      
      const employer = await Employer.findOne({ where: { user_id: req.user?.id } });
      if (!employer || jobPosting.employer_id !== employer.employer_id) {
          // FIX: Removed 'return'
          res.status(403).json({ message: "Forbidden: You can only update your own job postings." });
          return;
      }

      const {
          payment_total, 
          payment_is_monthly, 
          payment_monthly_amount, 
          number_of_months,
          ...restOfBody
      } = req.body;

      let finalTotalPayment = 0;
      if (payment_is_monthly) {
          if (!payment_monthly_amount || !number_of_months || payment_monthly_amount <= 0 || number_of_months <= 0) {
            res.status(400).json({ message: "Monthly wage and number of months are required."});
            return;
          }
          finalTotalPayment = payment_monthly_amount * number_of_months;
      } else {
          if (!payment_total || payment_total <= 0) {
            res.status(400).json({ message: "A valid total payment is required."});
            return;
          }
          finalTotalPayment = payment_total;
      }
      
      const updatedData = {
          ...restOfBody,
          payment_total: finalTotalPayment,
          payment_is_monthly: !!payment_is_monthly,
          payment_monthly_amount: payment_is_monthly ? payment_monthly_amount : null,
          number_of_months: payment_is_monthly ? number_of_months : null,
      };

      await jobPosting.update(updatedData);
      res.json(jobPosting);
  } catch (error) {
      next(error);
  }
};
/**
* @description Delete a specific job posting.
* @route DELETE /api/job-postings/:job_id
*/
export const deleteJobPosting = async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
  // This function logic can remain largely the same, but we add an authorization check
  try {
      const { job_id } = req.params;
      const jobPosting = await JobPosting.findByPk(job_id);

      if (!jobPosting) {
          res.status(404).json({ message: 'Job posting not found' });
          return;
      }

      const employer = await Employer.findOne({ where: { user_id: req.user?.id } });
      if (!employer || jobPosting.employer_id !== employer.employer_id) {
          res.status(403).json({ message: "Forbidden: You can only delete your own job postings." });
          return;
      }

      await jobPosting.destroy();
      res.status(204).send(); // No content
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
  req : CustomRequest,
  res : Response,
  next: NextFunction
): Promise<void> => {
  try {
    const jobId          = Number(req.params.jobId);
    const loggedInUserId = req.user?.id;

    /* ---------- basic guards ---------- */
    if (Number.isNaN(jobId)) {
      res.status(400).json({ message: 'Invalid job id.' });
      return;                                           // ✅ δεν “επιστρέφω” Response
    }
    if (!loggedInUserId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }
    if (req.user?.user_type !== 'Artist') {
      res.status(403).json({ message: 'Only artists can apply.' });
      return;
    }

    /* ---------- fetch base records ---------- */
    const [artistUser, jobPosting] = await Promise.all([
      User.findByPk(loggedInUserId, { attributes: ['fullname'] }),
      JobPosting.findByPk(jobId),
    ]);
    if (!artistUser) {
      res.status(404).json({ message: 'Artist not found.' });
      return;
    }
    if (!jobPosting) {
      res.status(404).json({ message: 'Job not found.' });
      return;
    }

    /* ---------- duplicate application? ---------- */
    const dup = await JobApplication.findOne({
      where: { job_id: jobId, artist_user_id: loggedInUserId }
    });
    if (dup) {
      res.status(409).json({ message: 'Already applied.' });
      return;
    }

    /* ---------- create application ---------- */
    const newApplication = await JobApplication.create({
      job_id         : jobId,
      artist_user_id : loggedInUserId,
      application_date: new Date(),
    });

    /* ---------- notification to employer ---------- */
    const employer = await Employer.findByPk(jobPosting.employer_id, {
      include: [{ model: User, as: 'user', attributes: ['user_id'] }]
    });
    if (!employer || !employer.user) {
      res.status(404).json({ message: 'Employer user not found.' });
      return;
    }

    const frontBase = process.env.FRONTEND_URL || 'https://artepovera2.vercel.app';
    const artistLink = `${frontBase}/user-profile/${loggedInUserId}`;

    const notif = await Notification.create({
      user_id       : employer.user.user_id,
      sender_id     : loggedInUserId,
      message_key   : 'notifications.newApplication',
      message_params: {
        artistName       : artistUser.fullname,
        jobTitle         : jobPosting.title,
        artistProfileLink: artistLink,
      },
    });

    /* ---------- live push στον εργοδότη ---------- */
    pushNotification(req.io!, req.onlineUsers!, employer.user.user_id, notif.toJSON());

    /* ---------- response ---------- */
    res.status(201).json({
      message     : 'Application successful! Employer notified.',
      application : newApplication,
    });
  } catch (err) {
    /* μοναδική περίπτωση 409 από unique constraint */
    if (err instanceof UniqueConstraintError) {
      res.status(409).json({ message: 'Already applied (constraint).' });
      return;
    }
    console.error('❌ applyToJob error', err);
    next(err);                                           // αφήνουμε το κεντρικό error-handler
  }
};

