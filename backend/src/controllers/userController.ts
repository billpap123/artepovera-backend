import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import Artist from '../models/Artist';
import Employer from '../models/Employer';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Like from '../models/Like'; // Assuming you have a 'Like' model
import Notification from '../models/Notification';
import { Op } from 'sequelize';
import Chat from '../models/Chat';
import sequelize from '../config/db'; // Import the Sequelize instance

interface CustomRequest<T = any> extends Request {
  body: T;
  user?: {
    id: number;
    username: string;
    user_type: string;
  };
}

// Toggle a like on a user
export const toggleLike = async (req: CustomRequest, res: Response): Promise<void> => {
  const loggedInUserId = req.user?.id;
  const likedUserId = parseInt(req.params.userId, 10);

  if (!loggedInUserId || !likedUserId) {
    res.status(400).json({ error: 'Invalid request. User IDs are required.' });
    return;
  }

  try {
    const existingLike = await Like.findOne({
      where: { user_id: loggedInUserId, liked_user_id: likedUserId },
    });

    if (existingLike) {
      await existingLike.destroy();
      res.json({ message: 'Like removed' });
    } else {
      await Like.create({ user_id: loggedInUserId, liked_user_id: likedUserId });

      const loggedInUser = await User.findByPk(loggedInUserId, { attributes: ['fullname'] });
      const likedUser = await User.findByPk(likedUserId, { attributes: ['fullname'] });

      // Notify the liked user
      await Notification.create({
        user_id: likedUserId,
        message: `${loggedInUser?.fullname || 'Unknown User'} liked you.`,
        sender_id: loggedInUserId,
      });

      // Check for mutual like
      const mutualLike = await Like.findOne({
        where: { user_id: likedUserId, liked_user_id: loggedInUserId },
      });

      if (mutualLike) {
        let chat = await Chat.findOne({
          where: {
            [Op.or]: [
              { artist_id: loggedInUserId, employer_id: likedUserId },
              { artist_id: likedUserId, employer_id: loggedInUserId },
            ],
          },
        });

        if (!chat) {
          chat = await Chat.create({
            artist_id: loggedInUserId,
            employer_id: likedUserId,
          });
        }

        // Notify both users about the mutual like
        await Notification.create({
          user_id: loggedInUserId,
          message: `You and ${likedUser?.fullname || 'Unknown User'} have a mutual like!`,
          sender_id: likedUserId,
        });

        await Notification.create({
          user_id: likedUserId,
          message: `You and ${loggedInUser?.fullname || 'Unknown User'} have a mutual like!`,
          sender_id: loggedInUserId,
        });

        res.json({ message: 'Mutual like! Chat created.', chat });
      } else {
        res.json({ message: 'Like added' });
      }
    }
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
};

// Check if the current user liked a specific user
export const checkLike = async (req: CustomRequest, res: Response): Promise<void> => {
  const loggedInUserId = req.user?.id;
  const likedUserId = req.params.userId;

  if (!loggedInUserId) {
    res.status(401).json({ error: 'Unauthorized' });
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

// Get the currently logged-in user's data
export const getCurrentUser = async (req: CustomRequest, res: Response) => {
  try {
    console.log('🔹 Decoded user from token:', req.user);
    const userId = req.user?.id;
    if (!userId) {
      res.status(400).json({ message: 'User ID not provided' });
      return;
    }

    const user = await User.findByPk(userId, {
      include: [
        { model: Artist, as: 'artistProfile', attributes: ['artist_id', 'bio', 'profile_picture'], required: false },
        { model: Employer, as: 'employerProfile', attributes: ['employer_id', 'bio', 'profile_picture'], required: false },
      ],
    });

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Use an environment variable for the base URL in production
    const baseURL = process.env.BASE_URL || 'http://localhost:50001';

    const formatProfilePicture = (pic: string | null) =>
      pic ? `${baseURL}/${pic.replace(/^uploads\/uploads\//, 'uploads/')}` : null;

    res.status(200).json({
      user_id: user.user_id,
      username: user.username,
      fullname: user.fullname,
      user_type: user.user_type,
      artist: user.artistProfile
        ? {
            artist_id: user.artistProfile.artist_id,
            bio: user.artistProfile.bio,
            profile_picture: formatProfilePicture(user.artistProfile.profile_picture),
          }
        : null,
      employer: user.employerProfile
        ? {
            employer_id: user.employerProfile.employer_id,
            bio: user.employerProfile.bio,
            profile_picture: formatProfilePicture(user.employerProfile.profile_picture),
          }
        : null,
    });
  } catch (error) {
    console.error('❌ Error in getCurrentUser:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

// Get a specific user's profile by user ID
export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }

    console.log("📌 Fetching user profile for ID:", userId);

    const user = await User.findOne({
      where: { user_id: userId },
      include: [
        {
          model: Artist,
          as: 'artistProfile', // Must match your association name
          attributes: ['artist_id', 'bio', 'profile_picture'],
        },
        {
          model: Employer,
          as: 'employerProfile',
          attributes: ['employer_id', 'bio', 'profile_picture'],
        },
      ],
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const baseURL = process.env.BASE_URL || 'http://localhost:50001';
    const formatPicture = (pic: string | null) =>
      pic ? `${baseURL}/${pic.replace(/^uploads\/uploads\//, 'uploads/')}` : null;

    res.json({
      user_id: user.user_id,
      fullname: user.fullname,
      user_type: user.user_type,
      artistProfile: user.artistProfile
        ? {
            artist_id: user.artistProfile.artist_id,
            bio: user.artistProfile.bio,
            profile_picture: formatPicture(user.artistProfile.profile_picture),
          }
        : null,
      employerProfile: user.employerProfile
        ? {
            employer_id: user.employerProfile.employer_id,
            bio: user.employerProfile.bio,
            profile_picture: formatPicture(user.employerProfile.profile_picture),
          }
        : null,
    });
  } catch (error) {
    console.error("❌ Error fetching user profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get all users' names (for some listing purpose)
export const getUserNames = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.findAll({ attributes: ["user_id", "fullname"] });
    res.json({ users });
  } catch (error) {
    console.error("Error fetching user names:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Log in a user
export const loginUser = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('Request received at /users/login');
    const { email, password } = req.body;
    console.log('Request body:', req.body);

    if (!email || !password) {
      console.log('Email or password missing');
      res.status(400).json({ message: 'Email and password are required.' });
      return;
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      console.log(`User not found for email: ${email}`);
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    console.log('User found:', user);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Invalid password for email:', email);
      res.status(401).json({ message: 'Invalid credentials.' });
      return;
    }

    // Create a JWT
    const token = jwt.sign(
      { id: user.user_id, username: user.username, user_type: user.user_type },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '1h' }
    );

    console.log('Login successful, returning token');

    // If the user is an Employer, find the matching employer row
    let employer_id: number | null = null;
    if (user.user_type === 'Employer') {
      const employer = await Employer.findOne({ where: { user_id: user.user_id } });
      if (employer) {
        employer_id = employer.employer_id;
      }
    }

    res.json({
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        fullname: user.fullname,
        user_type: user.user_type,
        employer_id: employer_id, // Could be null if not an employer or no row found
      },
    });
  } catch (error) {
    console.error('Error in loginUser:', error);
    next(error);
  }
};

// Register a new user and create a profile if user_type is Artist or Employer
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password, fullname, phone_number, user_type, location } = req.body;

    if (!location || !location.coordinates || location.coordinates.length !== 2) {
      res.status(400).json({ message: 'Location is required and must have valid coordinates.' });
      return;
    }

    const [longitude, latitude] = location.coordinates;

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      res.status(409).json({ message: 'Username already exists. Please choose a different username.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      fullname,
      phone_number,
      user_type,
      location: sequelize.literal(`ST_GeomFromText('POINT(${longitude} ${latitude})')`) as any, // ✅ Stores geolocation correctly
    });

    const token = jwt.sign(
      { id: user.user_id, username: user.username, user_type: user.user_type },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '1h' }
    );

    if (user_type === 'Artist') {
      const artist = await Artist.create({ user_id: user.user_id, bio: '', profile_picture: '' });
      res.status(201).json({
        user_id: user.user_id,
        username: user.username,
        user_type: user.user_type,
        artist_id: artist.artist_id,
        token,
      });
    } else if (user_type === 'Employer') {
      const employer = await Employer.create({ user_id: user.user_id, bio: '', profile_picture: '' });
      res.status(201).json({
        user_id: user.user_id,
        username: user.username,
        user_type: user.user_type,
        employer_id: employer.employer_id,
        token,
      });
    } else {
      res.status(400).json({ message: 'Invalid user type' });
    }
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Error creating user' });
  }
};

// Get profiles based on user type (show employers to artists and vice versa)
export const getProfilesByUserType = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const { user_type } = req.user;

    if (user_type === 'Artist') {
      const employers = await Employer.findAll();
      res.status(200).json(employers);
    } else if (user_type === 'Employer') {
      const artists = await Artist.findAll();
      res.status(200).json(artists);
    } else {
      res.status(400).json({ message: 'Invalid user type' });
    }
  } catch (error) {
    console.error('Error fetching profiles by user type:', error);
    res.status(500).json({ message: 'Failed to fetch profiles' });
  }
};

// Update user details
export const updateUser = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { username, email, fullname, phone_number } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    user.username = username || user.username;
    user.email = email || user.email;
    user.fullname = fullname || user.fullname;
    user.phone_number = phone_number || user.phone_number;

    await user.save();
    res.status(200).json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Delete user
export const deleteUser = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
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
