/* -------------------------------------------------------------------------- */
/* src/controllers/chat.controller.ts                                         */
/* -------------------------------------------------------------------------- */

import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Chat from '../models/Chat';
import Message from '../models/Message';
import User from '../models/User';
import { CustomRequest } from '../middleware/authMiddleware'; // Make sure this is imported
import Artist from "../models/Artist";
import Employer from "../models/Employer";
/* -------------------------------------------------------------------------- */
/* CREATE CHAT                                                                 */
/* -------------------------------------------------------------------------- */
// POST /api/chats
// Body: { user1_id: number, user2_id: number } // Expects two USER IDs
// Backend will determine who is artist and employer and use their respective profile IDs.
export const createChat = async (req: Request, res: Response): Promise<void> => {
  try {
    // Renamed for clarity, these are USER IDs from the request body
    const { user1_id, user2_id } = req.body;

    if (!user1_id || !user2_id) {
      return void res.status(400).json({
        message: 'Two user IDs (user1_id, user2_id) are required.',
      });
    }
    if (user1_id === user2_id) {
        return void res.status(400).json({ message: 'Cannot create a chat with oneself.'});
    }

    // 1) Check if both users actually exist and get their types
    const [user1, user2] = await Promise.all([
      User.findByPk(user1_id, { attributes: ['user_id', 'user_type'] }),
      User.findByPk(user2_id, { attributes: ['user_id', 'user_type'] }),
    ]);

    if (!user1 || !user2) {
      return void res
        .status(404)
        .json({ message: 'One or both user IDs not found in users table.' });
    }

    // 2) Determine who is the artist and who is the employer
    let artistUser_actualId: number | null = null;     // This will hold the user_id of the artist
    let employerUser_actualId: number | null = null;   // This will hold the user_id of the employer

    if (user1.user_type === 'Artist' && user2.user_type === 'Employer') {
        artistUser_actualId = user1.user_id;
        employerUser_actualId = user2.user_id;
    } else if (user1.user_type === 'Employer' && user2.user_type === 'Artist') {
        artistUser_actualId = user2.user_id;
        employerUser_actualId = user1.user_id;
    } else {
        return void res.status(400).json({
            message: 'Chat creation requires one Artist and one Employer.',
        });
    }

    // 3) Fetch the actual artist_id and employer_id from their respective profile tables
    const artistProfile = await Artist.findOne({ where: { user_id: artistUser_actualId }, attributes: ['artist_id'] });
    const employerProfile = await Employer.findOne({ where: { user_id: employerUser_actualId }, attributes: ['employer_id'] });

    if (!artistProfile || !employerProfile) {
        return void res.status(404).json({ message: 'Artist or Employer profile not found for the given user IDs.' });
    }

    const actualArtistProfileId = artistProfile.artist_id;
    const actualEmployerProfileId = employerProfile.employer_id;

    // 4) Check if a Chat already exists with these *actual* profile IDs
    // Remember Chat model maps artist_user_id to artist_id and employer_user_id to employer_id
    const existingChat = await Chat.findOne({
      where: {
        // Use the model attribute names, which will map to DB columns artist_id and employer_id
        artist_user_id: actualArtistProfileId,
        employer_user_id: actualEmployerProfileId,
      },
    });

    if (existingChat) {
      return void res.status(200).json({
        message: 'Chat already exists.',
        chat: existingChat,
      });
    }

    // 5) Create the chat row using the actual profile IDs
    const chat = await Chat.create({
      // Use the model attribute names
      artist_user_id: actualArtistProfileId,
      employer_user_id: actualEmployerProfileId,
      // message_count, artist_rating_status, employer_rating_status will use defaults
    });

    return void res.status(201).json({
      message: 'Chat created successfully.',
      chat,
    });
  } catch (error) {
    console.error('❌ Error creating chat:', error);
    return void res.status(500).json({ message: 'Failed to create chat.' });
  }
};

