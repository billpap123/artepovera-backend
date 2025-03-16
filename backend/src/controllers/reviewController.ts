/*
import { Request, Response, NextFunction } from 'express';
import Review from '../models/Review';
import Chat from '../models/Chat';
import User from '../models/User'; // Import the User model
import { sendReviewEmail } from '../utils/mailer'; // Adjust the import path

//export const createReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
 // try {
   // const { chat_id, rating, comment } = req.body;

    // Create the review in the database
    const review = await Review.create({
      chat_id,
      rating,
      comment,
    });

    // Find the chat and associated users (artist and employer)
    const chat = await Chat.findByPk(chat_id, {
      include: [
        { model: User, as: 'Artist', attributes: ['email'] },
        { model: User, as: 'Employer', attributes: ['email'] },
      ],
    });

    if (!chat) {
      res.status(404).json({ message: 'Chat not found' });
      return;
    }

    // Extract emails from the associated users
    const artistEmail = chat.Artist?.email;
    const employerEmail = chat.Employer?.email;

    if (!artistEmail || !employerEmail) {
      res.status(500).json({ message: 'User emails not found' });
      return;
    }

    // Generate the review link
    const reviewLink = `http://yourfrontendurl.com/review/${review.review_id}`;

    // Send emails to the artist and employer
    await sendReviewEmail(artistEmail, reviewLink);
    await sendReviewEmail(employerEmail, reviewLink);

    // Respond with the created review
    res.status(201).json(review);
  } catch (error) {
    console.error('Error creating review:', error);
    next(error);
  }
};
*/