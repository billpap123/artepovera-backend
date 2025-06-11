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
  // 1. Authorization: Ensure user is a logged-in employer
  const loggedInUserId = req.user?.id;
  const loggedInUserType = req.user?.user_type;

  if (!loggedInUserId) {
      res.status(401).json({ message: "Unauthorized. Please log in." });
      return;
  }
  
  if (loggedInUserType !== 'Employer') {
      res.status(403).json({ message: "Forbidden. Only employers can post jobs." });
      return;
  }

  try {
      const employer = await Employer.findOne({ where: { user_id: loggedInUserId } });
      if (!employer) {
          res.status(403).json({ message: "Forbidden. An employer profile is required to post a job." });
          return;
      }

      // 2. Destructure and validate the request body
      const {
          title, category, description, location, presence,
          start_date, end_date, application_deadline,
          payment_total, payment_is_monthly, payment_monthly_amount,
          insurance, desired_keywords, requirements
      } = req.body;

      if (!title || !category || !payment_total || !presence) {
          res.status(400).json({ message: "Title, Category, Total Payment, and Presence are required fields." });
          return;
      }

      // 3. Find or Create the Category in the database
      // This handles both existing categories and new ones submitted by users.
      const [categoryRecord] = await Category.findOrCreate({
          where: { name: category.trim() },
          defaults: { name: category.trim() },
      });

      // 4. Create the new Job Posting with the validated data
      const newJobPosting = await JobPosting.create({
          employer_id: employer.employer_id,
          title,
          category: categoryRecord.name, // Use the definitive name from the database record
          description,
          location,
          presence,
          start_date: start_date || null,
          end_date: end_date || null,
          application_deadline: application_deadline || null,
          payment_total,
          payment_is_monthly: !!payment_is_monthly, // Ensure it's a boolean
          payment_monthly_amount: payment_is_monthly ? payment_monthly_amount : null,
          insurance: insurance !== undefined ? insurance : null,
          desired_keywords,
          requirements,
      });

      // 5. Send a success response
      res.status(201).json({ message: "Job posting created successfully!", jobPosting: newJobPosting });

  } catch (error) {
      console.error('Error creating job posting:', error);
      next(error); // Pass any errors to your global error handler
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
    res.status(404).json({ message: 'Job posting not found' });
    return;
  }
  
  // Authorization Check: Ensure the person updating is the one who created it.
  const employer = await Employer.findOne({ where: { user_id: req.user?.id } });
  if (!employer || jobPosting.employer_id !== employer.employer_id) {
      res.status(403).json({ message: "Forbidden: You can only update your own job postings." });
      return;
  }

  // Update with all the new fields from the request body
  const updatedData = req.body;
  await jobPosting.update(updatedData);

  res.json(jobPosting);
} catch (error) {
  console.error('Error updating job posting:', error);
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
const frontendBaseUrl =  'https://artepovera2.vercel.app'; // Fallback to your live URL
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
