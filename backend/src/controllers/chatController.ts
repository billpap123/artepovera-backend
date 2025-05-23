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
import sequelize from '../config/db'; // <<< ADD THIS LINE (Adjust path if your db.ts is elsewhere)

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
/* SEND A MESSAGE (Updated to return prompt status)                           */
/* -------------------------------------------------------------------------- */
// POST /api/chats/send
// Body: { chat_id, message } // sender_id will now come from token
export const sendMessage = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
    const { chat_id, message } = req.body; // Get message and chat_id from body
    const senderId = req.user?.id; // <<< Get sender_id from authenticated user (req.user)

    if (!chat_id || !senderId || !message?.trim()) {
      return void res.status(400).json({
        message: 'Missing chat_id, authenticated sender_id, or message.',
      });
    }

    const numericChatId = parseInt(chat_id, 10);
    // senderId is already a number if it comes from req.user.id

    if (isNaN(numericChatId)) {
        return void res.status(400).json({ message: 'chat_id must be a valid number.' });
    }

    const chat = await Chat.findByPk(numericChatId);
    if (!chat) {
      return void res.status(404).json({ message: 'Chat not found.' });
    }

    // Fetch the sender's User model along with their Artist/Employer profile IDs
    // This is to determine the sender's role (Artist/Employer) in THIS chat
    const senderUserWithProfiles = await User.findByPk(senderId, {
      include: [
        { model: Artist, as: 'artistProfile', attributes: ['artist_id'] },
        { model: Employer, as: 'employerProfile', attributes: ['employer_id'] }
      ]
    });

    if (!senderUserWithProfiles) {
      // Should be caught by authenticate middleware if req.user.id is used
      return void res.status(404).json({ message: 'Sender user not found.' });
    }

    let receiver_user_id: number; // This needs to be the User.user_id of the recipient

    // chat.artist_user_id stores an Artist.artist_id (PK of artists table)
    // chat.employer_user_id stores an Employer.employer_id (PK of employers table)
    if (senderUserWithProfiles.artistProfile && chat.artist_user_id === senderUserWithProfiles.artistProfile.artist_id) {
      const employerProfileInChat = await Employer.findByPk(chat.employer_user_id, { attributes: ['user_id'] });
      if (!employerProfileInChat) {
        console.error(`Chat ${numericChatId}: Could not find Employer profile (ID ${chat.employer_user_id}) linked in chat.`);
        return void res.status(404).json({ message: "Chat partner (Employer profile) not found for this chat." });
      }
      receiver_user_id = employerProfileInChat.user_id;
    } else if (senderUserWithProfiles.employerProfile && chat.employer_user_id === senderUserWithProfiles.employerProfile.employer_id) {
      const artistProfileInChat = await Artist.findByPk(chat.artist_user_id, { attributes: ['user_id'] });
      if (!artistProfileInChat) {
        console.error(`Chat ${numericChatId}: Could not find Artist profile (ID ${chat.artist_user_id}) linked in chat.`);
        return void res.status(404).json({ message: 'Chat partner (Artist profile) not found for this chat.' });
      }
      receiver_user_id = artistProfileInChat.user_id;
    } else {
      console.warn(`Sender User ID ${senderId} is not an active artist or employer participant in chat ${numericChatId}. Chat involves artist_id: ${chat.artist_user_id} and employer_id: ${chat.employer_user_id}`);
      return void res.status(403).json({ message: 'Sender is not a recognized participant in this chat.' });
    }

    // Create the message
    const newMessage = await Message.create({
      chat_id: numericChatId,
      sender_id: senderId,
      receiver_id: receiver_user_id,
      message: message.trim(),
    });

    // --- Update chat: Increment message count and get fresh data in a transaction ---
    let showPromptForSender = false;
    let promptLevelForSender = 0;

    try {
      await sequelize.transaction(async (t) => {
        await chat.increment('message_count', { by: 1, transaction: t });
        // Reload the chat instance within the transaction to get the updated message_count
        // and also ensure updatedAt (if handled by Sequelize timestamps) is refreshed.
        await chat.reload({ transaction: t });
      });

      console.log(`[Chat ${numericChatId}] Message count is now ${chat.message_count}. Chat timestamp updated.`);

      // Now check rating prompt status for the SENDER using the reloaded chat instance
      let userStatusFieldForSender: 'artist_rating_status' | 'employer_rating_status' | null = null;

      if (senderUserWithProfiles.artistProfile && chat.artist_user_id === senderUserWithProfiles.artistProfile.artist_id) {
          userStatusFieldForSender = 'artist_rating_status';
      } else if (senderUserWithProfiles.employerProfile && chat.employer_user_id === senderUserWithProfiles.employerProfile.employer_id) {
          userStatusFieldForSender = 'employer_rating_status';
      }

      if (userStatusFieldForSender) {
          const senderCurrentRatingStatus = chat[userStatusFieldForSender];
          const currentMessageCount = chat.message_count; // Use the reloaded count

          if (senderCurrentRatingStatus === 'pending' && currentMessageCount >= 10) {
              showPromptForSender = true;
              promptLevelForSender = 10;
          } else if (senderCurrentRatingStatus === 'prompted_10' && currentMessageCount >= 20) {
              showPromptForSender = true;
              promptLevelForSender = 20;
          }
          console.log(`[SendMessage Prompt Check] For User ${senderId} in Chat ${chat.chat_id}: MessageCount=${currentMessageCount}, Status=${senderCurrentRatingStatus}, ShowPrompt=${showPromptForSender}`);
      }

    } catch (updateError) {
        console.error(`[Chat ${numericChatId}] Failed to increment message count/reload chat or check prompt status:`, updateError);
        // Don't fail the entire message sending if this part errors, but log it.
    }
    // --- End Update ---

    return void res.status(201).json({
      message: 'Message sent successfully',
      data: newMessage,
      // --- ADDED prompt status to response ---
      showPromptForSender: showPromptForSender,
      promptLevelForSender: promptLevelForSender
      // --- END ADDITION ---
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
      const loggedInUserId = req.user?.id; // User.user_id from token

      if (!loggedInUserId) {
          return void res.status(401).json({ message: 'Unauthorized: User ID missing.' });
      }
      if (!chat_id || isNaN(parseInt(chat_id, 10))) {
          return void res.status(400).json({ message: 'Invalid chat ID.' });
      }

      const chatIdNum = parseInt(chat_id, 10);
      console.log(`[Rating Status] Checking for chat_id: ${chatIdNum}, by loggedInUserId: ${loggedInUserId}`);

      const chat = await Chat.findByPk(chatIdNum);
      if (!chat) {
          console.warn(`[Rating Status] Chat not found for chat_id: ${chatIdNum}`);
          return void res.status(404).json({ message: 'Chat not found.' });
      }

      console.log(`[Rating Status] Chat ${chatIdNum} record - artist_user_id (Artist PK): ${chat.artist_user_id}, employer_user_id (Employer PK): ${chat.employer_user_id}`);

      // Fetch the logged-in user's Artist and Employer profile IDs
      const userWithProfiles = await User.findByPk(loggedInUserId, {
          include: [
              { model: Artist, as: 'artistProfile', attributes: ['artist_id'] },
              { model: Employer, as: 'employerProfile', attributes: ['employer_id'] }
          ]
      });

      if (!userWithProfiles) {
          console.warn(`[Rating Status] User profile not found for loggedInUserId: ${loggedInUserId}`);
          return void res.status(404).json({ message: "User profile not found."});
      }

      console.log(`[Rating Status] LoggedInUser (${loggedInUserId}) - Artist Profile ID: ${userWithProfiles.artistProfile?.artist_id}, Employer Profile ID: ${userWithProfiles.employerProfile?.employer_id}`);

      let userStatusField: 'artist_rating_status' | 'employer_rating_status' | null = null;

      // Compare logged-in user's actual Artist PK with the Artist PK stored in the chat
      if (userWithProfiles.artistProfile && chat.artist_user_id === userWithProfiles.artistProfile.artist_id) {
          userStatusField = 'artist_rating_status';
          console.log("[Rating Status] Matched as Artist participant.");
      // Compare logged-in user's actual Employer PK with the Employer PK stored in the chat
      } else if (userWithProfiles.employerProfile && chat.employer_user_id === userWithProfiles.employerProfile.employer_id) {
          userStatusField = 'employer_rating_status';
          console.log("[Rating Status] Matched as Employer participant.");
      } else {
          console.warn(`[Rating Status] User ${loggedInUserId} (Artist Profile ID: ${userWithProfiles.artistProfile?.artist_id}, Employer Profile ID: ${userWithProfiles.employerProfile?.employer_id}) is NOT the direct artist (Chat's Artist PK: ${chat.artist_user_id}) OR employer (Chat's Employer PK: ${chat.employer_user_id}) for chat ${chat_id}. Returning 403.`);
          return void res.status(403).json({ message: 'User is not a direct participant in this chat.' });
      }

      const currentUserStatus = chat[userStatusField]; // This is now safe
      const messageCount = chat.message_count;
      let showPrompt = false;
      let level = 0;

      if (currentUserStatus === 'pending' && messageCount >= 10) {
          showPrompt = true;
          level = 10;
      } else if (currentUserStatus === 'prompted_10' && messageCount >= 20) {
          showPrompt = true;
          level = 20;
      }

      console.log(`[Rating Prompt Check] Chat: ${chatIdNum}, User: ${loggedInUserId}, Count: ${messageCount}, Status: ${currentUserStatus}, Show: ${showPrompt}`);
      return void res.status(200).json({ showPrompt, level });

  } catch (error: any) {
      console.error(`❌ Error getting rating prompt status for chat ${req.params.chat_id}:`, error);
      return void res.status(500).json({ message: 'Internal server error.', error: error.message});
  }
};


