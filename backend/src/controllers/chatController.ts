// src/controllers/chatController.ts
import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Chat from '../models/Chat'; // Your NEW Chat model
import Message from '../models/Message';
import User from '../models/User';
import Artist from '../models/Artist';
import Employer from '../models/Employer';
import { CustomRequest } from '../middleware/authMiddleware';
import { Server } from 'socket.io';             // ⭐  ΝΕΟ import
import sequelize from '../config/db';   // ← ADD THIS LINE

/**
 * @description Creates a chat between the logged-in user and a specified receiver.
 * It will find an existing chat or create a new one if it doesn't exist.
 * @route POST /api/chats
 * @body { receiverId: number }
 */
export const createChat = async (req: CustomRequest, res: Response): Promise<void> => {
    const senderId      = req.user?.id;
    const { receiverId } = req.body;
  
    if (!senderId || !receiverId || senderId === receiverId) {
      res.status(400).json({ message: 'Invalid sender or receiver ID.' });
      return;
    }
  
    try {
      // ✓ id μικρότερο = user1, μεγαλύτερο = user2 (μοναδικό key)
      const [chat] = await Chat.findOrCreate({
        where: {
          user1_id: Math.min(senderId, receiverId),
          user2_id: Math.max(senderId, receiverId),
        },
        defaults: {
          user1_id: Math.min(senderId, receiverId),
          user2_id: Math.max(senderId, receiverId),
        },
      });
  
      res.status(200).json({ message: 'Chat found or created successfully.', chat });
    } catch (error) {
      console.error('❌ Error creating or finding chat:', error);
      res.status(500).json({ message: 'Failed to create chat.' });
    }
  };
  
  

/**
 * @description Sends a message from the logged-in user to a specific chat.
 * @route POST /api/chats/send
 * @body { chat_id: number, message: string }
 */
export const sendMessage = async (req: CustomRequest, res: Response) => {
  const senderId                = req.user!.id;                 // we’re in a protected route
  const { chat_id, message }    = req.body;

  /* ---------- guardrails ---------- */
  if (!chat_id || !message?.trim()) {
    return void res.status(400).json({ message: 'chat_id and message required.' });
  }

  const trx = await sequelize.transaction();
  try {
    /* ---------- verify chat & authorship (single SELECT … FOR UPDATE) ---------- */
    const chat = await Chat.findOne({
      where: { chat_id },
      attributes: ['chat_id', 'user1_id', 'user2_id'],
      lock: trx.LOCK.UPDATE,              // prevents race conditions with updatedAt
      transaction: trx,
    });
    if (!chat)       return void res.status(404).json({ message: 'Chat not found.' });
    if (chat.user1_id !== senderId && chat.user2_id !== senderId) {
      return void res.status(403).json({ message: 'Not a participant.' });
    }

    const receiverId = chat.user1_id === senderId ? chat.user2_id : chat.user1_id;

    /* ---------- insert message & touch chat.updatedAt (same connection) ---------- */
    const newMessage = await Message.create(
      { chat_id, sender_id: senderId, receiver_id: receiverId, message: message.trim() },
      { transaction: trx }
    );
    await chat.update({ updatedAt: new Date() }, { transaction: trx });

    await trx.commit();                       // ✅ done – DB is consistent

    /* ---------- reply to HTTP *immediately* ---------- */
    res.status(201).json({ data: newMessage });

    /* ---------- fire-and-forget realtime broadcast ---------- */
    process.nextTick(async () => {
      const io            = req.io as Server;
      const onlineUsers   = req.onlineUsers;
      const room          = String(chat.chat_id);
      const payload       = newMessage.toJSON();

      io.to(room).volatile.emit('new_message', payload);        // .volatile ⇒ no ack wait

      const receiverSocket = onlineUsers?.get(receiverId);
      if (receiverSocket) {
        const socketsInRoom = await io.in(room).allSockets();
        if (!socketsInRoom.has(receiverSocket)) {
          io.to(receiverSocket).volatile.emit('new_message', payload);
        }
      }
    });

  } catch (err) {
    await trx.rollback();
    console.error('❌  sendMessage failed:', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};


  



/**
 * @description Fetches all chats for the logged-in user.
 * @route GET /api/chats/my-chats
 */
export const fetchUserChats = async (req: CustomRequest, res: Response): Promise<void> => {
    const loggedInUserId = req.user?.id;
    if (!loggedInUserId) {
      res.status(401).json({ message: 'Unauthorized: User not logged in.' });
      return;
    }
  
    try {
      const chats = await Chat.findAll({
        where: {
          [Op.or]: [{ user1_id: loggedInUserId }, { user2_id: loggedInUserId }],
        },
        include: [
          {
            model: User,
            as: 'user1',
            attributes: ['user_id', 'fullname', 'user_type'],
            include: [
              { model: Artist, as: 'artistProfile', attributes: ['profile_picture'], required: false },
              { model: Employer, as: 'employerProfile', attributes: ['profile_picture'], required: false },
            ],
          },
          {
            model: User,
            as: 'user2',
            attributes: ['user_id', 'fullname', 'user_type'],
            include: [
              { model: Artist, as: 'artistProfile', attributes: ['profile_picture'], required: false },
              { model: Employer, as: 'employerProfile', attributes: ['profile_picture'], required: false },
            ],
          },
        ],
        order: [['updatedAt', 'DESC']],
      });
  
      const formatted = chats.map((c) => {
        const other = c.user1_id === loggedInUserId ? c.user2 : c.user1;
        const pic =
          other?.user_type === 'Artist'
            ? other.artistProfile?.profile_picture
            : other?.employerProfile?.profile_picture;
  
        return {
          chat_id: c.chat_id,
          updatedAt: c.updatedAt,
          otherUser: other
            ? { user_id: other.user_id, fullname: other.fullname, profile_picture: pic ?? null }
            : null,
        };
      });
  
      res.status(200).json({ chats: formatted });
    } catch (error) {
      console.error(`❌ Error fetching chats for user ${loggedInUserId}:`, error);
      res.status(500).json({ message: 'Failed to fetch chats.' });
    }
  };
  
  
/**
 * @description Fetches the message history for a specific chat.
 * @route GET /api/chats/:chat_id/messages
 */
export const getChatHistory = async (req: CustomRequest, res: Response): Promise<void> => {
    const { chat_id } = req.params;
    const loggedInUserId = req.user?.id;
    if (!loggedInUserId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }
  
    try {
      const chat = await Chat.findByPk(chat_id);
      if (!chat) {
        res.status(404).json({ message: 'Chat not found.' });
        return;
      }
      if (chat.user1_id !== loggedInUserId && chat.user2_id !== loggedInUserId) {
        res.status(403).json({ message: 'Forbidden: You do not have access to this chat.' });
        return;
      }
  
      const messages = await Message.findAll({
        where: { chat_id: chat.chat_id },
        order: [['createdAt', 'ASC']],
      });
  
      res.status(200).json({ messages });
    } catch (error) {
      console.error('❌ Error fetching chat history:', error);
      res.status(500).json({ message: 'Failed to fetch chat history.' });
    }
  };
  