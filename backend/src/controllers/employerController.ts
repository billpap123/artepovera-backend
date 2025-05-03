// src/controllers/employerController.ts
import { Request, Response, NextFunction } from 'express';
// REMOVED: import multer from 'multer';
// REMOVED: import path from 'path';
import { v2 as cloudinary } from 'cloudinary'; // <<< ADD Cloudinary import
import { UploadApiResponse } from 'cloudinary'; // <<< ADD Cloudinary type import
import Employer from '../models/Employer'; // Keep your Employer model import
import { CustomRequest } from '../middleware/authMiddleware'; // Keep Custom Request type
import User from '../models/User'; // Keep if used by other functions
import { Sequelize } from 'sequelize'; // <<< ADD THIS LINE

// --- REMOVED OLD MULTER CONFIGURATION ---
// const uploadFolder = process.env.UPLOAD_FOLDER || 'uploads';
// const storage = multer.diskStorage({...});
// const fileFilter = (...) => {...};
// const upload = multer({ storage, fileFilter, limits: {...} });
// export const uploadProfilePicture = upload.single('profile_picture'); // REMOVE THIS

// --- UPDATED Controller Function ---
// Handle profile updates (create or update)
export const updateEmployerProfile = async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // 1. Get User ID and text fields
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized: Missing user ID' });
      return;
    }
    const { bio } = req.body;
    let cloudinaryUrl: string | null = null; // To store new image URL

    // 2. Handle potential file upload FIRST
    if (req.file) {
      console.log(`[UPLOAD] Received new profile picture for employer user: ${userId}`);
      try {
        // Use a Promise to handle the Cloudinary upload stream
        const uploadPromise = new Promise<UploadApiResponse | undefined>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "employer_profile_pics" }, // Optional: Use a different folder
            (error, result) => {
              if (result) {
                resolve(result);
              } else {
                reject(error || new Error('Cloudinary upload failed.'));
              }
            }
          );
          // Pipe the buffer from req.file (memoryStorage) into the upload stream
          stream.end(req.file.buffer);
        });

        const result = await uploadPromise;
        if (!result) {
           throw new Error("Cloudinary upload returned undefined result.");
        }
        cloudinaryUrl = result.secure_url; // Get the secure HTTPS URL
        console.log(`[UPLOAD] Cloudinary upload successful for employer user ${userId}. URL: ${cloudinaryUrl}`);
        // Optional: Delete old Cloudinary image logic could go here if updating

      } catch (uploadError: any) {
        console.error('[ERROR] Cloudinary upload stream failed for employer:', uploadError);
        // Send specific error response and stop execution
        res.status(500).json({ message: 'Failed to upload image.', error: uploadError.message });
        return;
      }
    }

    // 3. Find existing or Prepare data for creation
    let employer = await Employer.findOne({ where: { user_id: userId } });
    let isNew = false;
    let responseStatus = 200; // Default to OK for update

    if (!employer) {
      // Create if doesn't exist
      isNew = true;
      responseStatus = 201; // Created
      console.log(`[DB] Creating new employer profile for user: ${userId}`);
      try {
          employer = await Employer.create({
            user_id: userId,
            bio: bio || '', // Use provided bio or default
            profile_picture: cloudinaryUrl, // Use the uploaded URL (or null if no file)
          });
       } catch (dbError: any) {
           console.error('[ERROR] Failed to create employer profile:', dbError);
           // Handle potential DB errors during creation (e.g., constraints)
           res.status(500).json({ message: 'Failed to create employer profile.', error: dbError.message });
           return;
       }

    } else {
      // Update existing profile
      let updated = false;
      if (bio !== undefined && employer.bio !== bio) { // Check if bio was provided and different
        employer.bio = bio;
        updated = true;
      }
      if (cloudinaryUrl) { // Only update picture if a new one was successfully uploaded
        // Optional: Delete old Cloudinary image for employer.profile_picture here
        employer.profile_picture = cloudinaryUrl; // <<< SAVE CLOUDINARY URL
        updated = true;
      }

      if (updated) {
        try {
            await employer.save();
            console.log(`[DB] Employer profile updated for user: ${userId}`);
         } catch (dbError: any) {
            console.error('[ERROR] Failed to save updated employer profile:', dbError);
             res.status(500).json({ message: 'Failed to save employer profile updates.', error: dbError.message });
             return;
         }
      } else {
        console.log(`[DB] No relevant changes provided for employer profile user: ${userId}`);
      }
    }

    // 4. Send success response
    res.status(responseStatus).json({
        message: `Employer profile ${isNew ? 'created' : 'updated'} successfully`,
        employer: { // Return consistent, minimal data structure
            employer_id: employer.employer_id,
            user_id: employer.user_id,
            bio: employer.bio,
            profile_picture: employer.profile_picture
        }
    });

  } catch (error: any) { // Catch errors from findOne or other unexpected issues
    console.error('Error in updateEmployerProfile controller:', error);
    // Use next(error) if you have a dedicated error handling middleware setup
    // next(error);
    // Or send generic response
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// --- Other Controller Functions (Mostly Unchanged) ---

// Get employer by ID
export const getEmployerById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const employer = await Employer.findByPk(req.params.id, {
        // Include attributes needed by frontend, profile_picture will be Cloudinary URL
         attributes: ['employer_id', 'user_id', 'bio', 'profile_picture']
    });
    if (employer) {
      res.json(employer);
    } else {
      res.status(404).json({ message: 'Employer not found' });
    }
  } catch (error) {
    console.error('Error fetching employer:', error);
    next(error);
  }
};

// Delete employer - Add optional Cloudinary delete
export const deleteEmployer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params; // Assuming id is employer_id
    const employer = await Employer.findByPk(id);
    if (!employer) {
      res.status(404).json({ message: 'Employer not found' });
      return;
    }

     // --- Optional: Delete from Cloudinary before destroying DB record ---
    // if (employer.profile_picture) {
    //   try {
    //      // Requires parsing public_id from URL or storing it separately
    //      const publicId = extractPublicIdFromUrl(employer.profile_picture);
    //      if (publicId) {
    //          console.log(`[DELETE] Deleting Cloudinary image for employer ${id}: ${publicId}`);
    //          await cloudinary.uploader.destroy(publicId);
    //      }
    //   } catch (cloudinaryError) {
    //      console.error(`[WARN] Failed to delete Cloudinary image for employer ${id}:`, cloudinaryError);
    //   }
    // }
    // --- End Optional ---

    await employer.destroy();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting employer:', error);
    next(error);
  }
};

// Get all employers with their location - Maybe join to get profile picture?
export const getEmployersWithLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const employers = await User.findAll({
      where: { user_type: 'Employer' },
       attributes: [
        'user_id',
        'fullname',
        // Ensure your User model actually has latitude/longitude directly
        // Or use the ST_X/ST_Y method if using POINT geometry
        // 'latitude',
        // 'longitude'
        [Sequelize.fn('ST_X', Sequelize.col('location')), 'longitude'], // If using POINT
        [Sequelize.fn('ST_Y', Sequelize.col('location')), 'latitude'],  // If using POINT
      ],
      // Example JOIN to get profile picture URL:
      include: [{
        model: Employer,
        attributes: ['profile_picture'] // Get picture URL from Employer table
      }]
    });

    res.json(employers);
  } catch (error) {
    console.error('Error fetching employers with location:', error);
     // Use next(error) or send response
     res.status(500).json({ message: 'Internal server error' });
  }
};