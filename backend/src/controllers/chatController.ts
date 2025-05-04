/* -------------------------------------------------------------------------- */
/* src/controllers/chat.controller.ts                                         */
/* -------------------------------------------------------------------------- */

import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Chat from '../models/Chat';
import Message from '../models/Message';
import User from '../models/User';
import { CustomRequest } from '../middleware/authMiddleware'; // Make sure this is imported


/* -------------------------------------------------------------------------- */
/* CREATE CHAT                                                                 */
/* -------------------------------------------------------------------------- */
// POST /api/chats
// Body: { artistUserId: number, employerUserId: number }
// We store direct user IDs in the chat: artist_user_id, employer_user_id
export const createChat = async (req: Request, res: Response): Promise<void> => {
  try {
    const { artistUserId, employerUserId } = req.body;

    if (!artistUserId || !employerUserId) {
      return void res.status(400).json({
        message: 'artistUserId and employerUserId are required.',
      });
    }

    // 1) Optional: Check if both users actually exist in the users table
    const [artistUser, employerUser] = await Promise.all([
      User.findByPk(artistUserId),
      User.findByPk(employerUserId),
    ]);
    if (!artistUser || !employerUser) {
      return void res
        .status(404)
        .json({ message: 'One or both user IDs not found in users table.' });
    }

    // 2) Check if a Chat already exists with these user IDs
    const existingChat = await Chat.findOne({
      where: {
        artist_user_id: artistUserId,
        employer_user_id: employerUserId,
      },
    });
    if (existingChat) {
      return void res.status(200).json({
        message: 'Chat already exists.',
        chat: existingChat,
      });
    }

    // 3) Create the chat row
    const chat = await Chat.create({
      artist_user_id: artistUserId,
      employer_user_id: employerUserId,
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
export const fetchMessages = async (req: Request, res: Response): Promise<void> => {
  const user_id = parseInt(req.params.user_id, 10);
  if (Number.isNaN(user_id)) {
    return void res.status(400).json({ message: 'Invalid user_id.' });
  }

  try {
    // 1) Find all Chat rows matching user_id on either side
    const chats = await Chat.findAll({
      where: {
        [Op.or]: [
          { artist_user_id: user_id },
          { employer_user_id: user_id },
        ],
      },
      // 2) Optionally include the user info for each side:
      include: [
        {
          model: User,
          as: 'artistUser',
          attributes: ['user_id', 'fullname'],
        },
        {
          model: User,
          as: 'employerUser',
          attributes: ['user_id', 'fullname'],
        },
      ],
    });

    if (!chats.length) {
      return void res.status(200).json({
        message: 'No chats found for this user.',
        chats: [],
      });
    }

    // 3) Return them
    return void res.status(200).json({ chats });
  } catch (error) {
    console.error('Error fetching chats for user:', error);
    return void res
      .status(500)
      .json({ message: 'Failed to fetch chats.' });
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
