// Assuming this file is src/controllers/artistController.ts
import { Request, Response, NextFunction } from 'express';
// REMOVED: import multer from 'multer'; - Rely on instance from server/routes
// REMOVED: import path from 'path'; - No longer needed for constructing paths here
import { v2 as cloudinary } from 'cloudinary'; // <<< ADD Import Cloudinary SDK
import { UploadApiResponse } from 'cloudinary'; // Import type for result
import Artist from '../models/Artist';
import { CustomRequest } from '../middleware/authMiddleware'; // Keep your custom request type
import User from '../models/User'; // Keep User import if needed elsewhere
import { Sequelize } from 'sequelize'; // Keep Sequelize if needed elsewhere

// --- REMOVED OLD MULTER CONFIGURATION ---
// const uploadFolder = process.env.UPLOAD_FOLDER || 'uploads';
// const storage = multer.diskStorage({...});
// const fileFilter = (...) => {...};
// const upload = multer({ storage, fileFilter, limits: {...} });
// export const uploadProfilePicture = upload.single('profile_picture'); // REMOVE THIS - Middleware applied in route definition

// --- UPDATED Controller Function ---
export const updateArtistProfile = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    // Step 1: Retrieve user ID from the token
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized: Missing user ID' });
      return;
    }

    // Step 2: Extract text fields from the request body
    const { bio } = req.body;
    let cloudinaryUrl: string | null = null; // To store the new image URL if uploaded

    // Step 3: Check if a new file was uploaded (multer using memoryStorage puts it in req.file)
    if (req.file) {
        console.log(`[UPLOAD] Received new profile picture for user: ${userId}, size: ${req.file.size}`);

        // Use a Promise to handle the Cloudinary upload stream
        const uploadPromise = new Promise<UploadApiResponse | undefined>((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: "profile_pics" }, // Optional: Specify a folder in Cloudinary
              (error, result) => {
                if (result) {
                  resolve(result);
                } else {
                  // Reject with error or a generic error if Cloudinary doesn't provide one
                  reject(error || new Error('Cloudinary upload failed.'));
                }
              }
            );
            // Pipe the buffer from req.file into the upload stream
            stream.end(req.file.buffer);
          });

        try {
            const result = await uploadPromise;
            if (!result) {
                // Should be caught by reject, but double-check
                 throw new Error("Cloudinary upload returned undefined result.");
            }
            cloudinaryUrl = result.secure_url; // Get the secure HTTPS URL from Cloudinary
            console.log(`[UPLOAD] Cloudinary upload successful for user ${userId}. URL: ${cloudinaryUrl}`);
            // Optional: If you store result.public_id, you could delete the old image here
        } catch (uploadError: any) {
             console.error('[ERROR] Cloudinary upload stream failed:', uploadError);
             // Respond with a specific upload error
             res.status(500).json({ message: 'Failed to upload image to storage.', error: uploadError.message });
             return; // Stop execution if upload fails
        }
    }

    // Step 4: Find the artist profile associated with the user
    const artist = await Artist.findOne({ where: { user_id: userId } });
    if (!artist) {
      res.status(404).json({ message: 'Artist profile not found' });
      return;
    }

    // Step 5: Update the artist profile fields if provided
    let updated = false; // Flag to check if any changes were made
    if (bio !== undefined && artist.bio !== bio) { // Only update if bio is actually sent
         artist.bio = bio;
         updated = true;
    }
    if (cloudinaryUrl) { // Only update picture if a new one was successfully uploaded
        artist.profile_picture = cloudinaryUrl; // <<< SAVE CLOUDINARY URL
        updated = true;
    }

    // Step 6: Save the updated artist profile only if changes occurred
    if (updated) {
        await artist.save();
        console.log(`[UPDATE] Artist profile updated for user: ${userId}`);
    } else {
         console.log(`[UPDATE] No relevant changes provided for artist profile user: ${userId}`);
    }


    // Step 7: Return a consistent and clean response with current data
    res.status(200).json({
      message: 'Artist profile updated successfully',
      artist: {
        artist_id: artist.artist_id,
        bio: artist.bio,
        profile_picture: artist.profile_picture, // Return the current picture URL (new or old)
      },
    });
  } catch (error: any) { // Catch remaining errors (e.g., database find/save)
    console.error('Error in updateArtistProfile controller:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};
// --- Helper to attempt extracting public_id from Cloudinary URL ---
// NOTE: Storing the public_id from the upload response in your database
// is generally more reliable than parsing the URL.
function extractPublicIdFromUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  try {
      const url = new URL(imageUrl);
      // Example path: /cloud_name/image/upload/v12345/folder/public_id.jpg
      // Try to find 'upload/' and get path parts after it
      const pathSegments = url.pathname.split('/');
      const uploadIndex = pathSegments.indexOf('upload');
      if (uploadIndex === -1 || uploadIndex + 1 >= pathSegments.length) {
          console.warn(`Could not find '/upload/' segment in Cloudinary URL: ${imageUrl}`);
          return null;
      }
      // Look for a version segment (v followed by numbers) after 'upload'
      const versionIndex = pathSegments.findIndex((part, index) => index > uploadIndex && /^v\d+$/.test(part));

      let publicIdWithExtension;
      if (versionIndex > -1 && versionIndex < pathSegments.length - 1) {
           // Assumes public_id is everything after version
           publicIdWithExtension = pathSegments.slice(versionIndex + 1).join('/');
      } else {
           // Fallback: Assume everything after /upload/ is folder/public_id.ext
           // This might fail if transformations are in the URL before version/public_id
           publicIdWithExtension = pathSegments.slice(uploadIndex + 1).join('/');
      }

      const lastDotIndex = publicIdWithExtension.lastIndexOf('.');
      if (lastDotIndex > -1) {
          return publicIdWithExtension.substring(0, lastDotIndex); // Return path without extension
      }
      // Handle cases without extension (less common for image uploads)
      return publicIdWithExtension || null;

  } catch (e) {
      console.error("Error parsing Cloudinary URL to extract public_id:", e);
      return null;
  }
}
// --- End Helper ---


// --- ADD THIS FUNCTION ---
export const deleteArtistProfilePicture = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    const artist = await Artist.findOne({ where: { user_id: userId } });
    if (!artist || !artist.profile_picture) {
      res.status(404).json({ message: 'Artist profile or picture not found.' });
      return;
    }

    const oldImageUrl = artist.profile_picture;
    // --- Optional: Delete from Cloudinary ---
    // IMPORTANT: Best to store public_id in DB. Parsing URL is less reliable.
    const publicIdToDelete = extractPublicIdFromUrl(oldImageUrl); // Use the helper function
    if (publicIdToDelete) {
       try {
           console.log(`[DELETE] Attempting to delete Cloudinary image: ${publicIdToDelete}`);
           await cloudinary.uploader.destroy(publicIdToDelete);
           console.log(`[DELETE] Cloudinary image ${publicIdToDelete} deleted successfully.`);
       } catch (cloudinaryError: any) {
           // Log error but proceed with DB update - maybe image was already deleted?
           console.error(`[WARN] Failed to delete Cloudinary image ${publicIdToDelete}:`, cloudinaryError.message);
       }
    } else {
         console.warn(`[DELETE] Could not determine public_id to delete Cloudinary image. URL: ${oldImageUrl}`);
    }
    // --- End Optional ---

    // Update DB: Set profile picture to null
    artist.profile_picture = null; // Set field to null
    await artist.save();
    console.log(`[UPDATE] Profile picture removed for artist user: ${userId}`);

    res.status(200).json({ message: 'Profile picture deleted successfully.', profile_picture: null }); // Return null URL

  } catch (error: any) {
    console.error('Error deleting artist profile picture:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

export const getArtistById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("Fetching artist for ID:", req.params.id);
    const artist = await Artist.findOne({
      where: { artist_id: req.params.id },
      // Ensure you include profile_picture if needed by frontend
      attributes: ['artist_id', 'user_id', 'bio', 'profile_picture'], // Added artist_id, user_id
    });
    if (artist) {
      // The profile_picture returned here will now be the Cloudinary URL
      res.json(artist);
    } else {
      console.log("Artist not found for ID:", req.params.id);
      res.status(404).json({ message: 'Artist not found' });
    }
  } catch (error) {
    console.error('Error fetching artist by ID:', error);
    next(error); // Pass the error to error-handling middleware
  }
};

