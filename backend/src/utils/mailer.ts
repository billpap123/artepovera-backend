// src/utils/mailer.ts

import nodemailer from 'nodemailer';

// Create a transporter for sending emails
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can use any service like Gmail, SendGrid, etc.
  auth: {
    user: process.env.EMAIL_USER, // Your email address
    pass: process.env.EMAIL_PASS,  // Your email password or app-specific password
  },
});

// Function to send review request email
export const sendReviewEmail = async (to: string, reviewLink: string) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject: 'We value your feedback!',
    text: `Please take a moment to provide your feedback on your recent interaction. You can submit your review using the following link: ${reviewLink}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Review email sent successfully!');
  } catch (error) {
    console.error('Error sending email:', error);
  }
};
