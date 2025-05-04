// src/controllers/portfolioController.ts
import { Request, Response } from 'express';
import Portfolio from '../models/Portfolio';
import Artist from '../models/Artist';
import { v2 as cloudinary } from 'cloudinary'; // <<< ADD Cloudinary import
import { UploadApiResponse } from 'cloudinary'; // <<< ADD Cloudinary type import
// REMOVED: import multer from 'multer';
// REMOVED: import path from 'path';
// REMOVED: import fs from 'fs';
import { CustomRequest } from '../middleware/authMiddleware'; // Keep Custom Request

// --- REMOVED OLD MULTER/FS CONFIGURATION ---
// const defaultUploadsDir = ...
// if (!fs.existsSync...
// const storage = multer.diskStorage({...});
// const fileFilter = (...) => {...};
// export const upload = multer({...}); // REMOVE export - use instance from server.ts in routes

// --- Helper to attempt extracting public_id (Use with caution or store public_id in DB) ---
function extractPublicIdFromUrl(imageUrl: string | null | undefined): string | null {
    if (!imageUrl) return null;
    try {
        const url = new URL(imageUrl);
        // Example path: /cloud_name/image/upload/v12345/folder/public_id.jpg
        // More robustly find part after /upload/ and before final extension
        const pathSegments = url.pathname.split('/');
        const uploadIndex = pathSegments.indexOf('upload');
        if (uploadIndex === -1 || uploadIndex + 1 >= pathSegments.length) {
            console.warn(`Could not find '/upload/' segment in Cloudinary URL: ${imageUrl}`);
            return null; // Or try a simpler extraction
        }
        // Look for a version segment (v followed by numbers)
        const versionIndex = pathSegments.findIndex((part, index) => index > uploadIndex && /^v\d+$/.test(part));

        let publicIdWithExtension;
        if (versionIndex > -1 && versionIndex < pathSegments.length - 1) {
             // Assumes public_id is everything after version
             publicIdWithExtension = pathSegments.slice(versionIndex + 1).join('/');
        } else if (uploadIndex < pathSegments.length - 1){
             // Fallback: Assume everything after /upload/ is folder/public_id.ext
             // This might fail if there are transformations in the URL before version/public_id
             publicIdWithExtension = pathSegments.slice(uploadIndex + 1).join('/');
        } else {
            return null; // Cannot determine public_id structure
        }

        const lastDotIndex = publicIdWithExtension.lastIndexOf('.');
        if (lastDotIndex > -1) {
            return publicIdWithExtension.substring(0, lastDotIndex); // Return path without extension
        }
        // Handle cases without extension? Less common for uploads.
        return publicIdWithExtension;

    } catch (e) {
        console.error("Error parsing Cloudinary URL to extract public_id:", e);
        return null;
    }
    // NOTE: Storing the 'public_id' returned from the Cloudinary upload response
    // in your database alongside the 'image_url' is a much more reliable way
    // to get the ID for deletion than parsing the URL.
}
// --- End Helper ---


// ─────────────────────────────────────────────────────────────
// CREATE A NEW PORTFOLIO ITEM (for the currently logged-in artist)
// ─────────────────────────────────────────────────────────────
export const createPortfolioItem = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const { description } = req.body;
    const file = req.file; // File is in memory thanks to memoryStorage

    if (!file) {
      res.status(400).json({ message: 'Image file is required' });
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized: User not found in token' });
      return;
    }

    const artist = await Artist.findOne({ where: { user_id: userId } });
    if (!artist) {
      res.status(404).json({ message: 'Artist profile not found. Cannot add portfolio item.' });
      return;
    }

    console.log(`[UPLOAD] Received portfolio image for artist: ${artist.artist_id}, size: ${file.size}`);

    // Upload image buffer to Cloudinary
    const uploadPromise = new Promise<UploadApiResponse | undefined>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "portfolio_items" }, // Optional: Organize in Cloudinary
        (error, result) => {
          if (result) { resolve(result); } else { reject(error || new Error('Cloudinary upload failed.')); }
        }
      );
      stream.end(file.buffer);
    });

    const result = await uploadPromise;
     if (!result) {
         throw new Error("Cloudinary upload returned undefined result.");
     }
    const imageUrl = result.secure_url; // Get the Cloudinary URL
    // const publicId = result.public_id; // <<< Consider storing this too!

    console.log(`[UPLOAD] Cloudinary upload successful for portfolio item. URL: ${imageUrl}`);

    // Create the portfolio item using the Cloudinary URL
    const portfolioItem = await Portfolio.create({
      artist_id: artist.artist_id,
      image_url: imageUrl, // <<< SAVE CLOUDINARY URL
      // public_id: publicId, // <<< Optionally save public_id
      description: description || '', // Use description or default
    });

    res.status(201).json(portfolioItem);
    // No return needed after res.json

  } catch (error: any) {
    console.error('Error creating portfolio item:', error);
    // Check for Cloudinary specific errors
    if (error && error.http_code) {
       res.status(error.http_code).json({ message: error.message || 'Cloudinary error during creation.' });
    } else {
       res.status(500).json({ message: 'Failed to create portfolio item', error: error.message });
    }
  }
};