// Delete artist - No changes needed for Cloudinary logic here,
// but you might *want* to delete the image from Cloudinary when deleting the artist.
export const deleteArtist = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const artist = await Artist.findByPk(id);
    if (!artist) {
      res.status(404).json({ message: 'Artist not found' });
      return;
    }
    // --- Optional: Delete from Cloudinary before destroying DB record ---
    // if (artist.profile_picture) {
    //   try {
    //      // You need the public_id, not the URL. You'd have to parse it or store it separately.
    //      const publicId = extractPublicIdFromUrl(artist.profile_picture); // Implement this helper
    //      if (publicId) {
    //          console.log(`[DELETE] Deleting Cloudinary image for artist ${id}: ${publicId}`);
    //          await cloudinary.uploader.destroy(publicId);
    //      }
    //   } catch (cloudinaryError) {
    //      console.error(`[WARN] Failed to delete Cloudinary image for artist ${id}:`, cloudinaryError);
    //      // Don't block DB deletion if Cloudinary deletion fails, maybe log for manual cleanup
    //   }
    // }
    // --- End Optional ---
    await artist.destroy();
    res.status(204).send(); // No content response
  } catch (error) {
    console.error('Error deleting artist:', error);
    next(error); // Pass the error to error-handling middleware
  }
};