/* -------------------------------------------------------------------------- */
/* SEND A MESSAGE                                                              */
/* -------------------------------------------------------------------------- */
// POST /api/chats/send
// Body: { chat_id, sender_id, message }
// We figure out the receiver by checking if sender_id matches artist_user_id or employer_user_id.
/* -------------------------------------------------------------------------- */
/* SEND A MESSAGE                                                              */
/* -------------------------------------------------------------------------- */
// POST /api/chats/send
// Body: { chat_id, sender_id, message }
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { chat_id, sender_id, message } = req.body;

    if (!chat_id || !sender_id || !message?.trim()) {
      return void res.status(400).json({
        message: 'Missing chat_id, sender_id, or message.',
      });
    }

    // 1) Fetch the chat
    // Ensure your Chat model has the message_count, artist_rating_status, employer_rating_status fields defined
    const chat = await Chat.findByPk(chat_id);
    if (!chat) {
      return void res.status(404).json({ message: 'Chat not found.' });
    }

    // 2) Determine the receiver
    let receiver_id: number;
    // Ensure sender_id is treated as a number for strict comparison
    const numericSenderId = Number(sender_id);
    if (chat.artist_user_id === numericSenderId) {
      receiver_id = chat.employer_user_id;
    } else if (chat.employer_user_id === numericSenderId) {
      receiver_id = chat.artist_user_id;
    } else {
      console.warn(`Sender ID ${sender_id} (type: ${typeof sender_id}) did not match chat participants ${chat.artist_user_id} or ${chat.employer_user_id}`);
      return void res
        .status(403)
        .json({ message: 'Sender is not part of this chat.' });
    }

    // 3) Verify the sender actually exists
    const sender = await User.findByPk(numericSenderId);
    if (!sender) {
      return void res
        .status(404)
        .json({ message: 'Sender user does not exist.' });
    }

    // 4) Create the message
    const newMessage = await Message.create({
      chat_id,
      sender_id: numericSenderId, // Use numeric ID
      receiver_id,
      message: message.trim(), // Trim message whitespace
    });

    // --- ADDED: Increment message count ---
    // This happens after the message is successfully saved
    try {
        // Use the 'chat' instance we already fetched
        await chat.increment('message_count', { by: 1 });
        console.log(`[Chat ${chat_id}] Message count incremented to ${chat.message_count + 1}.`); // Log new potential count
    } catch (countError) {
        // Log the error but don't fail the message sending response
        console.error(`[Chat ${chat_id}] Failed to increment message count:`, countError);
    }
    // --- END ADDITION ---

    // 5) Send successful response (including the message just sent)
    return void res.status(201).json({
      message: 'Message sent successfully',
      data: newMessage, // Return the created message object
    });
  } catch (error) {
    console.error('❌ Error in sendMessage:', error);
    return void res
      .status(500)
      .json({ message: 'Internal server error.' });
  }
};

/* -------------------------------------------------------------------------- */
/* GET CHAT HISTORY                                                            */
/* -------------------------------------------------------------------------- */
// GET /api/chats/:chat_id/messages
// Return all messages in ascending order for the given chat
export const getChatHistory = async (req: Request, res: Response): Promise<void> => {
  const { chat_id } = req.params;

  try {
    // 1) Ensure the chat exists
    const chat = await Chat.findByPk(chat_id);
    if (!chat) {
      return void res.status(404).json({ message: 'Chat not found.' });
    }

    // 2) Fetch messages in ascending order
    const messages = await Message.findAll({
      where: { chat_id },
      order: [['created_at', 'ASC']],
      include: [
        {
          model: User,
          as: 'messageSender',
          attributes: ['user_id', 'fullname'],
        },
        {
          model: User,
          as: 'messageReceiver',
          attributes: ['user_id', 'fullname'],
        },
      ],
    });

    if (!messages.length) {
      return void res
        .status(200)
        .json({ message: 'No messages yet.', messages: [] });
    }

    return void res.status(200).json({ messages });
  } catch (error) {
    console.error('❌ Error fetching chat history:', error);
    return void res
      .status(500)
      .json({ message: 'Failed to fetch chat history.' });
  }
};

