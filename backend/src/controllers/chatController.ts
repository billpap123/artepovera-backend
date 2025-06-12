// src/controllers/chatController.ts
import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Chat from '../models/Chat'; // Your NEW Chat model
import Message from '../models/Message';
import User from '../models/User';
import Artist from '../models/Artist';
import Employer from '../models/Employer';
import { CustomRequest } from '../middleware/authMiddleware';

/**
 * @description Creates a chat between the logged-in user and a specified receiver.
 * It will find an existing chat or create a new one if it doesn't exist.
 * @route POST /api/chats
 * @body { receiverId: number }
 */
export const createChat = async (req: CustomRequest, res: Response): Promise<void> => {
    const senderId = req.user?.id;
    const { receiverId } = req.body;

    if (!senderId || !receiverId || senderId === receiverId) {
        res.status(400).json({ message: 'Invalid sender or receiver ID.' });
        return;
    }

    try {
        // To find the chat regardless of who is user1 or user2, we search for both combinations.
        const user1 = Math.min(senderId, receiverId);
        const user2 = Math.max(senderId, receiverId);
        
        const [chat] = await Chat.findOrCreate({
            where: { user1_id: user1, user2_id: user2 },
            defaults: { user1_id: user1, user2_id: user2 }
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
export const sendMessage = async (req: CustomRequest, res: Response): Promise<void> => {
    const senderId = req.user?.id;
    const { chat_id, message } = req.body;

    if (!chat_id || !senderId || !message?.trim()) {
        res.status(400).json({ message: 'Missing chat_id, authenticated sender_id, or message.' });
        return;
    }

    try {
        const chat = await Chat.findByPk(chat_id);
        if (!chat) {
            res.status(404).json({ message: 'Chat not found.' });
            return;
        }

        if (chat.user1_id !== senderId && chat.user2_id !== senderId) {
            res.status(403).json({ message: 'Forbidden: You are not a participant in this chat.' });
            return;
        }
        
        const receiverId = (chat.user1_id === senderId) ? chat.user2_id : chat.user1_id;

        const newMessage = await Message.create({
            chat_id: chat.chat_id,
            sender_id: senderId,
            receiver_id: receiverId,
            message: message.trim(),
        });

        await chat.save();
        
        // --- THIS IS THE UPDATED LINE ---
        // We now get 'io' directly from the request object where our middleware put it.
        const io = (req as any).io;
        
        // This part will now work correctly
        const chatRoom = newMessage.chat_id.toString(); 
        io.to(chatRoom).emit('new_message', newMessage.toJSON());
        // --- END OF CHANGE ---

        res.status(201).json({ message: 'Message sent successfully', data: newMessage });
    } catch (error) {
        console.error('❌ Error in sendMessage:', error);
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
                [Op.or]: [
                    { user1_id: loggedInUserId },
                    { user2_id: loggedInUserId }
                ]
            },
            include: [
                {
                    model: User,
                    as: 'user1',
                    attributes: ['user_id', 'fullname', 'user_type'],
                    include: [
                        { model: Artist, as: 'artistProfile', attributes: ['profile_picture'], required: false },
                        { model: Employer, as: 'employerProfile', attributes: ['profile_picture'], required: false }
                    ]
                },
                {
                    model: User,
                    as: 'user2',
                    attributes: ['user_id', 'fullname', 'user_type'],
                    include: [
                        { model: Artist, as: 'artistProfile', attributes: ['profile_picture'], required: false },
                        { model: Employer, as: 'employerProfile', attributes: ['profile_picture'], required: false }
                    ]
                }
            ],
            order: [['updatedAt', 'DESC']],
        });

        const formattedChats = chats.map(chat => {
            const otherUserInstance = chat.user1_id === loggedInUserId ? chat.user2 : chat.user1;
            let otherUserProfilePic = null;

            if (otherUserInstance) {
                if (otherUserInstance.user_type === 'Artist') {
                    otherUserProfilePic = otherUserInstance.artistProfile?.profile_picture;
                } else if (otherUserInstance.user_type === 'Employer') {
                    otherUserProfilePic = otherUserInstance.employerProfile?.profile_picture;
                }
            }
            
            return {
                chat_id: chat.chat_id,
                updatedAt: chat.updatedAt,
                otherUser: otherUserInstance ? {
                    user_id: otherUserInstance.user_id,
                    fullname: otherUserInstance.fullname,
                    profile_picture: otherUserProfilePic || null
                } : null
            };
        });

        res.status(200).json({ chats: formattedChats });
    } catch (error) {
        console.error(`Error fetching chats for user ${loggedInUserId}:`, error);
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
