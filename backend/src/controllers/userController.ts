// src/controllers/userController.ts

import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import Artist from '../models/Artist';
import Employer from '../models/Employer';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Like from '../models/Like';
import Notification from '../models/Notification';
import { Op } from 'sequelize';
import Chat from '../models/Chat';
import sequelize from '../config/db';
import { Sequelize } from 'sequelize'; // Keep this import

interface CustomRequest<T = any> extends Request {
  body: T;
  user?: {
    id: number;
    username: string;
    user_type: string;
  };
}

// ─────────────────────────────────────────────────────────────
// THIS IS THE COMPLETE, UPDATED FUNCTION
// ─────────────────────────────────────────────────────────────
export const toggleLike = async (req: CustomRequest, res: Response): Promise<void> => {
    const loggedInUserId = req.user?.id;
    const likedUserId = parseInt(req.params.userId, 10);

    if (!loggedInUserId || !likedUserId || isNaN(likedUserId) || loggedInUserId === likedUserId) {
        res.status(400).json({ error: 'Invalid request.' });
        return;
    }

    try {
        const existingLike = await Like.findOne({
            where: { user_id: loggedInUserId, liked_user_id: likedUserId },
        });

        if (existingLike) {
            await existingLike.destroy();
            res.status(200).json({ message: 'Like removed', liked: false });
            return;
        }

        await Like.create({ user_id: loggedInUserId, liked_user_id: likedUserId });
        const frontendUrl = process.env.FRONTEND_URL || 'https://artepovera2.vercel.app';

        const loggedInUser = await User.findByPk(loggedInUserId, { attributes: ['fullname'] });
        const otherUser = await User.findByPk(likedUserId, { attributes: ['fullname'] });

        if (!loggedInUser || !otherUser) {
            console.warn(`Could not find one or both users (${loggedInUserId}, ${likedUserId})`);
            res.status(201).json({ message: 'Like added', liked: true });
            return;
        }
 // 2. Create the full URL to the person's profile who sent the like.
 const likerProfileLink = `${frontendUrl}/user-profile/${loggedInUserId}`;
        
 // 3. Create the new notification message with the embedded HTML link.
 const notificationMessage = `<a href="${likerProfileLink}"  rel="noopener noreferrer">${loggedInUser.fullname || 'Someone'}</a> liked your profile.`;

 // 4. Create the notification using the new message.
 await Notification.create({
     user_id: likedUserId,
     message: notificationMessage,
     sender_id: loggedInUserId,
 });


        const mutualLike = await Like.findOne({
            where: { user_id: likedUserId, liked_user_id: loggedInUserId },
        });

        if (!mutualLike) {
            // No mutual like yet, so just confirm the like was added.
            res.status(201).json({ message: 'Like added', liked: true });
            return;
        }
        
        // --- MUTUAL MATCH LOGIC ---
        console.log(`Mutual like! Finding/creating chat for users ${loggedInUserId} and ${likedUserId}`);
        
        const user1 = Math.min(loggedInUserId, likedUserId);
        const user2 = Math.max(loggedInUserId, likedUserId);

        const [chat] = await Chat.findOrCreate({
            where: { user1_id: user1, user2_id: user2 },
            defaults: { user1_id: user1, user2_id: user2 }
        });
        
        const chatLink = `${frontendUrl}/chat?open=${chat.chat_id}`;
        
        const messageForOtherUser = `You have a new match with ${loggedInUser.fullname}! <a href="${chatLink}" rel="noopener noreferrer">Start Chatting</a>`;
        const messageForLoggedInUser = `You matched with ${otherUser.fullname}! <a href="${chatLink}" rel="noopener noreferrer">Start Chatting</a>`;
        // Create notifications for both users
        await Notification.create({ user_id: likedUserId, message: messageForOtherUser, sender_id: loggedInUserId });
        
        const loggedInUserMatchNotification = await Notification.create({
            user_id: loggedInUserId,
            message: messageForLoggedInUser,
            sender_id: likedUserId
        });
        
        // --- THIS IS THE FIX ---
        // Re-fetch the notification for the logged-in user so it includes the sender's details.
        // This is the object that will be sent back to the client for an instant UI update.
        const newNotificationForClient = await Notification.findByPk(loggedInUserMatchNotification.notification_id, {
            include: [{
                model: User,
                as: 'sender',
                attributes: ['user_id', 'fullname', 'profile_picture'] // Or whatever details you show in the notification dropdown
            }]
        });

        res.status(201).json({
            message: 'Like added (mutual match detected!).',
            liked: true,
            chat_id: chat.chat_id,
            newNotification: newNotificationForClient // Send the new notification back in the response
        });

    } catch (error) {
        console.error('Error toggling like:', error);
        res.status(500).json({ error: 'Failed to toggle like' });
    }
};