/* -------------------------------------------------------------------------- */
/* FETCH CHATS FOR A USER                                                      */
/* -------------------------------------------------------------------------- */
// GET /api/chats/user/:user_id
// We find all Chat rows where (artist_user_id = user_id) OR (employer_user_id = user_id),
// then optionally include the other user’s name.
/* -------------------------------------------------------------------------- */
/* FETCH CHATS FOR A USER                                                      */
/* -------------------------------------------------------------------------- */
// GET /api/chats/user/:user_id
// This should probably use req.user.id if the route is authenticated for "my chats"
export const fetchMessages = async (req: CustomRequest, res: Response): Promise<void> => {
  // Use the authenticated user's ID if this route is for the logged-in user
  // If it's meant to be public for any user_id, then req.params.user_id is fine,
  // but the route might need to be public or have different auth.
  // Let's assume it's for the logged-in user based on typical chat list needs.
  const loggedInUserId = req.user?.id;

  if (!loggedInUserId) {
    // This case should ideally be caught by the 'authenticate' middleware
    return void res.status(401).json({ message: 'Unauthorized: User not logged in.' });
  }

  try {
    // 1. Find the artist and employer profiles for the logged-in user
    const userWithProfiles = await User.findByPk(loggedInUserId, {
      include: [
        { model: Artist, as: 'artistProfile', attributes: ['artist_id'] },
        { model: Employer, as: 'employerProfile', attributes: ['employer_id'] },
      ],
    });

    if (!userWithProfiles) {
      // This should be very rare if the user ID comes from a valid token
      return void res.status(404).json({ message: 'User not found.' });
    }

    const artistProfileId = userWithProfiles.artistProfile?.artist_id;
    const employerProfileId = userWithProfiles.employerProfile?.employer_id;

    // 2. --- DECLARE AND BUILD whereClause ---
    const whereClause: any[] = []; // Initialize as an empty array
    if (artistProfileId) {
      // Model attribute is artist_user_id, which maps to DB column artist_id
      whereClause.push({ artist_user_id: artistProfileId });
    }
    if (employerProfileId) {
      // Model attribute is employer_user_id, which maps to DB column employer_id
      whereClause.push({ employer_user_id: employerProfileId });
    }
    // --- END DECLARE AND BUILD whereClause ---

    if (whereClause.length === 0) {
      // This means the user is neither an artist nor an employer with a profile,
      // or has no profile IDs. They shouldn't have any chats of this type.
      console.log(`[FETCH CHATS] User ${loggedInUserId} has no artist or employer profile ID to query chats.`);
      return void res.status(200).json({ message: 'No artist or employer profile associated with this user to fetch chats.', chats: [] });
    }

    // 3. Find all Chat rows matching the user's profile IDs
    const chats = await Chat.findAll({
      where: { [Op.or]: whereClause }, // Use the constructed whereClause
      include: [
        {
          model: Artist,
          as: 'chatArtistProfile', // From Chat.belongsTo(Artist, { as: 'chatArtistProfile' })
          attributes: ['artist_id'],
          include: [{
            model: User,
            as: 'user', // From Artist.belongsTo(User, { as: 'user' })
            attributes: ['user_id', 'fullname', 'profile_picture'],
          }],
          required: false, // Use LEFT JOIN
        },
        {
          model: Employer,
          as: 'chatEmployerProfile', // From Chat.belongsTo(Employer, { as: 'chatEmployerProfile' })
          attributes: ['employer_id'],
          include: [{
            model: User,
            as: 'user', // From Employer.belongsTo(User, { as: 'user' })
            attributes: ['user_id', 'fullname', 'profile_picture'],
          }],
          required: false, // Use LEFT JOIN
        },
      ],
      order: [['updated_at', 'DESC']], // Order by most recently updated chat
    });

    console.log(`[FETCH CHATS] Found ${chats.length} chats for user ${loggedInUserId}`);

    // 4. Transform the data to clearly show "other user" details
    const formattedChats = chats.map(chat => {
        const chatJson = chat.toJSON() as any;
        let otherUser = null;
        let chatName = 'Chat'; // Default chat name

        // Determine who the "other user" is based on the loggedInUserId
        if (chatJson.chatArtistProfile?.user?.user_id === loggedInUserId) {
            // Logged-in user is the artist, so the other user is the employer
            otherUser = chatJson.chatEmployerProfile?.user;
            chatName = otherUser?.fullname || 'Chat with Employer';
        } else if (chatJson.chatEmployerProfile?.user?.user_id === loggedInUserId) {
            // Logged-in user is the employer, so the other user is the artist
            otherUser = chatJson.chatArtistProfile?.user;
            chatName = otherUser?.fullname || 'Chat with Artist';
        } else {
            // This case might occur if a chat somehow doesn't involve the loggedInUserId as one of the expected roles
            // Or if includes didn't return expected data. It's good to log this.
            console.warn(`[FETCH CHATS] Could not determine other user for chat_id: ${chatJson.chat_id}. Artist user: ${chatJson.chatArtistProfile?.user?.user_id}, Employer user: ${chatJson.chatEmployerProfile?.user?.user_id}`);
            if (chatJson.chatArtistProfile?.user) otherUser = chatJson.chatArtistProfile.user;
            else if (chatJson.chatEmployerProfile?.user) otherUser = chatJson.chatEmployerProfile.user;
            chatName = otherUser?.fullname || "Chat";
        }

        return {
            chat_id: chatJson.chat_id,
            // Include other direct chat fields if needed by frontend list view
            message_count: chatJson.message_count,
            artist_rating_status: chatJson.artist_rating_status,
            employer_rating_status: chatJson.employer_rating_status,
            created_at: chatJson.created_at,
            updated_at: chatJson.updated_at,
            // Simplified 'otherUser' object
            otherUser: otherUser ? {
                user_id: otherUser.user_id,
                fullname: otherUser.fullname,
                profile_picture: otherUser.profile_picture
            } : null,
            chatName: chatName // For easy display on frontend chat list
        };
    });

    if (!formattedChats.length) {
      return void res.status(200).json({ message: 'No chats found for this user.', chats: [] });
    }

    return void res.status(200).json({ chats: formattedChats });

  } catch (error) {
    console.error(`Error fetching chats for user ${req.user?.id || req.params.user_id}:`, error);
    return void res.status(500).json({ message: 'Failed to fetch chats.' });
  }
};


