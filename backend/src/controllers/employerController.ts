// src/controllers/employerController.ts
import { Request, Response, NextFunction } from 'express';
import { v2 as cloudinary } from 'cloudinary';         // <<< Cloudinary SDK import
import { UploadApiResponse } from 'cloudinary';      // <<< Cloudinary type import
import Employer from '../models/Employer';
import { CustomRequest } from '../middleware/authMiddleware';
import User from '../models/User';
import { Sequelize } from 'sequelize';
import multer from 'multer';                         // <<< Kept old import
import path from 'path';                           // <<< Kept old import

// --- Old Multer Configuration (Likely NO LONGER USED if configured centrally) ---
// Use an environment variable for the upload folder, defaulting to 'uploads/'
// NOTE: This 'uploadFolder' is probably not used by Cloudinary logic.
const uploadFolder = process.env.UPLOAD_FOLDER || 'uploads';
console.log(`[WARN] [employerController] Local uploadFolder variable defined as: ${uploadFolder} - This may be unused.`);

// Configure Multer for file uploads (Disk Storage - Likely OBSOLETE)
// NOTE: Multer should be configured ONCE with memoryStorage (e.g., in middleware/multerConfig.ts)
//       and applied in your routes (e.g., routes/index.ts). This local config is probably not active.
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.warn("[WARN] [employerController] Obsolete Multer diskStorage destination called!"); // Log if somehow called
    // This destination logic will likely NOT be used if memoryStorage is active.
    cb(null, uploadFolder);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, uniqueSuffix);
  },
});

// File filter to only allow PNG and JPEG images (Logic is likely duplicated from central config)
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

// Local Multer instance (Likely OBSOLETE and UNUSED)
// NOTE: The 'upload' instance imported from 'middleware/multerConfig.ts' in your routes
//       is the one that should be processing the requests.
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
console.log("[WARN] [employerController] Local 'upload' multer instance created - likely unused.");

// Export of local multer instance (Likely OBSOLETE and UNUSED)
export const uploadProfilePicture = upload.single('profile_picture');
console.log("[WARN] [employerController] Obsolete 'uploadProfilePicture' middleware exported - likely unused.");
// --- End Old Multer Configuration ---


// --- Helper to attempt extracting public_id from Cloudinary URL ---
// NOTE: Storing the public_id from the upload response in your database
// is generally more reliable than parsing the URL.
function extractPublicIdFromUrl(imageUrl: string | null | undefined): string | null {
    if (!imageUrl) return null;
    try {
        const url = new URL(imageUrl);
        const pathSegments = url.pathname.split('/');
        const uploadIndex = pathSegments.indexOf('upload');
        if (uploadIndex === -1 || uploadIndex + 1 >= pathSegments.length) { console.warn(`Could not find '/upload/' segment in Cloudinary URL: ${imageUrl}`); return null; }
        const versionIndex = pathSegments.findIndex((part, index) => index > uploadIndex && /^v\d+$/.test(part));
        let publicIdWithExtension;
        if (versionIndex > -1 && versionIndex < pathSegments.length - 1) { publicIdWithExtension = pathSegments.slice(versionIndex + 1).join('/'); }
        else if (uploadIndex < pathSegments.length - 1){ publicIdWithExtension = pathSegments.slice(uploadIndex + 1).join('/'); }
        else { return null; }
        const lastDotIndex = publicIdWithExtension.lastIndexOf('.');
        return (lastDotIndex > -1) ? publicIdWithExtension.substring(0, lastDotIndex) : publicIdWithExtension;
    } catch (e) { console.error("Error parsing Cloudinary URL to extract public_id:", e); return null; }
}
// --- End Helper ---


