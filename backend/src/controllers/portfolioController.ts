// src/controllers/portfolioController.ts
import { Request, Response } from 'express';
import Portfolio from '../models/Portfolio'; // Assume Portfolio model now has 'item_type' and 'public_id'
import Artist from '../models/Artist';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse, ResourceType } from 'cloudinary'; // ENSURE ResourceType IS IMPORTED
import { CustomRequest } from '../middleware/authMiddleware';

// --- ADDED: Helper to determine item_type and Cloudinary resource_type ---
type PortfolioItemType = 'image' | 'pdf' | 'video' | 'other';

const getFileTypeDetails = (mimetype: string): { itemType: PortfolioItemType, resourceType: ResourceType } => {
    if (mimetype.startsWith('image/')) return { itemType: 'image', resourceType: 'image' };
    if (mimetype === 'application/pdf') return { itemType: 'pdf', resourceType: 'image' }; // Cloudinary often treats PDFs as 'image' or 'raw'. Using 'image' allows some transformations.
    if (mimetype.startsWith('video/')) return { itemType: 'video', resourceType: 'video' };
    return { itemType: 'other', resourceType: 'raw' };
};
// --- END ADDED HELPER ---

// --- Helper to attempt extracting public_id (Keep your existing version) ---
function extractPublicIdFromUrl(imageUrl: string | null | undefined): string | null {
    if (!imageUrl) return null;
    try {
        const url = new URL(imageUrl);
        const pathSegments = url.pathname.split('/');
        const uploadIndex = pathSegments.indexOf('upload');
        if (uploadIndex === -1 || uploadIndex + 1 >= pathSegments.length) {
            console.warn(`Could not find '/upload/' segment in Cloudinary URL: ${imageUrl}`);
            return null;
        }
        const versionIndex = pathSegments.findIndex((part, index) => index > uploadIndex && /^v\d+$/.test(part));
        let publicIdWithExtension;
        if (versionIndex > -1 && versionIndex < pathSegments.length - 1) {
             publicIdWithExtension = pathSegments.slice(versionIndex + 1).join('/');
        } else if (uploadIndex < pathSegments.length - 1){
             publicIdWithExtension = pathSegments.slice(uploadIndex + 1).join('/');
        } else { return null; }
        const lastDotIndex = publicIdWithExtension.lastIndexOf('.');
        return (lastDotIndex > -1) ? publicIdWithExtension.substring(0, lastDotIndex) : publicIdWithExtension;
    } catch (e) { console.error("Error parsing Cloudinary URL to extract public_id:", e); return null; }
}
// --- End Helper ---


// CREATE A NEW PORTFOLIO ITEM
export const createPortfolioItem = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const { description } = req.body;
    const file = req.file;

    if (!file) {
      res.status(400).json({ message: 'File (image, PDF, or video) is required' }); // Generic message
      return;
    }
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ message: 'Unauthorized: User not found in token' }); return; }
    const artist = await Artist.findOne({ where: { user_id: userId } });
    if (!artist) { res.status(404).json({ message: 'Artist profile not found. Cannot add portfolio item.' }); return; }

    const { itemType, resourceType } = getFileTypeDetails(file.mimetype); // Determine types

    console.log(`[UPLOAD] Received portfolio file for artist: ${artist.artist_id}, mimetype: ${file.mimetype}, resourceType: ${resourceType}`);

    const uploadOptions: any = { folder: "portfolio_items", resource_type: resourceType };
    if (resourceType === 'video') {
      uploadOptions.chunk_size = 6000000; // Example: 6MB chunks for large videos
      // Add other video-specific upload options if needed
    }

    const uploadPromise = new Promise<UploadApiResponse | undefined>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream( uploadOptions, (error, result) => {
          if (result) { resolve(result); } else { reject(error || new Error('Cloudinary upload failed.')); }
        }
      );
      stream.end(file.buffer);
    });

    const result = await uploadPromise;
    if (!result) { throw new Error("Cloudinary upload returned undefined result."); }

    const itemUrl = result.secure_url;
    const publicId = result.public_id; // Capture Cloudinary's public_id

    console.log(`[UPLOAD] Cloudinary upload successful. URL: ${itemUrl}, Public ID: ${publicId}, ItemType: ${itemType}`);

    const portfolioItem = await Portfolio.create({
      artist_id: artist.artist_id,
      image_url: itemUrl,
      description: description || '',
      item_type: itemType,     // Save determined item_type
      public_id: publicId,     // Save Cloudinary public_id
    });

    res.status(201).json(portfolioItem.toJSON()); // Send back as JSON

  } catch (error: any) {
    console.error('Error creating portfolio item:', error);
    if (error && error.http_code) { res.status(error.http_code).json({ message: error.message || 'Cloudinary error during creation.' }); }
    else { res.status(500).json({ message: 'Failed to create portfolio item', error: error.message }); }
  }
};