export const getArtistsWithLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const artists = await User.findAll({
      where: { user_type: 'Artist' },
      attributes: [
        'user_id',
        'fullname',
        [Sequelize.fn('ST_X', Sequelize.col('location')), 'longitude'], // Extract longitude
        [Sequelize.fn('ST_Y', Sequelize.col('location')), 'latitude'],  // Extract latitude
        // You might want to JOIN with Artists table here to get profile_picture URL too
      ],
      // Example JOIN:
      // include: [{
      //   model: Artist,
      //   attributes: ['profile_picture']
      // }]
    });

    res.status(200).json(artists);
  } catch (error) {
    console.error('Error fetching artists with location:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// --- ADD NEW CV UPLOAD/UPDATE FUNCTION ---
export const uploadOrUpdateArtistCv = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  const file = req.file; // From multer upload.single('cv')

  console.log(`[CV UPLOAD - 1] Attempting CV upload for userId: ${userId}`);

  if (!userId) {
      console.log("[CV UPLOAD - E1] Unauthorized, no userId in token.");
      res.status(401).json({ message: 'Unauthorized' });
      return;
  }
  if (!file) {
      console.log("[CV UPLOAD - E2] No file provided.");
      res.status(400).json({ message: 'CV file (PDF) is required.' });
      return;
  }
  if (file.mimetype !== 'application/pdf') {
      console.log(`[CV UPLOAD - E3] Invalid file type: ${file.mimetype}. PDF required.`);
      res.status(400).json({ message: 'Invalid file type. Only PDF is allowed for CV.' });
      return;
  }

  try {
      console.log(`[CV UPLOAD - 2] Finding artist profile for userId: ${userId}`);
      const artist = await Artist.findOne({ where: { user_id: userId } });
      if (!artist) {
          console.log(`[CV UPLOAD - E4] Artist profile not found for userId: ${userId}`);
          res.status(404).json({ message: 'Artist profile not found.' });
          return;
      }
      console.log(`[CV UPLOAD - 3] Artist profile found. artist_id: ${artist.artist_id}. Current cv_public_id: ${artist.cv_public_id}`);

      // If artist already has a CV, prepare to delete the old one from Cloudinary
      if (artist.cv_public_id) {
          console.log(`[CV UPLOAD - 4] Previous CV exists. Public_id: ${artist.cv_public_id}. Attempting deletion from Cloudinary.`);
          try {
              // For PDFs, Cloudinary might treat them as 'raw' or 'image'.
              // 'raw' is often safer for non-image files unless you need image-specific processing.
              await cloudinary.uploader.destroy(artist.cv_public_id, { resource_type: 'raw' }); // Or 'image' if you uploaded it as such
              console.log(`[CV UPLOAD - 5] Old CV ${artist.cv_public_id} deleted from Cloudinary.`);
          } catch (deleteError) {
              console.error(`[CV UPLOAD - E5] Failed to delete old CV ${artist.cv_public_id} from Cloudinary:`, deleteError);
              // Decide if you want to stop the process or continue with uploading the new one.
              // For now, we'll log and continue.
          }
      } else {
          console.log("[CV UPLOAD - 4] No previous CV to delete from Cloudinary.");
      }

      // Upload new CV to Cloudinary
      console.log(`[CV UPLOAD - 6] Uploading new CV to Cloudinary. Original filename: ${file.originalname}`);
      const uploadPromise = new Promise<UploadApiResponse | undefined>((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
              {
                  folder: "artist_cvs",      // Specific folder for CVs
                  resource_type: "raw",     // Upload PDFs as 'raw' files (common for documents)
                                            // If you want Cloudinary to try and treat it like an image (e.g., for transformations), use 'image'
                  format: "pdf"             // Optional: can help Cloudinary
              },
              (error, result) => {
                  if (result) { resolve(result); }
                  else { reject(error || new Error('Cloudinary CV upload stream failed.')); }
              }
          );
          stream.end(file.buffer);
      });

      const cloudinaryResult = await uploadPromise;
      if (!cloudinaryResult || !cloudinaryResult.secure_url || !cloudinaryResult.public_id) {
          console.error("[CV UPLOAD - E6] Cloudinary upload failed or did not return expected result:", cloudinaryResult);
          throw new Error('Cloudinary CV upload did not return a valid result.');
      }
      console.log(`[CV UPLOAD - 7] New CV uploaded to Cloudinary. URL: ${cloudinaryResult.secure_url}, Public ID: ${cloudinaryResult.public_id}`);

      // Update artist record in database with new CV URL and Public ID
      artist.cv_url = cloudinaryResult.secure_url;
      artist.cv_public_id = cloudinaryResult.public_id;

      console.log(`[CV UPLOAD - 8] Attempting to save artist (ID: ${artist.artist_id}) with new CV details to DB.`);
      await artist.save(); // This persists the changes to cv_url and cv_public_id
      console.log(`[CV UPLOAD - 9] Artist record saved to DB. CV URL: ${artist.cv_url}`);

      res.status(200).json({
          message: 'CV uploaded successfully!',
          cv_url: artist.cv_url,
          cv_public_id: artist.cv_public_id
      });

  } catch (error: any) {
      console.error("[CV UPLOAD - E7] Error in uploadOrUpdateArtistCv:", error);
      if (error.http_code) { // Cloudinary specific error
          res.status(error.http_code).json({ message: error.message || 'Cloudinary error during CV upload.' });
      } else {
          res.status(500).json({ message: 'Failed to upload CV.', error: error.message });
      }
  }
};

