/* -------------------------------------------------------------------------- */
/* src/controllers/chat.controller.ts                                         */
/* -------------------------------------------------------------------------- */

import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Chat from '../models/Chat';
import Message from '../models/Message';
import User from '../models/User';

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
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { chat_id, sender_id, message } = req.body;

    if (!chat_id || !sender_id || !message?.trim()) {
      return void res.status(400).json({
        message: 'Missing chat_id, sender_id, or message.',
      });
    }

    // 1) Fetch the chat
    const chat = await Chat.findByPk(chat_id);
    if (!chat) {
      return void res.status(404).json({ message: 'Chat not found.' });
    }

    // 2) Determine the receiver
    let receiver_id: number;
    if (chat.artist_user_id === sender_id) {
      receiver_id = chat.employer_user_id;
    } else if (chat.employer_user_id === sender_id) {
      receiver_id = chat.artist_user_id;
    } else {
      return void res
        .status(403)
        .json({ message: 'Sender is not part of this chat.' });
    }

    // 3) Verify the sender actually exists
    const sender = await User.findByPk(sender_id);
    if (!sender) {
      return void res
        .status(404)
        .json({ message: 'Sender user does not exist.' });
    }

    // 4) Create the message
    const newMessage = await Message.create({
      chat_id,
      sender_id,
      receiver_id,
      message,
    });

    return void res.status(201).json({
      message: 'Message sent successfully',
      data: newMessage,
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