// GET PORTFOLIO ITEMS FOR A SPECIFIC ARTIST
export const getArtistPortfolio = async (req: Request, res: Response): Promise<void> => {
  try {
    const artistIdParam = req.params.artistId;
    if (!artistIdParam || isNaN(parseInt(artistIdParam))) { res.status(400).json({ message: 'Valid Artist ID parameter is required.' }); return; }
    const artistId = parseInt(artistIdParam);

    const portfolioItems = await Portfolio.findAll({
      where: { artist_id: artistId },
      order: [['created_at', 'DESC']] // Ensure your model uses 'created_at' or 'createdAt'
    });
    res.status(200).json(portfolioItems.map(item => item.toJSON()));
  } catch (error: any) {
    console.error(`Error retrieving portfolio items for artist ${req.params.artistId}:`, error);
    res.status(500).json({ message: 'Failed to retrieve portfolio items', error: error.message });
  }
};

// GET PORTFOLIO ITEMS FOR THE CURRENTLY LOGGED-IN ARTIST
export const getMyPortfolio = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) { res.status(401).json({ message: 'Unauthorized: User not found in token' }); return; }
    const artist = await Artist.findOne({ where: { user_id: userId } });
    if (!artist) { res.status(200).json([]); return; }
    const portfolioItems = await Portfolio.findAll({
      where: { artist_id: artist.artist_id },
      order: [['created_at', 'DESC']]
    });
    res.status(200).json(portfolioItems.map(item => item.toJSON()));
  } catch (error: any) {
    console.error('Error retrieving own portfolio items:', error);
    res.status(500).json({ message: 'Failed to retrieve portfolio items', error: error.message });
  }
};