/* -------------------------------------------------------------------------- */
/* GET RATING PROMPT STATUS                                                    */
/* -------------------------------------------------------------------------- */
// GET /api/chats/:chat_id/rating-status
// Checks if the logged-in user should be prompted to rate the other user in this chat.
export const getRatingPromptStatus = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
      const { chat_id } = req.params;
      const userId = req.user?.id; // Logged-in user ID from token

      if (!userId) {
          return void res.status(401).json({ message: 'Unauthorized: User ID missing.' });
      }
      if (!chat_id || isNaN(parseInt(chat_id, 10))) {
          return void res.status(400).json({ message: 'Invalid chat ID.' });
      }

      const chatIdNum = parseInt(chat_id, 10);

      const chat = await Chat.findByPk(chatIdNum);
      if (!chat) {
          return void res.status(404).json({ message: 'Chat not found.' });
      }

      // Determine which status field belongs to the current user
      let userStatusField: 'artist_rating_status' | 'employer_rating_status' | null = null;
      if (chat.artist_user_id === userId) {
          userStatusField = 'artist_rating_status';
      } else if (chat.employer_user_id === userId) {
          userStatusField = 'employer_rating_status';
      } else {
          // Should not happen if authentication is correct, but good practice to check
          return void res.status(403).json({ message: 'User is not a participant in this chat.' });
      }

      const currentUserStatus = chat[userStatusField];
      const messageCount = chat.message_count;

      let showPrompt = false;
      let level = 0;

      // Check conditions based on status and message count
      if (currentUserStatus === 'pending' && messageCount >= 10) {
          showPrompt = true;
          level = 10;
      } else if (currentUserStatus === 'prompted_10' && messageCount >= 20) {
          // User clicked 'Maybe Later' at 10 messages, prompt again at 20
          showPrompt = true;
          level = 20;
      }

      console.log(`[Rating Prompt Check] Chat: ${chatIdNum}, User: ${userId}, Count: ${messageCount}, Status: ${currentUserStatus}, Show: ${showPrompt}`);
      return void res.status(200).json({ showPrompt, level });

  } catch (error) {
      console.error(`❌ Error getting rating prompt status for chat ${req.params.chat_id}:`, error);
      return void res.status(500).json({ message: 'Internal server error.' });
  }
};


