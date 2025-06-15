import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import Artist from '../models/Artist';
import Employer from '../models/Employer';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Like from '../models/Like';
import Notification from '../models/Notification';
import Chat from '../models/Chat';
import sequelize from '../config/db';

interface CustomRequest<T = any> extends Request {
  body: T;
  user?: {
    id: number;
    username: string;
    user_type: string;
  };
}

// ─────────────────────────────────────────────────────────────
// Like/Unlike a user and create notifications
// ─────────────────────────────────────────────────────────────
export const toggleLike = async (req: CustomRequest, res: Response): Promise<void> => {
    const loggedInUserId = req.user?.id;
    const likedUserId = parseInt(req.params.userId, 10);

    if (!loggedInUserId || !likedUserId || isNaN(likedUserId) || loggedInUserId === likedUserId) {
        res.status(400).json({ error: 'Invalid request.' });
        return;
    }

    try {
        // --- FIX STEP 1: Get the names of both users first ---
        const loggedInUser = await User.findByPk(loggedInUserId, { attributes: ['fullname'] });
        const likedUser = await User.findByPk(likedUserId, { attributes: ['fullname'] });

        if (!loggedInUser || !likedUser) {
            res.status(404).json({ error: 'User not found.' });
            return;
        }

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

        // --- FIX STEP 2: Add 'name' to the "newLike" notification ---
        await Notification.create({
            user_id: likedUserId,
            sender_id: loggedInUserId,
            message_key: 'notifications.newLike',
            message_params: { name: loggedInUser.fullname } // <-- ADDED
        });

        const mutualLike = await Like.findOne({
            where: { user_id: likedUserId, liked_user_id: loggedInUserId },
        });

        if (!mutualLike) {
            res.status(201).json({ message: 'Like added', liked: true });
            return;
        }
        
        const user1 = Math.min(loggedInUserId, likedUserId);
        const user2 = Math.max(loggedInUserId, likedUserId);

        const [chat] = await Chat.findOrCreate({
            where: { user1_id: user1, user2_id: user2 },
            defaults: { user1_id: user1, user2_id: user2 }
        });
        
        const chatLink = `${frontendUrl}/chat?open=${chat.chat_id}`;
        
        // --- FIX STEP 3: Add 'name' to the "newMatch" notifications ---
        
        // Notification for the user who was liked (sender is the logged-in user)
        await Notification.create({ 
            user_id: likedUserId, 
            sender_id: loggedInUserId,
            message_key: 'notifications.newMatch',
            message_params: { name: loggedInUser.fullname, chatLink } // <-- ADDED NAME
        });
        
        // Notification for the user who initiated the like (sender is the liked user)
        const loggedInUserMatchNotification = await Notification.create({
            user_id: loggedInUserId,
            sender_id: likedUserId,
            message_key: 'notifications.newMatch',
            message_params: { name: likedUser.fullname, chatLink } // <-- ADDED NAME
        });
        
        const notificationWithDetails = await Notification.findByPk(loggedInUserMatchNotification.notification_id, {
            include: [{
                model: User,
                as: 'sender',
                attributes: ['user_id', 'fullname'],
                include: [
                    { model: Artist, as: 'artistProfile', attributes: ['profile_picture'], required: false },
                    { model: Employer, as: 'employerProfile', attributes: ['profile_picture'], required: false }
                ]
            }]
        });

        const newNotificationForClient = notificationWithDetails ? {
            notification_id: notificationWithDetails.notification_id,
            message_key: notificationWithDetails.message_key,
            message_params: notificationWithDetails.message_params,
            createdAt: notificationWithDetails.createdAt,
            read_status: notificationWithDetails.read_status,
            sender: {
                user_id: notificationWithDetails.sender?.user_id,
                fullname: notificationWithDetails.sender?.fullname,
                profile_picture: notificationWithDetails.sender?.artistProfile?.profile_picture || notificationWithDetails.sender?.employerProfile?.profile_picture || null
            }
        } : null;

        res.status(201).json({
            message: 'Like added (mutual match detected!).',
            liked: true,
            chat_id: chat.chat_id,
            newNotification: newNotificationForClient
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
    if (!likedUserId || isNaN(parseInt(likedUserId, 10))) {
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
            attributes: ['artist_id', 'bio', 'profile_picture', 'is_student', 'cv_url', 'cv_public_id'],
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
  
      const responseData: any = {
          user_id: user.user_id,
          username: user.username,
          fullname: user.fullname,
          user_type: user.user_type,
          email: user.email,
          phone_number: user.phone_number,
      };
  
      if (user.artistProfile) {
          responseData.artist = user.artistProfile;
      } else {
          responseData.artist = null;
      }
  
       if (user.employerProfile) {
          responseData.employer = user.employerProfile;
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
        const numericUserId = parseInt(userId, 10);
        if (!userId || isNaN(numericUserId)) {
            res.status(400).json({ error: "Valid User ID is required" });
            return;
        }

        const user = await User.findOne({
            where: { user_id: numericUserId },
            attributes: ['user_id', 'username', 'fullname', 'user_type'],
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
            artistProfile: user.artistProfile || null,
            employerProfile: user.employerProfile || null,
        };

        res.json(responseData);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: "Failed to fetch user profile." });
     }
};

// ─────────────────────────────────────────────────────────────
// Other Controller Functions
// ─────────────────────────────────────────────────────────────
export const getUserNames = async (req: Request, res: Response): Promise<void> => {
    try {
        const users = await User.findAll({ attributes: ["user_id", "fullname"] });
        res.json({ users });
    } catch (error) {
        console.error("Error fetching user names:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

export const loginUser = async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ message: 'Email and password are required.' }); return;
        }

        const user = await User.findOne({
            where: { email },
            include: [
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

        const userResponse = {
            user_id: user.user_id,
            username: user.username,
            fullname: user.fullname,
            user_type: user.user_type,
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
     try {
        const { username, email, password, fullname, phone_number, user_type, location, isStudent } = req.body;
        if (!username || !email || !password || !fullname || !user_type) {
             res.status(400).json({ message: 'Username, email, password, fullname, and user type are required.' }); return;
        }
        if (location && (!location.coordinates || !Array.isArray(location.coordinates) || location.coordinates.length !== 2)) {
            res.status(400).json({ message: 'Location must be in a valid GeoJSON Point format.' }); return;
        }
        const existingUserByEmail = await User.findOne({ where: { email } });
        if (existingUserByEmail) { res.status(409).json({ message: 'Email already in use.' }); return; }
        const existingUserByUsername = await User.findOne({ where: { username } });
         if (existingUserByUsername) { res.status(409).json({ message: 'Username already exists.' }); return; }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await sequelize.transaction(async (t) => {
            const user = await User.create({
              username, email, password: hashedPassword, fullname, phone_number, user_type,
              location: location ? { type: 'Point', coordinates: location.coordinates } : null,
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
    try {
        const user_type = req.user?.user_type;
        if (user_type === 'Artist') {
            const employers = await Employer.findAll({ include: [{ model: User, attributes: ['fullname'] }] });
            res.status(200).json(employers);
        } else if (user_type === 'Employer') {
            const artists = await Artist.findAll({ include: [{ model: User, attributes: ['fullname'] }] });
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
    try {
        const userIdToUpdate = req.params.id;
        const loggedInUserId = req.user?.id;

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
        res.status(200).json({
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

        await user.destroy();
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
