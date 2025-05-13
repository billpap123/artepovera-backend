// src/models/associations.ts
import User from './User';
import Artist from './Artist';
import Employer from './Employer';
import Chat from './Chat';
import Message from './Message';
import JobPosting from './JobPosting';
import Review from './Review';

// 1) User <-> Artist Profile
User.hasOne(Artist, { foreignKey: 'user_id', as: 'artistProfile' });
Artist.belongsTo(User, { foreignKey: 'user_id', as: 'user' }); // <<< CORRECTED ALIAS to 'user'

// 2) User <-> Employer Profile
User.hasOne(Employer, { foreignKey: 'user_id', as: 'employerProfile' });
Employer.belongsTo(User, { foreignKey: 'user_id', as: 'user' }); // This one was already 'user'

// 3) Chat <-> Artist & Chat <-> Employer
// The Chat model attributes 'artist_user_id' and 'employer_user_id'
// map to DB columns 'artist_id' and 'employer_id' respectively.
// These DB columns are FKs to the 'artists.artist_id' and 'employers.employer_id'.

// --- CORRECTED CHAT ASSOCIATIONS ---
Chat.belongsTo(Artist, {
  foreignKey: 'artist_user_id',    // This is the attribute name in the Chat model
  targetKey: 'artist_id',         // This is the PK attribute name in the Artist model
  as: 'chatArtistProfile'         // Alias used in Chat.findAll includes
});
Artist.hasMany(Chat, {
  foreignKey: 'artist_user_id',    // Attribute name in Chat model that links to Artist
  sourceKey: 'artist_id'          // PK attribute in Artist model
  // as: 'artistChats' // Optional alias if you need to fetch chats from an Artist instance
});

Chat.belongsTo(Employer, {
  foreignKey: 'employer_user_id',  // Attribute name in Chat model
  targetKey: 'employer_id',      // PK attribute in Employer model
  as: 'chatEmployerProfile'      // Alias used in Chat.findAll includes
});
Employer.hasMany(Chat, {
  foreignKey: 'employer_user_id',  // Attribute name in Chat model
  sourceKey: 'employer_id'        // PK attribute in Employer model
  // as: 'employerChats' // Optional alias
});
// --- END CORRECTED CHAT ASSOCIATIONS ---

// 4) Chat <-> Message
Chat.hasMany(Message, { foreignKey: 'chat_id', as: 'chatMessages' });
Message.belongsTo(Chat, { foreignKey: 'chat_id', as: 'chat' });

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

// Make sure this file is imported ONCE in your application (e.g., in server.ts)
// AFTER all models are defined.