/* -------------------------------------------------------------------------- */
/* UPDATE RATING PROMPT STATUS                                                 */
/* -------------------------------------------------------------------------- */
// PUT /api/chats/:chat_id/rating-status
// Body: { action: 'maybe_later' | 'declined' }
// Updates the user's rating status based on their interaction with the prompt.
export const updateRatingPromptStatus = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
      const { chat_id } = req.params;
      const userId = req.user?.id; // Logged-in user ID
      const { action } = req.body; // 'maybe_later' or 'declined'

      // --- Validation ---
      if (!userId) {
          return void res.status(401).json({ message: 'Unauthorized: User ID missing.' });
      }
      if (!chat_id || isNaN(parseInt(chat_id, 10))) {
          return void res.status(400).json({ message: 'Invalid chat ID.' });
      }
      if (!action || (action !== 'maybe_later' && action !== 'declined')) {
          return void res.status(400).json({ message: 'Invalid action specified. Use "maybe_later" or "declined".' });
      }
      // --- End Validation ---

      const chatIdNum = parseInt(chat_id, 10);
      const chat = await Chat.findByPk(chatIdNum);
      if (!chat) {
          return void res.status(404).json({ message: 'Chat not found.' });
      }

      // Determine which status field to update
      let userStatusField: 'artist_rating_status' | 'employer_rating_status' | null = null;
      if (chat.artist_user_id === userId) {
          userStatusField = 'artist_rating_status';
      } else if (chat.employer_user_id === userId) {
          userStatusField = 'employer_rating_status';
      } else {
          return void res.status(403).json({ message: 'User is not a participant in this chat.' });
      }

      const currentStatus = chat[userStatusField];
      let newStatus: typeof currentStatus | null = null;

      // Determine the new status based on action and current status
      if (action === 'declined') {
          // If user declines, mark as declined regardless of current state (unless completed)
          if (currentStatus !== 'completed') {
               newStatus = 'declined';
          }
      } else if (action === 'maybe_later') {
          if (currentStatus === 'pending') {
              newStatus = 'prompted_10'; // They deferred the first prompt
          } else if (currentStatus === 'prompted_10') {
              newStatus = 'prompted_20'; // They deferred the second prompt
          }
          // If already prompted_20, declined, or completed, 'maybe_later' does nothing further
      }

      // Only update if the status needs changing
      if (newStatus && newStatus !== currentStatus) {
          try {
              await chat.update({ [userStatusField]: newStatus });
              console.log(`[Rating Status Update] Chat: ${chatIdNum}, User: ${userId}, Status updated to: ${newStatus}`);
              return void res.status(200).json({ message: 'Rating prompt status updated.', newStatus: newStatus });
          } catch(updateError) {
               console.error(`[Rating Status Update] Failed to update status for Chat ${chatIdNum}, User ${userId}:`, updateError);
               // Let generic error handler catch this
               throw updateError;
          }
      } else {
          console.log(`[Rating Status Update] No status change needed for Chat: ${chatIdNum}, User: ${userId}, Action: ${action}, Current Status: ${currentStatus}`);
          return void res.status(200).json({ message: 'No status change applied.', currentStatus: currentStatus });
      }

  } catch (error) {
      console.error(`❌ Error updating rating prompt status for chat ${req.params.chat_id}:`, error);
      return void res.status(500).json({ message: 'Internal server error.' });
  }
};