// ... (keep your other controller functions: checkLike, getCurrentUser, getUserProfile, etc.) ...

// ─────────────────────────────────────────────────────────────
// CHECK IF THE CURRENT USER LIKED A SPECIFIC USER
// ─────────────────────────────────────────────────────────────
export const checkLike = async (req: CustomRequest, res: Response): Promise<void> => {
    const loggedInUserId = req.user?.id;
    const likedUserId = req.params.userId;

    if (!loggedInUserId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    if (!likedUserId || isNaN(parseInt(likedUserId, 10))) { // Validate likedUserId
        res.status(400).json({ error: 'Valid target user ID is required.' });
        return;
    }

    try {
        const like = await Like.findOne({
            where: { user_id: loggedInUserId, liked_user_id: likedUserId },
        });
        res.json({ liked: !!like });
    } catch (err) {
        console.error('Error checking like status:', err);
        res.status(500).json({ error: 'Failed to fetch like status' });
    }
};


// ─────────────────────────────────────────────────────────────
// GET THE CURRENTLY LOGGED‐IN USER’S DATA
// ─────────────────────────────────────────────────────────────
export const getCurrentUser = async (req: CustomRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized: User ID not found in token' });
        return;
      }
  
      const user = await User.findByPk(userId, {
        attributes: ['user_id', 'username', 'email', 'fullname', 'phone_number', 'user_type', 'location'],
        include: [
          {
            model: Artist,
            as: 'artistProfile',
            attributes: ['artist_id', 'bio', 'profile_picture', 'is_student', 'cv_url', 'cv_public_id'], // cv_url & cv_public_id are selected
            required: false
          },
          {
            model: Employer,
            as: 'employerProfile',
            attributes: ['employer_id', 'bio', 'profile_picture'], // Add cv_url/id here too if employers can have them
            required: false
          },
        ],
      });
  
      if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
      }
  
      const responseData: any = {
          user_id: user.user_id,
          username: user.username,
          fullname: user.fullname,
          user_type: user.user_type,
          email: user.email,
          phone_number: user.phone_number,
          // location: user.location, // Uncomment if you want to send location
      };
  
      if (user.artistProfile) {
          responseData.artist = {
              artist_id: user.artistProfile.artist_id,
              bio: user.artistProfile.bio,
              profile_picture: user.artistProfile.profile_picture,
              is_student: user.artistProfile.is_student,
              // --- ADD THESE LINES ---
              cv_url: user.artistProfile.cv_url,
              cv_public_id: user.artistProfile.cv_public_id
              // --- END ADD ---
          };
      } else {
          responseData.artist = null;
      }
  
       if (user.employerProfile) {
          responseData.employer = {
              employer_id: user.employerProfile.employer_id,
              bio: user.employerProfile.bio,
              profile_picture: user.employerProfile.profile_picture,
              // If employers can have CVs, add cv_url and cv_public_id here too
          };
      } else {
           responseData.employer = null;
      }
  
      console.log("[GET CURRENT USER] Sending responseData:", JSON.stringify(responseData, null, 2)); // Good for debugging
      res.status(200).json(responseData);
  
    } catch (error) {
      console.error('❌ Error in getCurrentUser:', error);
      res.status(500).json({ message: 'Internal server error', error: (error as Error).message });
    }
  };

// ─────────────────────────────────────────────────────────────
// GET A SPECIFIC USER’S PROFILE BY USER ID
// ─────────────────────────────────────────────────────────────
// src/controllers/userController.ts
// ... (keep all other imports: Request, Response, User, Artist, Employer, etc.)