// --- ADD NEW CV DELETE FUNCTION ---
export const deleteArtistCv = async (req: CustomRequest, res: Response): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
  }

  try {
      const artist = await Artist.findOne({ where: { user_id: userId } });
      if (!artist) {
          res.status(404).json({ message: 'Artist profile not found.' });
          return;
      }

      if (!artist.cv_url || !artist.cv_public_id) {
          res.status(404).json({ message: 'No CV found to delete.' });
          return;
      }

      const publicIdToDelete = artist.cv_public_id;

      // Delete from Cloudinary
      console.log(`[CV Delete] Deleting CV from Cloudinary: ${publicIdToDelete}`);
      try {
          // Ensure correct resource_type, for PDFs often 'raw' or 'image'
          await cloudinary.uploader.destroy(publicIdToDelete, { resource_type: 'raw' }); // Or 'image'
          console.log(`[CV Delete] CV ${publicIdToDelete} deleted from Cloudinary.`);
      } catch (deleteError) {
          console.error(`[CV Delete] Failed to delete CV ${publicIdToDelete} from Cloudinary:`, deleteError);
          // Proceed to clear DB fields even if Cloudinary delete fails, to allow re-upload.
          // Or, you could return an error here and not update DB if Cloudinary fails.
      }

      // Clear fields in database
      artist.cv_url = null;
      artist.cv_public_id = null;
      await artist.save();

      res.status(200).json({ message: 'CV deleted successfully.' });

  } catch (error: any) {
      console.error("Error deleting artist CV:", error);
      res.status(500).json({ message: 'Failed to delete CV.', error: error.message });
  }
};
// --- END NEW CV DELETE FUNCTION ---