// controllers/chat.controller.ts
import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import Chat from '../models/Chat';
import Message from '../models/Message';
import User from '../models/User';
import Artist from '../models/Artist';
import Employer from '../models/Employer';


export const createChat = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { artist_user_id, employer_user_id } = req.body;

  if (!artist_user_id || !employer_user_id) {
    res.status(400).json({
      message: 'Artist User ID and Employer User ID are required.',
    });
    return; // No 'return res...', just end the function
  }

  try {
    const artist = await Artist.findOne({ where: { user_id: artist_user_id } });
    const employer = await Employer.findOne({ where: { user_id: employer_user_id } });

    if (!artist || !employer) {
      res.status(404).json({ message: 'Artist or Employer profile not found.' });
      return;
    }

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


// Send a message (receiver is computed on the backend)
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { chat_id, sender_id, message } = req.body;

    console.log("🔍 Incoming Message:", { chat_id, sender_id, message });

    if (!chat_id || !sender_id || !message.trim()) {
      console.error("❌ Missing parameters");
      res.status(400).json({ message: "Missing chat_id, sender_id, or message." });
      return;
    }

    // 🔍 Get the chat details
    const chat = await Chat.findByPk(chat_id);
    if (!chat) {
      console.error("❌ Chat not found");
      res.status(404).json({ message: "Chat not found." });
      return;
    }

    // 🔍 Find receiver ID based on sender type
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

    // 🔍 Verify sender exists
    const sender = await User.findByPk(sender_id);
    if (!sender) {
      console.error("❌ Sender does not exist");
      res.status(404).json({ message: "Sender user does not exist." });
      return;
    }

    // ✅ Save message
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

// Get chat history by chat ID
export const getChatHistory = async (req: Request, res: Response): Promise<void> => {
  const { chat_id } = req.params;

  try {
    console.log("🔍 Fetching chat history for chat ID:", chat_id);

    // Check if chat exists first
    const chat = await Chat.findByPk(chat_id);
    if (!chat) {
      console.error("❌ Chat not found with ID:", chat_id);
      res.status(404).json({ message: "Chat not found." });
      return;
    }

    console.log("✅ Chat exists. Fetching messages...");

    const messages = await Message.findAll({
      where: { chat_id },
      order: [['created_at', 'ASC']],
      include: [
        {
          model: User,
          as: 'messageSender',
          attributes: ['user_id', 'fullname'], // removed 'profile_picture'
        },
        {
          model: User,
          as: 'messageReceiver',
          attributes: ['user_id', 'fullname'], // removed 'profile_picture'
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
// Fetch chats for a user// Typical approach: returning Promise<void> and not returning the Response object
export const fetchMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const user_id = parseInt(req.params.user_id, 10);

  if (isNaN(user_id)) {
    res.status(400).json({ message: 'Invalid User ID.' });
    return; // return; after sending the response
  }

  try {
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

    if (!chats.length) {
      res.status(200).json({
        message: 'No chats found for this user.',
        chats: [],
      });
      return;
    }

    // Otherwise, return the chats
    res.status(200).json({ chats });
    return;
  } catch (error) {
    console.error('Error fetching recent messages:', error);
    res.status(500).json({ message: 'Failed to fetch recent messages.' });
    return;
  }
};