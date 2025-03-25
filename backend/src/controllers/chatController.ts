// src/controllers/chat.controller.ts

import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Chat from '../models/Chat';
import Message from '../models/Message';
import User from '../models/User';
import Artist from '../models/Artist';
import Employer from '../models/Employer';

/* -------------------------------------------------------------------------- */
/* CREATE CHAT (artist_user_id + employer_user_id)                            */
/* -------------------------------------------------------------------------- */
// Provide artist_user_id and employer_user_id in the request body.
// We'll look up the corresponding Artist/Employer rows and create a Chat row.
export const createChat = async (req: Request, res: Response): Promise<void> => {
  const { artist_user_id, employer_user_id } = req.body;

  if (!artist_user_id || !employer_user_id) {
    res.status(400).json({
      message: 'Artist User ID and Employer User ID are required.',
    });
    return;
  }

  try {
    // 1) Find the actual Artist row for artist_user_id
    const artist = await Artist.findOne({ where: { user_id: artist_user_id } });
    // 2) Find the actual Employer row for employer_user_id
    const employer = await Employer.findOne({ where: { user_id: employer_user_id } });

    if (!artist || !employer) {
      res.status(404).json({ message: 'Artist or Employer profile not found.' });
      return;
    }

    // 3) Check if a Chat already exists between these two
    const existingChat = await Chat.findOne({
      where: {
        artist_user_id: artist.artist_id,
        employer_user_id: employer.employer_id,
      },
    });

    if (existingChat) {
      res.status(200).json({
        message: 'Chat already exists.',
        chat: existingChat,
      });
      return;
    }

    // 4) Otherwise, create a new Chat
    const chat = await Chat.create({
      artist_user_id: artist.artist_id,
      employer_user_id: employer.employer_id,
    });

    res.status(201).json({
      message: 'Chat created successfully.',
      chat,
    });
  } catch (error) {
    console.error('❌ Error creating chat:', error);
    res.status(500).json({ message: 'Failed to create chat.' });
  }
};

/* -------------------------------------------------------------------------- */
/* SEND A MESSAGE                                                             */
/* -------------------------------------------------------------------------- */
// The request body should contain { chat_id, sender_id, message }.
// We determine the receiver based on whether sender matches the Chat’s artist_id or employer_id.
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { chat_id, sender_id, message } = req.body;

    console.log('🔍 Incoming Message:', { chat_id, sender_id, message });

    if (!chat_id || !sender_id || !message?.trim()) {
      console.error('❌ Missing parameters');
      res.status(400).json({ message: 'Missing chat_id, sender_id, or message.' });
      return;
    }

    // 1) Fetch the Chat
    const chat = await Chat.findByPk(chat_id);
    if (!chat) {
      console.error('❌ Chat not found');
      res.status(404).json({ message: 'Chat not found.' });
      return;
    }

    // 2) Determine the receiver
    let receiver_id: number;
    if (chat.artist_user_id === sender_id) {
      receiver_id = chat.employer_user_id;
    } else if (chat.employer_user_id === sender_id) {
      receiver_id = chat.artist_user_id;
    } else {
      console.error('❌ Sender not part of this chat');
      res.status(403).json({ message: 'Sender is not part of this chat.' });
      return;
    }

    console.log('✅ Receiver ID determined:', receiver_id);

    // 3) Verify sender exists in the Users table
    const sender = await User.findByPk(sender_id);
    if (!sender) {
      console.error('❌ Sender does not exist');
      res.status(404).json({ message: 'Sender user does not exist.' });
      return;
    }

    // 4) Create the message
    const newMessage = await Message.create({
      chat_id,
      sender_id,
      receiver_id,
      message,
    });

    console.log('✅ Message successfully saved:', newMessage);
    res.status(201).json({ message: 'Message sent successfully', data: newMessage });
  } catch (error) {
    console.error('❌ Error in sendMessage:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

/* -------------------------------------------------------------------------- */
/* GET CHAT HISTORY (MESSAGES) BY CHAT ID                                     */
/* -------------------------------------------------------------------------- */
export const getChatHistory = async (req: Request, res: Response): Promise<void> => {
  const { chat_id } = req.params;

  try {
    console.log('🔍 Fetching chat history for chat ID:', chat_id);

    // 1) Ensure chat exists
    const chat = await Chat.findByPk(chat_id);
    if (!chat) {
      console.error('❌ Chat not found with ID:', chat_id);
      res.status(404).json({ message: 'Chat not found.' });
      return;
    }

    console.log('✅ Chat exists. Fetching messages...');

    // 2) Fetch messages
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

    console.log('✅ Messages found:', messages.length);

    if (!messages.length) {
      res.status(200).json({ message: 'No messages yet.', messages: [] });
      return;
    }

    res.status(200).json({ messages });
  } catch (error) {
    console.error('❌ Error fetching chat history:', error);
    res.status(500).json({ message: 'Failed to fetch chat history.', error });
  }
};

/* -------------------------------------------------------------------------- */
/* FETCH CHATS FOR A USER (All Chats Where This User Is Artist or Employer)   */
/* -------------------------------------------------------------------------- */
// GET /api/chats/user/:user_id
// We'll look up the Artist/Employer row to find the correct artist_id or employer_id
// Then find all chats matching those IDs, including the name on each side.
export const fetchMessages = async (req: Request, res: Response): Promise<void> => {
  const user_id = parseInt(req.params.user_id, 10);

  if (isNaN(user_id)) {
    return void res.status(400).json({ message: 'Invalid User ID.' });
  }

  try {
    // 1) Attempt to find the user as an Artist or Employer
    const [artistRow, employerRow] = await Promise.all([
      Artist.findOne({ where: { user_id } }),
      Employer.findOne({ where: { user_id } }),
    ]);

    // Build OR conditions for Chat:
    const orConditions: any[] = [];

    if (artistRow) {
      orConditions.push({ artist_id: artistRow.artist_id });
    }
    if (employerRow) {
      orConditions.push({ employer_id: employerRow.employer_id });
    }

    // If user is neither an Artist nor an Employer, return empty
    if (orConditions.length === 0) {
      return void res.status(200).json({
        message: 'User is neither an Artist nor an Employer.',
        chats: [],
      });
    }

    // 2) Find all Chats where user is the Artist or Employer
    const chats = await Chat.findAll({
      where: {
        [Op.or]: orConditions,
      },
      include: [
        {
          model: Artist,
          as: 'chatArtist',
          attributes: ['artist_id'],
          // We want the user’s name from Artist -> user association
          include: [
            {
              model: User,
              as: 'artistUserDetails',
              attributes: ['user_id', 'fullname'],
            },
          ],
        },
        {
          model: Employer,
          as: 'chatEmployer',
          attributes: ['employer_id'],
          // We want the user’s name from Employer -> user association
          include: [
            {
              model: User,
              as: 'user', // or 'employerUserDetails' if you set it that way
              attributes: ['user_id', 'fullname'],
            },
          ],
        },
      ],
    });

    // 3) If no chats found, return empty
    if (!chats.length) {
      return void res.status(200).json({
        message: 'No chats found for this user.',
        chats: [],
      });
    }

    // 4) Return them
    res.status(200).json({ chats });
  } catch (error) {
    console.error('Error fetching chats for user:', error);
    res.status(500).json({ message: 'Failed to fetch chats.' });
  }
};