// src/controllers/userController.ts
export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        const numericUserId = parseInt(userId, 10);
        if (!userId || isNaN(numericUserId)) {
            res.status(400).json({ error: "Valid User ID is required" });
            return;
        }

        console.log("📌 Fetching user profile for ID:", numericUserId);

        const user = await User.findOne({
            where: { user_id: numericUserId },
            // --- MODIFICATION: Remove 'city' if it doesn't exist on User model/table ---
            attributes: ['user_id', 'username', 'fullname', 'user_type' /* , 'location' if you want to send the POINT data */],
            // --- END MODIFICATION ---
            include: [
                {
                    model: Artist,
                    as: 'artistProfile',
                    attributes: ['artist_id', 'bio', 'profile_picture', 'is_student', 'cv_url', 'cv_public_id'],
                    required: false,
                },
                {
                    model: Employer,
                    as: 'employerProfile',
                    attributes: ['employer_id', 'bio', 'profile_picture'],
                    required: false,
                },
            ],
        });

        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }

        const responseData = {
            user_id: user.user_id,
            fullname: user.fullname,
            username: user.username,
            user_type: user.user_type,
            // city: user.city, // Remove if 'city' attribute was removed from User model selection
            artistProfile: user.artistProfile ? { /* ... */ } : null,
            employerProfile: user.employerProfile ? { /* ... */ } : null,
        };
        // Add back city to responseData if you fetch it some other way or if it's on artist/employer profiles
        if (user.artistProfile) {
             responseData.artistProfile = {
                 artist_id: user.artistProfile.artist_id,
                 bio: user.artistProfile.bio,
                 profile_picture: user.artistProfile.profile_picture,
                 is_student: user.artistProfile.is_student,
                 cv_url: user.artistProfile.cv_url,
                 cv_public_id: user.artistProfile.cv_public_id
                 // If city is on Artist profile: city: user.artistProfile.city
             };
        }
        if (user.employerProfile) {
             responseData.employerProfile = {
                 employer_id: user.employerProfile.employer_id,
                 bio: user.employerProfile.bio,
                 profile_picture: user.employerProfile.profile_picture,
                  // If city is on Employer profile: city: user.employerProfile.city
             };
        }

        res.json(responseData);
    } catch (error) { /* ... error handling ... */ }
};

// ... (Keep all other functions in userController.ts: createUser, loginUser, getCurrentUser, toggleLike, checkLike, etc.)


// --- Other functions like getUserNames, loginUser, createUser, etc. ---
// Ensure they also return the direct profile_picture URL if applicable

export const getUserNames = async (req: Request, res: Response): Promise<void> => {
    // This function seems correct - no changes needed for profile pic issue
    try {
        const users = await User.findAll({ attributes: ["user_id", "fullname"] });
        res.json({ users });
    } catch (error) {
        console.error("Error fetching user names:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const loginUser = async (
    req: CustomRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ message: 'Email and password are required.' }); return;
        }

        const user = await User.findOne({
            where: { email },
            include: [ // Include profiles to get picture URL immediately
                { model: Artist, as: 'artistProfile', attributes: ['artist_id', 'profile_picture'] },
                { model: Employer, as: 'employerProfile', attributes: ['employer_id', 'profile_picture'] }
            ]
        });
        if (!user) {
            res.status(404).json({ message: 'User not found.' }); return;
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            res.status(401).json({ message: 'Invalid credentials.' }); return;
        }

        const token = jwt.sign(
            { id: user.user_id, username: user.username, user_type: user.user_type },
            process.env.JWT_SECRET || 'default_secret',
            { expiresIn: '1h' }
        );

        // Prepare user object for response
        const userResponse = {
            user_id: user.user_id,
            username: user.username,
            fullname: user.fullname,
            user_type: user.user_type,
            // --- FIX: Use direct Cloudinary URL ---
            profile_picture: user.artistProfile?.profile_picture || user.employerProfile?.profile_picture || null,
            artist_id: user.artistProfile?.artist_id || null,
            employer_id: user.employerProfile?.employer_id || null,
        };

        res.json({ token, user: userResponse });

    } catch (error) {
        console.error('Error in loginUser:', error);
        next(error);
    }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
    // This function creates profiles with null/empty picture initially, which is fine
    // No changes needed here for the profile picture URL issue
     try {
        const { username, email, password, fullname, phone_number, user_type, location, isStudent } = req.body;
        if (!username || !email || !password || !fullname || !user_type) {
             res.status(400).json({ message: 'Username, email, password, fullname, and user type are required.' }); return;
        }
        if (!location || !location.coordinates || !Array.isArray(location.coordinates) || location.coordinates.length !== 2 || typeof location.coordinates[0] !== 'number' || typeof location.coordinates[1] !== 'number') {
            res.status(400).json({ message: 'Valid location coordinates (array of two numbers) are required.' }); return;
        }
        const [longitude, latitude] = location.coordinates;
        const existingUserByEmail = await User.findOne({ where: { email } });
        if (existingUserByEmail) { res.status(409).json({ message: 'Email already in use.' }); return; }
        const existingUserByUsername = await User.findOne({ where: { username } });
         if (existingUserByUsername) { res.status(409).json({ message: 'Username already exists.' }); return; }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await sequelize.transaction(async (t) => {
            const user = await User.create({
              username, email, password: hashedPassword, fullname, phone_number, user_type,
              location: { type: 'Point', coordinates: [longitude, latitude] },
            }, { transaction: t });

            let artist_id: number | null = null;
            let employer_id: number | null = null;

            if (user_type === 'Artist') {
              const isStudentValue = !!isStudent;
              const artist = await Artist.create({ user_id: user.user_id, bio: '', profile_picture: null, is_student: isStudentValue }, { transaction: t });
              artist_id = artist.artist_id;
            } else if (user_type === 'Employer') {
              const employer = await Employer.create({ user_id: user.user_id, bio: '', profile_picture: null }, { transaction: t });
              employer_id = employer.employer_id;
            } else { throw new Error('Invalid user type specified during profile creation.'); }

             const token = jwt.sign( { id: user.user_id, username: user.username, user_type: user.user_type }, process.env.JWT_SECRET || 'default_secret', { expiresIn: '1h' } );
             return { user, token, artist_id, employer_id };
        });

        res.status(201).json({
          user: {
              user_id: result.user.user_id, username: result.user.username, fullname: result.user.fullname, user_type: result.user.user_type,
              artist_id: result.artist_id, employer_id: result.employer_id, profile_picture: null
          },
          token: result.token,
        });
      } catch (error: any) {
        console.error('Error creating user:', error);
         if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
            res.status(400).json({ message: 'Registration failed due to invalid data.', errors: error.errors?.map((e: any) => e.message) });
        } else {
            res.status(500).json({ message: 'Error creating user', error: error.message });
        }
      }
};

