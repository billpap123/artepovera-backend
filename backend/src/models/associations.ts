// src/models/associations.ts
import User from './User';
import Artist from './Artist';
import Employer from './Employer';
import Chat from './Chat';
import Message from './Message';
import JobPosting from './JobPosting';
import Review from './Review';
import Portfolio from './Portfolio';
import JobApplication from './JobApplication';
import ArtistSupport from './ArtistSupport';
import ArtistComment from './ArtistComment';

// 1) User <-> Artist Profile
User.hasOne(Artist, {
  foreignKey: 'user_id',
  as: 'artistProfile',
  onDelete: 'CASCADE'
});
Artist.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 2) User <-> Employer Profile
User.hasOne(Employer, {
  foreignKey: 'user_id',
  as: 'employerProfile',
  onDelete: 'CASCADE'
});
Employer.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// --- 3) CHAT ASSOCIATIONS (UPDATED) ---
// A chat now has two direct associations to the User model.
Chat.belongsTo(User, { foreignKey: 'user1_id', as: 'user1' });
Chat.belongsTo(User, { foreignKey: 'user2_id', as: 'user2' });

// A User can be user1 in many chats, and user2 in many chats.
// Deleting a user will also delete any chats they are a part of.
User.hasMany(Chat, { foreignKey: 'user1_id', as: 'initiatedChats', onDelete: 'CASCADE' });
User.hasMany(Chat, { foreignKey: 'user2_id', as: 'receivedChats', onDelete: 'CASCADE' });

// 4) Chat <-> Message
Chat.hasMany(Message, {
  foreignKey: 'chat_id',
  as: 'chatMessages',
  onDelete: 'CASCADE'
});
Message.belongsTo(Chat, { foreignKey: 'chat_id', as: 'chat' });

// 5) Message <-> User (for sender and receiver)
Message.belongsTo(User, { foreignKey: 'sender_id', as: 'messageSender' });
Message.belongsTo(User, { foreignKey: 'receiver_id', as: 'messageReceiver' });
User.hasMany(Message, { foreignKey: 'sender_id', as: 'sentMessages', onDelete: 'CASCADE' });
User.hasMany(Message, { foreignKey: 'receiver_id', as: 'receivedMessages', onDelete: 'CASCADE' });

// 6) JobPosting <-> Employer
JobPosting.belongsTo(Employer, { foreignKey: 'employer_id', as: 'employer' });
Employer.hasMany(JobPosting, {
  foreignKey: 'employer_id',
  as: 'jobPostings',
  onDelete: 'CASCADE'
});

// --- 7) REVIEW ASSOCIATIONS (UPDATED) ---
// The link between Review and Chat has been removed.
Review.belongsTo(User, { foreignKey: 'reviewer_user_id', as: 'reviewer' });
User.hasMany(Review, {
  foreignKey: 'reviewer_user_id',
  as: 'reviewsGiven',
  onDelete: 'CASCADE'
});

Review.belongsTo(User, { foreignKey: 'reviewed_user_id', as: 'reviewed' });
User.hasMany(Review, {
  foreignKey: 'reviewed_user_id',
  as: 'reviewsReceived',
  onDelete: 'CASCADE'
});

// --- All other associations remain as they were ---

// Portfolio Associations
Portfolio.belongsTo(Artist, { foreignKey: 'artist_id', targetKey: 'artist_id', as: 'artist' });
Artist.hasMany(Portfolio, {
  foreignKey: 'artist_id',
  sourceKey: 'artist_id',
  as: 'portfolioItems',
  onDelete: 'CASCADE'
});

// Job Application Associations
JobPosting.hasMany(JobApplication, { foreignKey: 'job_id', as: 'applications', onDelete: 'CASCADE' });
JobApplication.belongsTo(JobPosting, { foreignKey: 'job_id', as: 'jobPostingDetails' });
User.hasMany(JobApplication, {
  foreignKey: 'artist_user_id',
  as: 'jobApplicationsMade',
  onDelete: 'CASCADE'
});
JobApplication.belongsTo(User, { foreignKey: 'artist_user_id', as: 'applyingArtistDetails' });

// Artist Support Associations
User.hasMany(ArtistSupport, {
  foreignKey: 'supporter_artist_user_id',
  as: 'givenSupports',
  onDelete: 'CASCADE'
});
ArtistSupport.belongsTo(User, { foreignKey: 'supporter_artist_user_id', as: 'supporterArtist' });
User.hasMany(ArtistSupport, {
  foreignKey: 'supported_artist_user_id',
  as: 'receivedSupports',
  onDelete: 'CASCADE'
});
ArtistSupport.belongsTo(User, { foreignKey: 'supported_artist_user_id', as: 'supportedArtist' });

// Artist Profile Comment Associations
ArtistComment.belongsTo(User, { foreignKey: 'profile_user_id', as: 'commentedProfileUser' });
User.hasMany(ArtistComment, {
  foreignKey: 'profile_user_id',
  as: 'receivedProfileComments',
  onDelete: 'CASCADE'
});
ArtistComment.belongsTo(User, { foreignKey: 'commenter_user_id', as: 'commenterArtist' });
User.hasMany(ArtistComment, {
  foreignKey: 'commenter_user_id',
  as: 'writtenProfileComments',
  onDelete: 'CASCADE'
});