/* -------------------------------------------------------------------------- */
/* UPDATE RATING PROMPT STATUS (Corrected)                                    */
/* -------------------------------------------------------------------------- */
// PUT /api/chats/:chat_id/rating-status
export const updateRatingPromptStatus = async (req: CustomRequest, res: Response): Promise<void> => {
  try {
      const { chat_id } = req.params;
      const loggedInUserId = req.user?.id; // User.user_id from token
      const { action } = req.body;

      if (!loggedInUserId) { return void res.status(401).json({ message: 'Unauthorized: User ID missing.' }); }
      if (!chat_id || isNaN(parseInt(chat_id, 10))) { return void res.status(400).json({ message: 'Invalid chat ID.' }); }
      if (!action || (action !== 'maybe_later' && action !== 'declined')) { return void res.status(400).json({ message: 'Invalid action. Use "maybe_later" or "declined".' }); }

      const chatIdNum = parseInt(chat_id, 10);
      console.log(`[Rating Status Update] Attempt for chat_id: ${chatIdNum}, by loggedInUserId: ${loggedInUserId}, action: ${action}`);

      const chat = await Chat.findByPk(chatIdNum);
      if (!chat) {
          console.warn(`[Rating Status Update] Chat not found for chat_id: ${chatIdNum}`);
          return void res.status(404).json({ message: 'Chat not found.' });
      }
      console.log(`[Rating Status Update] Chat ${chatIdNum} record - artist_user_id (Artist PK): ${chat.artist_user_id}, employer_user_id (Employer PK): ${chat.employer_user_id}`);


      const userWithProfiles = await User.findByPk(loggedInUserId, {
        include: [
            { model: Artist, as: 'artistProfile', attributes: ['artist_id'] },
            { model: Employer, as: 'employerProfile', attributes: ['employer_id'] }
        ]
      });
      if (!userWithProfiles) {
          console.warn(`[Rating Status Update] User profile not found for loggedInUserId: ${loggedInUserId}`);
          return void res.status(404).json({ message: "User profile not found."});
      }
      console.log(`[Rating Status Update] LoggedInUser (${loggedInUserId}) - Artist Profile ID: ${userWithProfiles.artistProfile?.artist_id}, Employer Profile ID: ${userWithProfiles.employerProfile?.employer_id}`);

      let userStatusField: 'artist_rating_status' | 'employer_rating_status' | null = null;

      if (userWithProfiles.artistProfile && chat.artist_user_id === userWithProfiles.artistProfile.artist_id) {
          userStatusField = 'artist_rating_status';
          console.log("[Rating Status Update] Matched as Artist participant.");
      } else if (userWithProfiles.employerProfile && chat.employer_user_id === userWithProfiles.employerProfile.employer_id) {
          userStatusField = 'employer_rating_status';
          console.log("[Rating Status Update] Matched as Employer participant.");
      } else {
          console.warn(`[Rating Status Update] User ${loggedInUserId} (Artist Profile ID: ${userWithProfiles.artistProfile?.artist_id}, Employer Profile ID: ${userWithProfiles.employerProfile?.employer_id}) is NOT the direct artist (Chat's Artist PK: ${chat.artist_user_id}) OR employer (Chat's Employer PK: ${chat.employer_user_id}) for chat ${chat_id}. Returning 403.`);
          return void res.status(403).json({ message: 'User is not a direct participant in this chat.' });
      }

      const currentStatus = chat[userStatusField]; // Safe due to check above
      let newStatus: typeof currentStatus | null = null;

      if (action === 'declined') {
          if (currentStatus !== 'completed') { newStatus = 'declined'; }
      } else if (action === 'maybe_later') {
          if (currentStatus === 'pending') { newStatus = 'prompted_10'; }
          else if (currentStatus === 'prompted_10') { newStatus = 'prompted_20'; }
      }

      if (newStatus && newStatus !== currentStatus) {
          try {
              await chat.update({ [userStatusField]: newStatus });
              console.log(`[Rating Status Update] Chat: ${chatIdNum}, User: ${loggedInUserId}, Status updated from '${currentStatus}' to: '${newStatus}'`);
              return void res.status(200).json({ message: 'Rating prompt status updated.', newStatus: newStatus });
          } catch(updateError: any) {
               console.error(`[Rating Status Update] Failed to update status for Chat ${chatIdNum}, User ${loggedInUserId}:`, updateError);
               res.status(500).json({ message: "Failed to update rating status.", error: updateError.message }); return;
          }
      } else {
          console.log(`[Rating Status Update] No status change needed for Chat: ${chatIdNum}, User: ${loggedInUserId}, Action: ${action}, Current Status: ${currentStatus}`);
          return void res.status(200).json({ message: 'No status change applied.', currentStatus: currentStatus });
      }

  } catch (error: any) {
      console.error(`❌ Error updating rating prompt status for chat ${req.params.chat_id}:`, error);
      return void res.status(500).json({ message: 'Internal server error.', error: error.message });
  }
};
