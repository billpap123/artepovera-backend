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
import { pushNotification } from '../utils/socketHelpers';          // ⭐
import { CustomRequest } from '../middleware/authMiddleware'; // κρατάμε ΜΟΝΟ το import

  // --- NEW HELPER FUNCTION ---
// This function creates the standard user object we send to the frontend.
// It guarantees the structure is always the same.
const buildUserResponse = async (userInstance: User) => {
    let artist_id: number | null = null;
    let employer_id: number | null = null;
    let profile_picture: string | null = null;
  
    if (userInstance.user_type === 'Artist') {
      const artist = await Artist.findOne({ where: { user_id: userInstance.user_id } });
      if (artist) {
        artist_id = artist.artist_id;
        profile_picture = artist.profile_picture;
      }
    } else if (userInstance.user_type === 'Employer') {
      const employer = await Employer.findOne({ where: { user_id: userInstance.user_id } });
      if (employer) {
        employer_id = employer.employer_id;
        profile_picture = employer.profile_picture;
      }
    }
  
    return {
      user_id: userInstance.user_id,
      username: userInstance.username,
      fullname: userInstance.fullname,
      user_type: userInstance.user_type,
      profile_picture: profile_picture,
      artist_id: artist_id,
      employer_id: employer_id,
    };
  };
  
// ─────────────────────────────────────────────────────────────
// Like/Unlike a user and create notifications
// ─────────────────────────────────────────────────────────────
export const toggleLike = async (req: CustomRequest, res: Response): Promise<void> => {
    /* ------------------------------------------------------------------ */
    /* 0. Guards                                                          */
    /* ------------------------------------------------------------------ */
    const uid   = req.user?.id;
    const other = Number(req.params.userId);
  
    if (!uid || !other || isNaN(other) || uid === other) {
      res.status(400).json({ error: 'Invalid request.' });
      return;
    }
  
    try {
      /* ---------------------------------------------------------------- */
      /* 1. Fetch user records & any existing like IN PARALLEL            */
      /* ---------------------------------------------------------------- */
      const [me, them, existing] = await Promise.all([
        User.findByPk(uid  , { attributes: ['fullname'] }),
        User.findByPk(other, { attributes: ['fullname'] }),
        Like.findOne({ where: { user_id: uid, liked_user_id: other } }),
      ]);
  
      if (!me || !them) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
  
      /* ---------------------------------------------------------------- */
      /* 2. Unlike ?  -> destroy & exit                                   */
      /* ---------------------------------------------------------------- */
      if (existing) {
        await existing.destroy();
        res.status(200).json({ message: 'Like removed', liked: false });
        return;
      }
  
      /* ---------------------------------------------------------------- */
      /* 3. Create the like  –––> RESPOND EARLY                           */
      /* ---------------------------------------------------------------- */
      await Like.create({ user_id: uid, liked_user_id: other });
  
      // optimistic UI: client gets success in ~80 ms
      res.status(201).json({ message: 'Like added', liked: true });
  
      /* ---------------------------------------------------------------- */
      /* 4. Heavy lifting (runs AFTER response is sent)                   */
      /* ---------------------------------------------------------------- */
      (async () => {
        /* ---- simple like notification -------------------------------- */
        const likeNotif = await Notification.create({
          user_id      : other,
          sender_id    : uid,
          message_key  : 'notifications.newLike',
          message_params: {
            name       : me.fullname,
            profileLink: `/user-profile/${uid}`,
          },
        });
        pushNotification(req.io!, req.onlineUsers!, other, likeNotif.toJSON());
  
        /* ---- mutual? -------------------------------------------------- */
        const mutual = await Like.findOne({
          where: { user_id: other, liked_user_id: uid },
        });
        if (!mutual) return;                       // nothing more to do
  
        /* ---- get / create chat --------------------------------------- */
        const [u1, u2] = [uid, other].sort((a, b) => a - b);
        const [chat]   = await Chat.findOrCreate({
          where   : { user1_id: u1, user2_id: u2 },
          defaults: { user1_id: u1, user2_id: u2 },
        });
        const frontendURL = process.env.FRONTEND_URL
                         || 'https://artepovera2.vercel.app';
        const chatLink = `${frontendURL}/chat?open=${chat.chat_id}`;
  
        /* ---- two “match” notifications ------------------------------- */
        const [notifToOther, notifToMe] = await Promise.all([
          Notification.create({
            user_id      : other,
            sender_id    : uid,
            message_key  : 'notifications.newMatch',
            message_params: { name: me.fullname,  chatLink },
          }),
          Notification.create({
            user_id      : uid,
            sender_id    : other,
            message_key  : 'notifications.newMatch',
            message_params: { name: them.fullname, chatLink },
          }),
        ]);
  
        pushNotification(req.io!, req.onlineUsers!, other, notifToOther.toJSON());
        pushNotification(req.io!, req.onlineUsers!, uid  , notifToMe  .toJSON());
  
        /* ---- build enriched notif for *my* side, push via socket ----- */
        const fullNotif = {
          notification_id: notifToMe.notification_id,
          message_key    : notifToMe.message_key,
          message_params : notifToMe.message_params,
          createdAt      : notifToMe.createdAt,
          read_status    : notifToMe.read_status,
          sender         : {
            user_id        : other,
            fullname       : them.fullname,
            profile_picture: null,     // fill from Artist/Employer if you need it
          },
        };
        pushNotification(req.io!, req.onlineUsers!, uid, fullNotif);
      })();
    } catch (err) {
      console.error('❌ Error toggling like:', err);
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

        const user = await User.findOne({ where: { email } });

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
            { expiresIn: '1h' } // Consider a longer expiry
        );

        // Use the new helper function to build a consistent response
        const userResponse = await buildUserResponse(user);
        console.log("!!!!!!!! BACKEND is sending this user object after LOGIN:", userResponse);

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

       // The transaction is perfect, keep it. We just change what happens after.
       const newUser = await sequelize.transaction(async (t) => {
           const user = await User.create({
             username, email, password: hashedPassword, fullname, phone_number, user_type,
             location: location ? { type: 'Point', coordinates: location.coordinates } : null,
           }, { transaction: t });

           if (user_type === 'Artist') {
             await Artist.create({ user_id: user.user_id, bio: '', profile_picture: null, is_student: !!isStudent }, { transaction: t });
           } else if (user_type === 'Employer') {
             await Employer.create({ user_id: user.user_id, bio: '', profile_picture: null }, { transaction: t });
           } else { throw new Error('Invalid user type specified during profile creation.'); }

           // The transaction only returns the user instance
           return user;
       });

       // After the transaction is successful, generate the token and response
       const token = jwt.sign(
           { id: newUser.user_id, username: newUser.username, user_type: newUser.user_type },
           process.env.JWT_SECRET || 'default_secret',
           { expiresIn: '1h' }
       );

       // Use the new helper function to build a consistent response
       const userResponse = await buildUserResponse(newUser);
       console.log("!!!!!!!! BACKEND is sending this user object after REGISTER:", userResponse);

       
       res.status(201).json({ token, user: userResponse });

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



// ─────────────────────────────────────────────────────────────
//                ACCOUNT MANAGEMENT FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Updates the logged-in user's email after verifying their current password.
 */
export const updateUserEmail = async (req: CustomRequest, res: Response): Promise<void> => {
    const loggedInUserId = req.user?.id;
    const { currentPassword, newEmail } = req.body;

    if (!loggedInUserId) {
        res.status(401).json({ message: 'Unauthorized.' });
        return;
    }
    if (!currentPassword || !newEmail) {
        res.status(400).json({ message: 'Current password and new email are required.' });
        return;
    }

    try {
        const user = await User.findByPk(loggedInUserId);
        if (!user) {
            res.status(404).json({ message: 'User not found.' });
            return;
        }

        // 1. Verify the current password
        const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordCorrect) {
            res.status(401).json({ message: 'Incorrect current password.' });
            return;
        }

        // 2. Check if the new email is already in use
        if (newEmail === user.email) {
            res.status(400).json({ message: 'New email cannot be the same as the current email.' });
            return;
        }
        const existingUser = await User.findOne({ where: { email: newEmail } });
        if (existingUser) {
            res.status(409).json({ message: 'This email is already in use by another account.' });
            return;
        }

        // 3. Update the email
        user.email = newEmail;
        await user.save();

        res.status(200).json({ message: 'Email updated successfully.' });

    } catch (error) {
        console.error('Error updating email:', error);
        res.status(500).json({ message: 'An internal error occurred while updating the email.' });
    }
};

