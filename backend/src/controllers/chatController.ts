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

// src/controllers/chat.controller.ts
// Ensure all necessary imports are at the top:
// import { Request, Response } from 'express';
// import Chat from '../models/Chat';
// import Message from '../models/Message';
// import User from '../models/User';
// import Artist from '../models/Artist';
// import Employer from '../models/Employer';

export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { chat_id, sender_id, message } = req.body;

    if (!chat_id || !sender_id || !message?.trim()) {
      return void res.status(400).json({
        message: 'Missing chat_id, sender_id, or message.',
      });
    }

    const numericChatId = parseInt(chat_id, 10);
    const numericSenderId = parseInt(sender_id, 10); // This is a User.user_id

    if (isNaN(numericChatId) || isNaN(numericSenderId)) {
        return void res.status(400).json({ message: 'chat_id and sender_id must be valid numbers.' });
    }

    const chat = await Chat.findByPk(numericChatId);
    if (!chat) {
      return void res.status(404).json({ message: 'Chat not found.' });
    }

    // Fetch the sender's User model along with their Artist/Employer profile IDs
    const senderUserWithProfiles = await User.findByPk(numericSenderId, {
      include: [
        { model: Artist, as: 'artistProfile', attributes: ['artist_id'] }, // Get sender's artist_id
        { model: Employer, as: 'employerProfile', attributes: ['employer_id'] } // Get sender's employer_id
      ]
    });

    if (!senderUserWithProfiles) {
      return void res.status(404).json({ message: 'Sender user not found.' });
    }

    let receiver_user_id: number; // This needs to be the User.user_id of the recipient

    // chat.artist_user_id stores an Artist.artist_id (PK of artists table)
    // chat.employer_user_id stores an Employer.employer_id (PK of employers table)

    // Check if the SENDER is the ARTIST associated with THIS CHAT
    if (senderUserWithProfiles.artistProfile && chat.artist_user_id === senderUserWithProfiles.artistProfile.artist_id) {
      // Sender is the Artist participant in this chat. Receiver is the Employer's User.
      const employerProfileInChat = await Employer.findByPk(chat.employer_user_id, {
        attributes: ['user_id'] // We need the user_id associated with this employer profile
      });
      if (!employerProfileInChat) {
        console.error(`Chat ${numericChatId}: Could not find Employer profile for employer_id ${chat.employer_user_id}`);
        return void res.status(404).json({ message: "Chat partner (Employer profile) not found for this chat." });
      }
      receiver_user_id = employerProfileInChat.user_id;
    }
    // Check if the SENDER is the EMPLOYER associated with THIS CHAT
    else if (senderUserWithProfiles.employerProfile && chat.employer_user_id === senderUserWithProfiles.employerProfile.employer_id) {
      // Sender is the Employer participant in this chat. Receiver is the Artist's User.
      const artistProfileInChat = await Artist.findByPk(chat.artist_user_id, {
        attributes: ['user_id'] // We need the user_id associated with this artist profile
      });
      if (!artistProfileInChat) {
        console.error(`Chat ${numericChatId}: Could not find Artist profile for artist_id ${chat.artist_user_id}`);
        return void res.status(404).json({ message: 'Chat partner (Artist profile) not found for this chat.' });
      }
      receiver_user_id = artistProfileInChat.user_id;
    } else {
      // Sender (User.user_id = numericSenderId) is not the artist OR the employer specifically linked to this chat.
      console.warn(`Sender User ID ${numericSenderId} is not an active artist or employer participant in chat ${numericChatId}. Chat involves artist_id: ${chat.artist_user_id} and employer_id: ${chat.employer_user_id}`);
      return void res.status(403).json({ message: 'Sender is not a recognized participant in this chat.' });
    }

    // Create the message
    const newMessage = await Message.create({
      chat_id: numericChatId,
      sender_id: numericSenderId,     // This is User.user_id of the sender
      receiver_id: receiver_user_id,  // This is now correctly a User.user_id of the recipient
      message: message.trim(),
    });

    // Increment message count and touch updated_at for the chat
    try {
        await chat.increment('message_count', { by: 1 });
        chat.changed('updatedAt', true); // Use camelCase model attribute name
        await chat.save({ fields: ['updated_at', 'message_count'] });
        console.log(`[Chat ${numericChatId}] Message count incremented and chat updatedAt touched.`);
    } catch (countError) {
        console.error(`[Chat ${numericChatId}] Failed to increment message count or touch updatedAt:`, countError);
    }

    return void res.status(201).json({
      message: 'Message sent successfully',
      data: newMessage,
    });
  } catch (error) {
    console.error('❌ Error in sendMessage:', error);
    return void res.status(500).json({ message: 'Internal server error.' });
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
export const fetchMessages = async (req: CustomRequest, res: Response): Promise<void> => {
  const loggedInUserId = req.user?.id; // Use authenticated user's ID

  if (!loggedInUserId) {
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
      return void res.status(404).json({ message: 'User not found.' });
    }

    const artistProfileId = userWithProfiles.artistProfile?.artist_id;
    const employerProfileId = userWithProfiles.employerProfile?.employer_id;

    // 2. Build the whereClause using the fetched profile IDs
    const whereClause: any[] = [];
    if (artistProfileId) {
      // Chat model's attribute 'artist_user_id' maps to DB column 'artist_id'
      whereClause.push({ artist_user_id: artistProfileId });
    }
    if (employerProfileId) {
      // Chat model's attribute 'employer_user_id' maps to DB column 'employer_id'
      whereClause.push({ employer_user_id: employerProfileId });
    }

    if (whereClause.length === 0) {
      console.log(`[FETCH CHATS] User ${loggedInUserId} has no artist or employer profile ID to query chats.`);
      return void res.status(200).json({ message: 'User has no relevant profile to fetch chats.', chats: [] });
    }

    // 3. Find all Chat rows
    const chats = await Chat.findAll({
      where: { [Op.or]: whereClause },
      include: [
        {
          model: Artist,
          as: 'chatArtistProfile', // From Chat.belongsTo(Artist, { as: 'chatArtistProfile' })
          attributes: ['artist_id', 'profile_picture'], // Get picture from Artist profile
          include: [{
            model: User,
            as: 'user', // From Artist.belongsTo(User, { as: 'user' })
            attributes: ['user_id', 'fullname'], // Only user fields
          }],
          required: false,
        },
        {
          model: Employer,
          as: 'chatEmployerProfile', // From Chat.belongsTo(Employer, { as: 'chatEmployerProfile' })
          attributes: ['employer_id', 'profile_picture'], // Get picture from Employer profile
          include: [{
            model: User,
            as: 'user', // From Employer.belongsTo(User, { as: 'user' })
            attributes: ['user_id', 'fullname'], // Only user fields
          }],
          required: false,
        },
      ],
      order: [['updated_at', 'DESC']], // Order chats by most recent activity
    });

    console.log(`[FETCH CHATS DEBUG] Found ${chats.length} chats for user ${loggedInUserId}. Raw:`, JSON.stringify(chats, null, 2));

    // 4. Transform the data to clearly show "other user" details
    const formattedChats = chats.map(chat => {
        const chatJson = chat.toJSON() as any;
        let otherUserDisplayData = null;
        let chatName = 'Chat'; // Default chat name

        // Determine "other user" to display in chat list
        if (userWithProfiles.artistProfile && chatJson.artist_user_id === userWithProfiles.artistProfile.artist_id) {
            // Logged-in user is the artist in this chat, so other is employer
            if (chatJson.chatEmployerProfile?.user) {
                otherUserDisplayData = {
                    user_id: chatJson.chatEmployerProfile.user.user_id,
                    fullname: chatJson.chatEmployerProfile.user.fullname,
                    profile_picture: chatJson.chatEmployerProfile.profile_picture
                };
                chatName = otherUserDisplayData.fullname || 'Chat with Employer';
            }
        } else if (userWithProfiles.employerProfile && chatJson.employer_user_id === userWithProfiles.employerProfile.employer_id) {
            // Logged-in user is the employer, so other is artist
            if (chatJson.chatArtistProfile?.user) {
                otherUserDisplayData = {
                    user_id: chatJson.chatArtistProfile.user.user_id,
                    fullname: chatJson.chatArtistProfile.user.fullname,
                    profile_picture: chatJson.chatArtistProfile.profile_picture
                };
                chatName = otherUserDisplayData.fullname || 'Chat with Artist';
            }
        } else {
             console.warn(`[FETCH CHATS] Could not determine other user for chat_id: ${chatJson.chat_id}. LoggedInUserId: ${loggedInUserId}`);
             // Fallback if roles are ambiguous
             if (chatJson.chatArtistProfile?.user) {
                 otherUserDisplayData = { user_id: chatJson.chatArtistProfile.user.user_id, fullname: chatJson.chatArtistProfile.user.fullname, profile_picture: chatJson.chatArtistProfile.profile_picture };
                 chatName = otherUserDisplayData.fullname || "Chat with Artist";
            } else if (chatJson.chatEmployerProfile?.user) {
                 otherUserDisplayData = { user_id: chatJson.chatEmployerProfile.user.user_id, fullname: chatJson.chatEmployerProfile.user.fullname, profile_picture: chatJson.chatEmployerProfile.profile_picture };
                 chatName = otherUserDisplayData.fullname || "Chat with Employer";
            }
        }

        return {
            chat_id: chatJson.chat_id,
            message_count: chatJson.message_count,
            artist_rating_status: chatJson.artist_rating_status,
            employer_rating_status: chatJson.employer_rating_status,
            created_at: chatJson.created_at, // Or createdAt based on your model's underscored setting
            updated_at: chatJson.updated_at, // Or updatedAt
            otherUser: otherUserDisplayData,
            chatName: chatName
        };
    });

    if (!formattedChats.length && chats.length > 0) {
        console.warn("[FETCH CHATS] Raw chats were found but formattedChats resulted in an empty array. Check formatting logic.");
    }

    return void res.status(200).json({ chats: formattedChats });

  } catch (error) {
    console.error(`Error fetching chats for user ${loggedInUserId}:`, error);
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
