// controllers/chat.controller.ts
import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import Chat from '../models/Chat';
import Message from '../models/Message';
import User from '../models/User';
import Artist from '../models/Artist';
import Employer from '../models/Employer';

// ─────────────────────────────────────────────────────────────
// CREATE CHAT
// ─────────────────────────────────────────────────────────────
// Provide artist_user_id and employer_user_id in the request body.
// We'll look up the corresponding artist/employer rows and create a Chat row.
export const createChat = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { artist_user_id, employer_user_id } = req.body;

  if (!artist_user_id || !employer_user_id) {
    res.status(400).json({
      message: 'Artist User ID and Employer User ID are required.',
    });
    return; // End the function
  }

  try {
    // 1) Find the actual Artist row for the artist_user_id
    const artist = await Artist.findOne({ where: { user_id: artist_user_id } });
    // 2) Find the actual Employer row for the employer_user_id
    const employer = await Employer.findOne({ where: { user_id: employer_user_id } });

    if (!artist || !employer) {
      res.status(404).json({ message: 'Artist or Employer profile not found.' });
      return;
    }

    // 3) Check if a Chat already exists between these two
    const existingChat = await Chat.findOne({
      where: {
        artist_id: artist.artist_id,
        employer_id: employer.employer_id,
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
      artist_id: artist.artist_id,
      employer_id: employer.employer_id,
    });

    res.status(201).json({
      message: 'Chat created successfully.',
      chat,
    });
    return;
  } catch (error) {
    console.error('❌ Error creating chat:', error);
    res.status(500).json({ message: 'Failed to create chat.' });
    return;
  }
};

// ─────────────────────────────────────────────────────────────
// SEND A MESSAGE
// ─────────────────────────────────────────────────────────────
// The request body should contain { chat_id, sender_id, message }.
// We determine the receiver based on whether sender matches the Chat’s artist_id or employer_id.
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { chat_id, sender_id, message } = req.body;

    console.log("🔍 Incoming Message:", { chat_id, sender_id, message });

    if (!chat_id || !sender_id || !message.trim()) {
      console.error("❌ Missing parameters");
      res.status(400).json({ message: "Missing chat_id, sender_id, or message." });
      return;
    }

    // 1) Fetch the Chat
    const chat = await Chat.findByPk(chat_id);
    if (!chat) {
      console.error("❌ Chat not found");
      res.status(404).json({ message: "Chat not found." });
      return;
    }

    // 2) Determine the receiver
    let receiver_id;
    if (chat.artist_id === sender_id) {
      receiver_id = chat.employer_id;
    } else if (chat.employer_id === sender_id) {
      receiver_id = chat.artist_id;
    } else {
      console.error("❌ Sender not part of this chat");
      res.status(403).json({ message: "Sender is not part of this chat." });
      return;
    }

    console.log("✅ Receiver ID determined:", receiver_id);

    // 3) Verify sender exists in the Users table
    const sender = await User.findByPk(sender_id);
    if (!sender) {
      console.error("❌ Sender does not exist");
      res.status(404).json({ message: "Sender user does not exist." });
      return;
    }

    // 4) Create the message
    const newMessage = await Message.create({
      chat_id,
      sender_id,
      receiver_id,
      message,
    });

    console.log("✅ Message successfully saved:", newMessage);
    res.status(201).json({ message: "Message sent successfully", data: newMessage });
  } catch (error) {
    console.error("❌ Error in sendMessage:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────
// GET CHAT HISTORY (MESSAGES) BY CHAT ID
// ─────────────────────────────────────────────────────────────
export const getChatHistory = async (req: Request, res: Response): Promise<void> => {
  const { chat_id } = req.params;

  try {
    console.log("🔍 Fetching chat history for chat ID:", chat_id);

    // 1) Ensure chat exists
    const chat = await Chat.findByPk(chat_id);
    if (!chat) {
      console.error("❌ Chat not found with ID:", chat_id);
      res.status(404).json({ message: "Chat not found." });
      return;
    }

    console.log("✅ Chat exists. Fetching messages...");

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
    
    console.log("✅ Messages found:", messages.length);

    if (!messages.length) {
      res.status(200).json({ message: "No messages yet.", messages: [] });
      return;
    }

    res.status(200).json({ messages });
  } catch (error) {
    console.error("❌ Error fetching chat history:", error);
    res.status(500).json({ message: "Failed to fetch chat history.", error });
  }
};

// ─────────────────────────────────────────────────────────────
// FETCH CHATS FOR A USER (All Chats Where This User Is Artist or Employer)
// ─────────────────────────────────────────────────────────────
export const fetchMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user_id = parseInt(req.params.user_id, 10);

  if (isNaN(user_id)) {
    res.status(400).json({ message: 'Invalid User ID.' });
    return;
  }

  try {
    // 1) Find all Chats where user is either the artist or the employer
    const chats = await Chat.findAll({
      where: {
        [Op.or]: [{ artist_id: user_id }, { employer_id: user_id }],
      },
      include: [
        {
          model: Artist,
          as: 'chatArtist',
          attributes: ['artist_id', 'bio', 'profile_picture'],
        },
        {
          model: Employer,
          as: 'chatEmployer',
          attributes: ['employer_id', 'bio', 'profile_picture'],
        },
      ],
    });

    // 2) If no chats, return an empty array
    if (!chats.length) {
      res.status(200).json({
        message: 'No chats found for this user.',
        chats: [],
      });
      return;
    }

    // 3) Otherwise, return the found chats
    res.status(200).json({ chats });
    return;
  } catch (error) {
    console.error('Error fetching recent messages:', error);
    res.status(500).json({ message: 'Failed to fetch recent messages.' });
    return;
  }
};
