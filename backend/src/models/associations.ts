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
// 1) User <-> Artist Profile
User.hasOne(Artist, { foreignKey: 'user_id', as: 'artistProfile' });
Artist.belongsTo(User, { foreignKey: 'user_id', as: 'user' }); // <<< CORRECTED ALIAS to 'user'

// 2) User <-> Employer Profile
User.hasOne(Employer, { foreignKey: 'user_id', as: 'employerProfile' });
Employer.belongsTo(User, { foreignKey: 'user_id', as: 'user' }); // This alias is correct

// 3) Chat <-> Artist & Chat <-> Employer
// Chat model's 'artist_user_id' attribute maps to DB 'artist_id' (PK of Artist table)
// Chat model's 'employer_user_id' attribute maps to DB 'employer_id' (PK of Employer table)

Chat.belongsTo(Artist, {
  foreignKey: 'artist_user_id',    // This is the attribute name in the Chat model
  targetKey: 'artist_id',         // This is the PK attribute name in the Artist model
  as: 'chatArtistProfile'         // <<< Alias used in Chat.findAll includes
});
Artist.hasMany(Chat, {
  foreignKey: 'artist_user_id',    // Attribute name in Chat model that links to Artist
  sourceKey: 'artist_id',          // PK attribute in Artist model
  // as: 'artistChats' // Optional alias for reverse if you need to fetch chats from an Artist instance
});

Chat.belongsTo(Employer, {
  foreignKey: 'employer_user_id',  // Attribute name in Chat model
  targetKey: 'employer_id',      // PK attribute in Employer model
  as: 'chatEmployerProfile'      // <<< Alias used in Chat.findAll includes
});
Employer.hasMany(Chat, {
  foreignKey: 'employer_user_id',  // Attribute name in Chat model
  sourceKey: 'employer_id',        // PK attribute in Employer model
  // as: 'employerChats' // Optional alias
});

// User.hasMany(Chat, ...) for artist_user_id and employer_user_id are removed
// because those fields in Chat now reference Artist/Employer PKs, not User PKs.
// Fetching chats for a specific user is handled by the logic in chatController.fetchMessages.

// 4) Chat <-> Message
Chat.hasMany(Message, { foreignKey: 'chat_id', as: 'chatMessages' });
Message.belongsTo(Chat, { foreignKey: 'chat_id', as: 'chat' }); // Using 'chat' for symmetry

// 5) Message <-> User (for sender and receiver)
Message.belongsTo(User, { foreignKey: 'sender_id', as: 'messageSender' });
Message.belongsTo(User, { foreignKey: 'receiver_id', as: 'messageReceiver' });

// 6) JobPosting <-> Employer
JobPosting.belongsTo(Employer, {
  foreignKey: 'employer_id',
  as: 'employer'
});
Employer.hasMany(JobPosting, {
  foreignKey: 'employer_id',
  as: 'jobPostings'
});

// 7) Review <-> Chat & Review <-> User
Review.belongsTo(Chat, { foreignKey: 'chat_id', as: 'chat' });
Chat.hasMany(Review, { foreignKey: 'chat_id', as: 'reviews' });

Review.belongsTo(User, { foreignKey: 'reviewer_user_id', as: 'reviewer' });
User.hasMany(Review, { foreignKey: 'reviewer_user_id', as: 'reviewsGiven' });

Review.belongsTo(User, { foreignKey: 'reviewed_user_id', as: 'reviewed' });
User.hasMany(Review, { foreignKey: 'reviewed_user_id', as: 'reviewsReceived' });

// Portfolio Associations
Portfolio.belongsTo(Artist, {
  foreignKey: 'artist_id',
  targetKey: 'artist_id',
  as: 'artist'
});
Artist.hasMany(Portfolio, {
  foreignKey: 'artist_id',
  sourceKey: 'artist_id',
  as: 'portfolioItems'
});

// Job Application Associations
JobPosting.hasMany(JobApplication, { foreignKey: 'job_id', as: 'applications' });
JobApplication.belongsTo(JobPosting, { foreignKey: 'job_id', as: 'jobPostingDetails' });

User.hasMany(JobApplication, { foreignKey: 'artist_user_id', as: 'jobApplicationsMade' });
JobApplication.belongsTo(User, { foreignKey: 'artist_user_id', as: 'applyingArtistDetails' });
// User (as supporter) -> ArtistSupport
User.hasMany(ArtistSupport, {
  foreignKey: 'supporter_artist_user_id',
  as: 'givenSupports'
});
ArtistSupport.belongsTo(User, {
  foreignKey: 'supporter_artist_user_id',
  as: 'supporterArtist'
});

// User (as supported) -> ArtistSupport
User.hasMany(ArtistSupport, {
  foreignKey: 'supported_artist_user_id',
  as: 'receivedSupports'
});
ArtistSupport.belongsTo(User, {
  foreignKey: 'supported_artist_user_id',
  as: 'supportedArtist'
});
// Make sure this file is imported ONCE in your application (e.g., in server.ts)
// AFTER all models are defined and initialized by Sequelize.
// Example: import './models/associations';