// UPDATE A PORTFOLIO ITEM
export const updatePortfolioItem = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const portfolioItemId = parseInt(req.params.id, 10);
    const { description } = req.body;
    const file = req.file;
    const userId = req.user?.id;

    if (isNaN(portfolioItemId)) { res.status(400).json({ message: 'Invalid Portfolio Item ID.'}); return; }
    if (!userId) { res.status(401).json({ message: 'Unauthorized' }); return; }

    const portfolioItem = await Portfolio.findOne({
        where: { portfolio_id: portfolioItemId }, // Assuming 'portfolio_id' is the PK attribute in your model
        include: [{ model: Artist, as: 'artist', where: { user_id: userId }, required: true }]
    });
    if (!portfolioItem) { res.status(404).json({ message: 'Portfolio item not found or not authorized.' }); return; }

    let newImageUrl: string | null = null;
    let newPublicId: string | null = null;
    let newItemType: PortfolioItemType | null = null;
    const oldPublicId = portfolioItem.public_id; // Get from existing DB item
    const oldItemType = portfolioItem.item_type; // Get from existing DB item

    if (file) {
      console.log(`[UPDATE] New file for portfolio item: ${portfolioItemId}, type: ${file.mimetype}`);
      const { itemType, resourceType } = getFileTypeDetails(file.mimetype);
      newItemType = itemType;
      const uploadOptions: any = { folder: "portfolio_items", resource_type: resourceType };
      if (resourceType === 'video') uploadOptions.chunk_size = 6000000;

      const uploadPromise = new Promise<UploadApiResponse | undefined>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
            if (result) { resolve(result); } else { reject(error || new Error('Cloudinary upload failed.')); }
        });
        stream.end(file.buffer);
      });
       try {
            const result = await uploadPromise;
            if (!result) throw new Error("Cloudinary upload returned undefined result.");
            newImageUrl = result.secure_url;
            newPublicId = result.public_id;
       } catch (uploadError: any) { /* ... error handling ... */ return; }
    }

    let updated = false;
    if (description !== undefined && portfolioItem.description !== description) { portfolioItem.description = description; updated = true; }
    if (newImageUrl && newPublicId && newItemType) {
      portfolioItem.image_url = newImageUrl;
      portfolioItem.public_id = newPublicId;
      portfolioItem.item_type = newItemType;
      updated = true;
    }

    if (updated) {
        await portfolioItem.save();
        console.log(`[UPDATE] Portfolio item ${portfolioItemId} updated in DB.`);
        if (oldPublicId && newImageUrl && oldPublicId !== newPublicId) {
            const { resourceType: oldResourceType } = getFileTypeDetails(oldItemType ? `type/${oldItemType}` : 'image/jpeg');
            try {
                console.log(`[DELETE OLD] Deleting old Cloudinary asset: ${oldPublicId}, type: ${oldResourceType}`);
                await cloudinary.uploader.destroy(oldPublicId, { resource_type: oldResourceType });
            } catch (deleteError) { console.error(`[WARN] Failed to delete old Cloudinary asset ${oldPublicId}:`, deleteError); }
        }
    } else { console.log(`[UPDATE] No changes for portfolio item ${portfolioItemId}.`); }
    res.status(200).json(portfolioItem.toJSON());
  } catch (error: any) {
    console.error(`Error updating portfolio item ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to update portfolio item', error: error.message });
  }
};

// DELETE A PORTFOLIO ITEM
export const deletePortfolioItem = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const portfolioItemId = parseInt(req.params.id, 10);
    const userId = req.user?.id;
    if (isNaN(portfolioItemId)) { res.status(400).json({ message: 'Invalid Portfolio Item ID.'}); return; }
    if (!userId) { res.status(401).json({ message: 'Unauthorized' }); return; }

    const portfolioItem = await Portfolio.findOne({
        where: { portfolio_id: portfolioItemId }, // Assuming PK is 'portfolio_id'
        include: [{ model: Artist, as: 'artist', where: { user_id: userId }, required: true }]
    });
    if (!portfolioItem) { res.status(404).json({ message: 'Portfolio item not found or not authorized.' }); return; }

    const publicIdToDelete = portfolioItem.public_id;
    const itemTypeToDelete = portfolioItem.item_type;
    const { resourceType: resourceTypeToDelete } = getFileTypeDetails(
        itemTypeToDelete ? `type/${itemTypeToDelete}` : (portfolioItem.image_url && portfolioItem.image_url.includes('.pdf') ? 'application/pdf' : 'image/jpeg')
    );

    await portfolioItem.destroy();
    console.log(`[DELETE] Portfolio item ${portfolioItemId} deleted from DB.`);

    if (publicIdToDelete) {
      try {
        console.log(`[DELETE CLOUDINARY] Attempting for public_id: ${publicIdToDelete}, resource_type: ${resourceTypeToDelete}`);
        await cloudinary.uploader.destroy(publicIdToDelete, { resource_type: resourceTypeToDelete });
        console.log(`[DELETE CLOUDINARY] Asset ${publicIdToDelete} deleted successfully.`);
      } catch (deleteError) { console.error(`[WARN] Failed to delete Cloudinary asset ${publicIdToDelete}:`, deleteError); }
    } else {
      const imageUrlFromDB = portfolioItem.image_url; // Fallback if public_id wasn't stored
      if (imageUrlFromDB) {
          const extractedPublicId = extractPublicIdFromUrl(imageUrlFromDB);
          if (extractedPublicId) {
              const fallbackResourceType = getFileTypeDetails(itemTypeToDelete ? `type/${itemTypeToDelete}` : 'image/jpeg').resourceType;
              console.warn(`[DELETE CLOUDINARY] No public_id stored, attempting delete via extracted ID: ${extractedPublicId}, type: ${fallbackResourceType}`);
              try { await cloudinary.uploader.destroy(extractedPublicId, { resource_type: fallbackResourceType }); console.log(`[DELETE CLOUDINARY] Asset ${extractedPublicId} (extracted) successfully deleted.`); }
              catch (deleteError) { console.error(`[WARN] Failed to delete extracted Cloudinary asset ${extractedPublicId}:`, deleteError); }
          } else { console.warn(`[DELETE CLOUDINARY] No public_id and could not extract from URL for item ${portfolioItemId}.`); }
      } else { console.warn(`[DELETE CLOUDINARY] No public_id or image_url found for item ${portfolioItemId}.`); }
    }
    res.status(204).send();
  } catch (error: any) {
    console.error(`Error deleting portfolio item ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to delete portfolio item', error: error.message });
  }
};