// --- UPDATED Controller Function ---
// Handle profile updates (create or update)
export const updateEmployerProfile = async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ message: 'Unauthorized: Missing user ID' }); return; }

    const { bio } = req.body;
    let cloudinaryUrl: string | null = null;
    let oldPublicId: string | null = null; // Store old ID if replacing image

    // --- Check for file uploaded by CENTRAL multer instance (using memoryStorage) ---
    if (req.file) {
      console.log(`[UPLOAD] Received new profile picture for employer user: ${userId}`);
      // Find existing employer first to potentially delete old image later
      const existingEmployer = await Employer.findOne({ where: { user_id: userId }, attributes: ['profile_picture'] });
      oldPublicId = extractPublicIdFromUrl(existingEmployer?.profile_picture);

      // --- Start Cloudinary Upload ---
      try {
        const uploadPromise = new Promise<UploadApiResponse | undefined>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "employer_profile_pics" },
            (error, result) => {
              if (result) { resolve(result); }
              else { reject(error || new Error('Cloudinary upload failed.')); }
            }
          );
          stream.end(req.file.buffer); // Use buffer from memoryStorage
        });
        const result = await uploadPromise;
        if (!result) throw new Error("Cloudinary upload returned undefined result.");
        cloudinaryUrl = result.secure_url; // Get the new URL
        console.log(`[UPLOAD] Cloudinary upload successful for employer user ${userId}. URL: ${cloudinaryUrl}`);
      } catch (uploadError: any) {
        console.error('[ERROR] Cloudinary upload stream failed for employer:', uploadError);
        res.status(500).json({ message: 'Failed to upload image.', error: uploadError.message }); return;
      }
      // --- End Cloudinary Upload ---
    } // End if(req.file)

    // Find existing or Prepare data for creation
    let employer = await Employer.findOne({ where: { user_id: userId } });
    let isNew = false;
    let responseStatus = 200;

    if (!employer) {
      isNew = true; responseStatus = 201;
      console.log(`[DB] Creating new employer profile for user: ${userId}`);
      try {
          employer = await Employer.create({
            user_id: userId,
            bio: bio || '',
            profile_picture: cloudinaryUrl, // Use Cloudinary URL (or null if no file)
          });
       } catch (dbError: any) { /* ... handle create error ... */ return; }
    } else {
      // Update existing profile
      let updated = false;
      if (bio !== undefined && employer.bio !== bio) { employer.bio = bio; updated = true; }
      if (cloudinaryUrl) { // Only update picture URL if a new one was uploaded
        employer.profile_picture = cloudinaryUrl; // Use new Cloudinary URL
        updated = true;
      }

      if (updated) {
        try {
            await employer.save();
            console.log(`[DB] Employer profile updated for user: ${userId}`);
            // --- Optional: Delete OLD Cloudinary image AFTER successful DB update ---
            if (oldPublicId && cloudinaryUrl) { // Delete only if replaced
                try {
                    console.log(`[DELETE] Deleting old Cloudinary image for employer ${userId}: ${oldPublicId}`);
                    await cloudinary.uploader.destroy(oldPublicId);
                } catch (deleteError) { console.error(`[WARN] Failed to delete old Cloudinary image ${oldPublicId}:`, deleteError); }
            }
            // --- End Optional ---
         } catch (dbError: any) { /* ... handle save error ... */ return; }
      } else { console.log(`[DB] No relevant changes provided for employer profile user: ${userId}`); }
    }

    // Send success response
    res.status(responseStatus).json({
        message: `Employer profile ${isNew ? 'created' : 'updated'} successfully`,
        employer: { employer_id: employer.employer_id, user_id: employer.user_id, bio: employer.bio, profile_picture: employer.profile_picture }
    });

  } catch (error: any) {
    console.error('Error in updateEmployerProfile controller:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// --- ADD FUNCTION TO DELETE PROFILE PICTURE ---
export const deleteEmployerProfilePicture = async (req: CustomRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ message: 'Unauthorized' }); return; }

    try {
        const employer = await Employer.findOne({ where: { user_id: userId } });
        if (!employer || !employer.profile_picture) { res.status(404).json({ message: 'Employer profile or picture not found.' }); return; }

        const oldImageUrl = employer.profile_picture;
        const publicIdToDelete = extractPublicIdFromUrl(oldImageUrl); // Use helper

        // --- Optional: Delete from Cloudinary ---
        if (publicIdToDelete) {
           try {
               console.log(`[DELETE] Attempting to delete Cloudinary image: ${publicIdToDelete}`);
               await cloudinary.uploader.destroy(publicIdToDelete);
               console.log(`[DELETE] Cloudinary image ${publicIdToDelete} deleted successfully.`);
           } catch (cloudinaryError: any) {
               console.error(`[WARN] Failed to delete Cloudinary image ${publicIdToDelete}:`, cloudinaryError.message);
           }
        } else {
             console.warn(`[DELETE] Could not determine public_id to delete Cloudinary image. URL: ${oldImageUrl}`);
        }
        // --- End Optional ---

        // Update DB: Set profile picture to null
        employer.profile_picture = null;
        await employer.save();
        console.log(`[UPDATE] Profile picture removed for employer user: ${userId}`);

        res.status(200).json({ message: 'Profile picture deleted successfully.', profile_picture: null });

    } catch (error: any) {
        console.error('Error deleting employer profile picture:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};
// --- END ADDED FUNCTION ---


// Get employer by ID
export const getEmployerById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // This function remains the same, it will return the Cloudinary URL correctly
  try {
    const employerId = req.params.id;
     if (!employerId || isNaN(parseInt(employerId, 10))) { res.status(400).json({ message: 'Valid Employer ID required.' }); return; }
    const employer = await Employer.findByPk(employerId, { attributes: ['employer_id', 'user_id', 'bio', 'profile_picture'] });
    if (employer) { res.json(employer); }
    else { res.status(404).json({ message: 'Employer not found' }); }
  } catch (error) { console.error('Error fetching employer:', error); next(error); }
};

// Delete employer
export const deleteEmployer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Added optional Cloudinary delete logic
  try {
    const employerIdToDelete = req.params.id;
     if (!employerIdToDelete || isNaN(parseInt(employerIdToDelete, 10))) { res.status(400).json({ message: 'Valid Employer ID required.' }); return; }
    // Add authorization check here maybe?

    const employer = await Employer.findByPk(employerIdToDelete);
    if (!employer) { res.status(404).json({ message: 'Employer not found' }); return; }

    const imageUrlToDelete = employer.profile_picture;
    const publicIdToDelete = extractPublicIdFromUrl(imageUrlToDelete); // <<< USE HELPER

    await employer.destroy(); // Delete DB record first
    console.log(`[DELETE] Employer record ${employerIdToDelete} deleted from DB.`);

    // THEN, attempt to delete from Cloudinary
    if (publicIdToDelete) {
          try {
              console.log(`[DELETE] Attempting to delete Cloudinary image: ${publicIdToDelete}`);
              await cloudinary.uploader.destroy(publicIdToDelete);
              console.log(`[DELETE] Cloudinary image ${publicIdToDelete} deleted successfully.`);
          } catch (deleteError) { console.error(`[WARN] Failed to delete Cloudinary image ${publicIdToDelete} after DB deletion:`, deleteError); }
    } else if (imageUrlToDelete) {
           console.warn(`[DELETE] Could not determine public_id to delete Cloudinary image for deleted employer ${employerIdToDelete}. URL: ${imageUrlToDelete}`);
    }

    res.status(204).send();
  } catch (error) { console.error('Error deleting employer:', error); next(error); }
};

// Get all employers with their location
export const getEmployersWithLocation = async (req: Request, res: Response, next: NextFunction) => {
  // This function remains the same, will include Cloudinary URL via the JOIN
  try {
    const employers = await User.findAll({
      where: { user_type: 'Employer' },
       attributes: [ 'user_id', 'fullname',
        [Sequelize.fn('ST_X', Sequelize.col('location')), 'longitude'],
        [Sequelize.fn('ST_Y', Sequelize.col('location')), 'latitude'], ],
      include: [{ model: Employer, as: 'employerProfile', attributes: ['profile_picture', 'employer_id'] }]
    });
    res.json(employers);
  } catch (error) { console.error('Error fetching employers with location:', error); res.status(500).json({ message: 'Internal server error' }); }
};