export const getProfilesByUserType = async (req: CustomRequest, res: Response): Promise<void> => {
    // This function seems okay, doesn't deal with profile pictures directly
    // Although you might want to include profile pictures when fetching profiles
    try {
        const user_type = req.user?.user_type; // Get type from authenticated user

        if (user_type === 'Artist') {
            // Fetch Employers, include their profile pic (which is Cloudinary URL)
            const employers = await Employer.findAll({ include: [{ model: User, attributes: ['fullname'] }] }); // Example include
            res.status(200).json(employers);
        } else if (user_type === 'Employer') {
             // Fetch Artists, include their profile pic (which is Cloudinary URL)
            const artists = await Artist.findAll({ include: [{ model: User, attributes: ['fullname'] }] }); // Example include
            res.status(200).json(artists);
        } else {
            res.status(400).json({ message: 'Invalid user type or not authenticated properly' });
        }
    } catch (error) {
        console.error('Error fetching profiles by user type:', error);
        res.status(500).json({ message: 'Failed to fetch profiles' });
    }
};

export const updateUser = async (req: CustomRequest, res: Response): Promise<void> => {
    // This function updates basic user info, doesn't touch profile picture
    // No changes needed here for profile pic issue
    try {
        const userIdToUpdate = req.params.id; // Get ID from route param
        const loggedInUserId = req.user?.id; // Get ID from token

        // Basic authorization: Ensure user is updating their own profile
        // More complex admin roles would need different logic
        if (!loggedInUserId || loggedInUserId.toString() !== userIdToUpdate) {
             res.status(403).json({ message: 'Forbidden: You can only update your own profile.' });
             return;
        }


        const { username, email, fullname, phone_number } = req.body;

        const user = await User.findByPk(userIdToUpdate);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        // Add validation for username/email uniqueness if changed
        if (username && username !== user.username) {
            const existing = await User.findOne({ where: { username: username } });
            if (existing) return void res.status(409).json({ message: 'Username already taken.'});
            user.username = username;
        }
         if (email && email !== user.email) {
             const existing = await User.findOne({ where: { email: email } });
             if (existing) return void res.status(409).json({ message: 'Email already taken.'});
            user.email = email;
        }

        user.fullname = fullname || user.fullname;
        user.phone_number = phone_number || user.phone_number;

        await user.save();
        res.status(200).json({ // Return only non-sensitive info
             user_id: user.user_id,
             username: user.username,
             email: user.email,
             fullname: user.fullname,
             phone_number: user.phone_number,
             user_type: user.user_type
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};


export const deleteUser = async (req: CustomRequest, res: Response): Promise<void> => {
    // Similar authorization check needed
    try {
        const userIdToDelete = req.params.id;
        const loggedInUserId = req.user?.id;

         if (!loggedInUserId || loggedInUserId.toString() !== userIdToDelete) {
             res.status(403).json({ message: 'Forbidden: You cannot delete this user.' });
             return;
         }


        const user = await User.findByPk(userIdToDelete);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        // Consider deleting related data (likes, notifications, profile, etc.)
        // Or configure onDelete: 'CASCADE' in model associations

        await user.destroy();
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};