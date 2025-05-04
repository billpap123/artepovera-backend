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
// TOGGLE A LIKE ON A USER
// ─────────────────────────────────────────────────────────────
export const toggleLike = async (req: CustomRequest, res: Response): Promise<void> => {
    const loggedInUserId = req.user?.id;
    const likedUserId = parseInt(req.params.userId, 10);

    if (!loggedInUserId || !likedUserId || isNaN(likedUserId)) {
        res.status(400).json({ error: 'Invalid request. User IDs are required.' });
        return;
    }
     if (loggedInUserId === likedUserId) {
          res.status(400).json({ error: 'Users cannot like themselves.' });
          return;
     }

    try {
      const existingLike = await Like.findOne({
        where: { user_id: loggedInUserId, liked_user_id: likedUserId },
      });

      if (existingLike) {
        await existingLike.destroy();
        return void res.status(200).json({ message: 'Like removed', liked: false });
      }

      // Create the like
      const newLike = await Like.create({ user_id: loggedInUserId, liked_user_id: likedUserId });

      // Notify the liked user
      const loggedInUser = await User.findByPk(loggedInUserId, { attributes: ['fullname', 'user_type'] }); // <<< ADD 'user_type'      // Fetch other user for chat check / notification message
      const otherUserRow = await User.findByPk(likedUserId, { attributes: ['user_id', 'user_type', 'fullname'] });


      if (loggedInUser) {
          await Notification.create({
            user_id: likedUserId,
            message: `${loggedInUser.fullname || 'Someone'} liked you.`,
            sender_id: loggedInUserId,
            // like_id: newLike.like_id // <<< Temporarily commented out to fix TS error. FIX Notification Model to include like_id!
          });
      } else {
           console.warn(`Could not find logged in user ${loggedInUserId} to create like notification`);
      }


      // Check if there is a mutual like
      const mutualLike = await Like.findOne({
        where: { user_id: likedUserId, liked_user_id: loggedInUserId },
      });

      if (!mutualLike || !otherUserRow || !loggedInUser) { // Check if users exist for mutual like part
        return void res.status(201).json({ message: 'Like added', liked: true });
      }

      // --- Mutual Like Found ---
      console.log(`Mutual like detected between ${loggedInUserId} and ${likedUserId}`);
      let chat: Chat | null = null;
      const loggedUserType = loggedInUser.user_type; // Use already fetched user info
      const otherUserType = otherUserRow.user_type;

      let artistUserId: number | null = null;
      let employerUserId: number | null = null;

      if (loggedUserType === 'Artist' && otherUserType === 'Employer') {
          artistUserId = loggedInUserId;
          employerUserId = likedUserId;
      } else if (loggedUserType === 'Employer' && otherUserType === 'Artist') {
          artistUserId = likedUserId;
          employerUserId = loggedInUserId;
      }

      if (artistUserId && employerUserId) {
          // Find or Create Chat
          [chat] = await Chat.findOrCreate({
              where: { artist_user_id: artistUserId, employer_user_id: employerUserId },
              defaults: { artist_user_id: artistUserId, employer_user_id: employerUserId }
          });

          if (chat) { // Should always exist after findOrCreate
              console.log(`Chat found or created with ID: ${chat.chat_id}`);
              // Notify both users about the new chat/match (only if chat was just created? Check logic)
               await Notification.create({
                   user_id: loggedInUserId,
                   message: `You matched with ${otherUserRow.fullname || 'user'}! Start chatting.`,
                   sender_id: likedUserId, // System or other user?
                   // Add chat_id maybe?
               });
               await Notification.create({
                   user_id: likedUserId,
                   message: `You matched with ${loggedInUser.fullname || 'user'}! Start chatting.`,
                   sender_id: loggedInUserId,
                   // Add chat_id maybe?
               });
          }
      } else {
          console.log('Mutual like between same user types, no chat created.');
      }

      res.status(201).json({
          message: 'Like added (mutual like detected).',
          liked: true,
          chat_id: chat?.chat_id || null
       });

    } catch (error) {
      console.error('Error toggling like:', error);
      res.status(500).json({ error: 'Failed to toggle like' });
    }
};

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
    // console.log('🔹 Decoded user from token:', req.user); // Keep for debugging if needed
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
          attributes: ['artist_id', 'bio', 'profile_picture', 'is_student'],
          required: false
        },
        {
          model: Employer,
          as: 'employerProfile',
          attributes: ['employer_id', 'bio', 'profile_picture'],
          required: false
        },
      ],
    });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // --- FIX: REMOVED formatProfilePicture function ---
    // const baseURL = process.env.BASE_URL || 'http://localhost:50001';
    // const formatProfilePicture = (pic: string | null) => ... ;

    // Construct response using direct database values
    const responseData: any = {
        user_id: user.user_id,
        username: user.username,
        fullname: user.fullname,
        user_type: user.user_type,
        email: user.email,
        phone_number: user.phone_number,
        // location: user.location // Send raw location data if needed
    };

    if (user.artistProfile) {
        responseData.artist = {
            artist_id: user.artistProfile.artist_id,
            bio: user.artistProfile.bio,
            profile_picture: user.artistProfile.profile_picture, // <<< USE DIRECT VALUE
            is_student: user.artistProfile.is_student
        };
    } else {
        responseData.artist = null;
    }

     if (user.employerProfile) {
        responseData.employer = {
            employer_id: user.employerProfile.employer_id,
            bio: user.employerProfile.bio,
            profile_picture: user.employerProfile.profile_picture, // <<< USE DIRECT VALUE
        };
    } else {
         responseData.employer = null;
    }

    res.status(200).json(responseData);

  } catch (error) {
    console.error('❌ Error in getCurrentUser:', error);
    res.status(500).json({ message: 'Internal server error', error: (error as Error).message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET A SPECIFIC USER’S PROFILE BY USER ID
// ─────────────────────────────────────────────────────────────
export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;
        if (!userId || isNaN(parseInt(userId, 10))) { // Validate
            res.status(400).json({ error: "Valid User ID is required" });
            return;
        }

        console.log("📌 Fetching user profile for ID:", userId);

        const user = await User.findOne({
            where: { user_id: userId },
            attributes: ['user_id', 'username', 'fullname', 'user_type'],
            include: [
                {
                    model: Artist,
                    as: 'artistProfile',
                    attributes: ['artist_id', 'bio', 'profile_picture', 'is_student'],
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

        // --- FIX: REMOVED formatPicture function ---
        // const baseURL = process.env.BASE_URL || 'http://localhost:50001';
        // const formatPicture = (pic: string | null) => ... ;

        res.json({
            user_id: user.user_id,
            fullname: user.fullname,
            username: user.username,
            user_type: user.user_type,
            artistProfile: user.artistProfile
                ? {
                    artist_id: user.artistProfile.artist_id,
                    bio: user.artistProfile.bio,
                    profile_picture: user.artistProfile.profile_picture, // <<< USE DIRECT VALUE
                    is_student: user.artistProfile.is_student
                }
                : null,
            employerProfile: user.employerProfile
                ? {
                    employer_id: user.employerProfile.employer_id,
                    bio: user.employerProfile.bio,
                    profile_picture: user.employerProfile.profile_picture, // <<< USE DIRECT VALUE
                }
                : null,
        });
    } catch (error) {
        console.error("❌ Error fetching user profile:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};


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