// ─────────────────────────────────────────────────────────────
// GET PORTFOLIO ITEMS FOR A SPECIFIC ARTIST (by artistId param)
// ─────────────────────────────────────────────────────────────
export const getArtistPortfolio = async (req: Request, res: Response): Promise<void> => {
  try {
    const { artistId } = req.params;
    if (!artistId) {
        res.status(400).json({ message: 'Artist ID parameter is required.' });
        return;
    }

    console.log(`[GET] Fetching portfolio for artistId: ${artistId}`);

    const portfolioItems = await Portfolio.findAll({
      where: { artist_id: artistId },
      // include: [{ model: Artist, as: 'artist', attributes: ['bio'] }], // Include artist info if needed
      order: [['createdAt', 'DESC']] // Example ordering
    });

    // image_url from DB is already the full Cloudinary URL, no need to construct it
    res.status(200).json(portfolioItems);
    // No return needed

  } catch (error: any) {
    console.error(`Error retrieving portfolio items for artist ${req.params.artistId}:`, error);
    res.status(500).json({ message: 'Failed to retrieve portfolio items', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET PORTFOLIO ITEMS FOR THE CURRENTLY LOGGED-IN ARTIST
// ─────────────────────────────────────────────────────────────
export const getMyPortfolio = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized: User not found in token' });
      return;
    }

    const artist = await Artist.findOne({ where: { user_id: userId } });
    if (!artist) {
      // If artist profile doesn't exist, they can't have portfolio items
      console.log(`[GET] No artist profile found for user ${userId}, returning empty portfolio.`);
      res.status(200).json([]); // Return empty array is appropriate
      return;
    }

    console.log(`[GET] Fetching own portfolio for artistId: ${artist.artist_id}`);

    const portfolioItems = await Portfolio.findAll({
      where: { artist_id: artist.artist_id },
      // include: [{ model: Artist, as: 'artist', attributes: ['bio'] }], // Optional include
      order: [['createdAt', 'DESC']] // Example ordering
    });

    // image_url from DB is already the full Cloudinary URL
    res.status(200).json(portfolioItems);
    // No return needed

  } catch (error: any) {
    console.error('Error retrieving own portfolio items:', error);
    res.status(500).json({ message: 'Failed to retrieve portfolio items', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// UPDATE A PORTFOLIO ITEM
// ─────────────────────────────────────────────────────────────
export const updatePortfolioItem = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // Portfolio item ID
    const { description } = req.body;
    const file = req.file; // Potential new image file in memory
    const userId = req.user?.id; // ID of the logged-in user

    if (!userId) {
       res.status(401).json({ message: 'Unauthorized' });
       return;
    }

    // Find the portfolio item *and* verify ownership via artist -> user linkage
    const portfolioItem = await Portfolio.findOne({
        where: { id: id },
        include: [{ model: Artist, as: 'artist', where: { user_id: userId }, required: true }] // Ensure it belongs to logged in user
    });

    if (!portfolioItem) {
      res.status(404).json({ message: 'Portfolio item not found or you are not authorized to update it.' });
      return;
    }

    let newImageUrl: string | null = null;
    let oldPublicId: string | null = null; // To delete old image from Cloudinary

    // If a new file is uploaded, process it
    if (file) {
      console.log(`[UPLOAD] Received new image for portfolio item: ${id}`);

      // Store the old image URL/ID before overwriting, if attempting deletion
      const oldImageUrl = portfolioItem.image_url;
      // oldPublicId = extractPublicIdFromUrl(oldImageUrl); // Use helper or stored public_id

      // Upload new image buffer to Cloudinary
      const uploadPromise = new Promise<UploadApiResponse | undefined>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "portfolio_items" },
          (error, result) => {
            if (result) { resolve(result); } else { reject(error || new Error('Cloudinary upload failed.')); }
          }
        );
        stream.end(file.buffer);
      });

       try {
            const result = await uploadPromise;
            if (!result) throw new Error("Cloudinary upload returned undefined result.");
            newImageUrl = result.secure_url; // Get the new URL
            // const newPublicId = result.public_id; // <<< Store this if possible
            console.log(`[UPLOAD] Cloudinary upload successful for portfolio update ${id}. URL: ${newImageUrl}`);

       } catch (uploadError: any) {
           console.error('[ERROR] Cloudinary upload stream failed during update:', uploadError);
           res.status(500).json({ message: 'Failed to upload new image.', error: uploadError.message });
           return; // Stop if new upload fails
       }

    } // End if (req.file)

    // Update fields
    let updated = false;
    if (description !== undefined && portfolioItem.description !== description) {
      portfolioItem.description = description;
      updated = true;
    }
    if (newImageUrl) { // Only update URL if a new image was successfully uploaded
      portfolioItem.image_url = newImageUrl;
      // portfolioItem.public_id = newPublicId; // <<< Update stored public_id too
      updated = true;
    }

    // Save changes if any were made
    if (updated) {
        await portfolioItem.save();
        console.log(`[UPDATE] Portfolio item ${id} updated.`);

        // --- Optional: Delete old Cloudinary image AFTER successful DB update ---
        // Requires having the old public_id (parsed or stored)
        // if (oldPublicId && newImageUrl) { // Only delete if replaced
        //     try {
        //         console.log(`[DELETE] Deleting old Cloudinary image for portfolio ${id}: ${oldPublicId}`);
        //         await cloudinary.uploader.destroy(oldPublicId);
        //     } catch (deleteError) {
        //         console.error(`[WARN] Failed to delete old Cloudinary image ${oldPublicId}:`, deleteError);
        //     }
        // }
        // --- End Optional Delete ---

    } else {
         console.log(`[UPDATE] No changes provided for portfolio item ${id}.`);
    }


    res.status(200).json(portfolioItem); // Return updated item

  } catch (error: any) {
    console.error(`Error updating portfolio item ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to update portfolio item', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE A PORTFOLIO ITEM
// ─────────────────────────────────────────────────────────────
export const deletePortfolioItem = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // Portfolio item ID
    const userId = req.user?.id; // Logged in user ID

    if (!userId) {
       res.status(401).json({ message: 'Unauthorized' });
       return;
    }

  // Find the item and verify ownership
  const portfolioItem = await Portfolio.findOne({
    // --- CORRECTED ---
    where: { portfolio_id: id },
    // --- END CORRECTION ---
    include: [{ model: Artist, as: 'artist', where: { user_id: userId }, required: true }]
});

    if (!portfolioItem) {
      res.status(404).json({ message: 'Portfolio item not found or you are not authorized to delete it.' });
      return;
    }

    const imageUrlToDelete = portfolioItem.image_url;
    // const publicIdToDelete = portfolioItem.public_id; // <<< Use stored public_id if available

    // First, destroy the database record
    await portfolioItem.destroy();
    console.log(`[DELETE] Portfolio item ${id} deleted from DB.`);

    // --- THEN, attempt to delete from Cloudinary ---
    if (imageUrlToDelete) { // Or check publicIdToDelete if using that
      const publicIdToDelete = extractPublicIdFromUrl(imageUrlToDelete); // Attempt parse
      if (publicIdToDelete) {
          try {
              console.log(`[DELETE] Attempting to delete Cloudinary image: ${publicIdToDelete}`);
              await cloudinary.uploader.destroy(publicIdToDelete);
              console.log(`[DELETE] Cloudinary image ${publicIdToDelete} deleted successfully.`);
          } catch (deleteError) {
              // Log failure but don't fail the request, DB entry is already gone
              console.error(`[WARN] Failed to delete Cloudinary image ${publicIdToDelete} after DB deletion:`, deleteError);
          }
      } else {
           console.warn(`[DELETE] Could not determine public_id to delete Cloudinary image for deleted portfolio item ${id}. URL: ${imageUrlToDelete}`);
      }
    }
    // --- End Cloudinary Delete ---

    res.status(204).send(); // Success, no content

  } catch (error: any) {
    console.error(`Error deleting portfolio item ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to delete portfolio item', error: error.message });
  }
};