/**
 * Updates the logged-in user's password after verifying their current password.
 */
export const updateUserPassword = async (req: CustomRequest, res: Response): Promise<void> => {
    const loggedInUserId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!loggedInUserId) {
        res.status(401).json({ message: 'Unauthorized.' });
        return;
    }
    if (!currentPassword || !newPassword) {
        res.status(400).json({ message: 'Current password and new password are required.' });
        return;
    }
    if (newPassword.length < 6) {
        res.status(400).json({ message: 'New password must be at least 6 characters long.' });
        return;
    }

    try {
        const user = await User.findByPk(loggedInUserId);
        if (!user) {
            res.status(404).json({ message: 'User not found.' });
            return;
        }

        // 1. Verify the current password
        const isPasswordCorrect = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordCorrect) {
            res.status(401).json({ message: 'Incorrect current password.' });
            return;
        }

        // 2. Hash the new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // 3. Update the password
        user.password = hashedNewPassword;
        await user.save();

        res.status(200).json({ message: 'Password updated successfully.' });

    } catch (error) {
        console.error('Error updating password:', error);
        res.status(500).json({ message: 'An internal error occurred while updating the password.' });
    }
};

/**
 * Deletes the logged-in user's own account after verifying their password.
 */
export const deleteOwnAccount = async (req: CustomRequest, res: Response): Promise<void> => {
    const loggedInUserId = req.user?.id;
    const { password } = req.body;

    if (!loggedInUserId) {
        res.status(401).json({ message: 'Unauthorized.' });
        return;
    }
    if (!password) {
        res.status(400).json({ message: 'Password confirmation is required to delete your account.' });
        return;
    }

    try {
        const user = await User.findByPk(loggedInUserId);
        if (!user) {
            res.status(404).json({ message: 'User not found.' });
            return;
        }

        // 1. Verify the password to confirm deletion
        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            res.status(401).json({ message: 'Incorrect password. Account deletion cancelled.' });
            return;
        }

        // 2. Delete the user
        // Sequelize's `destroy` with hooks/cascades (if set up) will handle related data.
        await user.destroy();

        res.status(200).json({ message: 'Your account has been permanently deleted.' });

    } catch (error) {
        console.error('Error deleting own account:', error);
        res.status(500).json({ message: 'An internal error occurred while deleting the account.' });
    }
};
