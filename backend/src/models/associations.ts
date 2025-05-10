import User from './User';
import Artist from './Artist';
import Employer from './Employer';
import Chat from './Chat';
import Message from './Message';
import JobPosting from './JobPosting';
import Review from './Review';
// 1) Artist <-> User
User.hasOne(Artist, { foreignKey: 'user_id', as: 'artistProfile' });
Artist.belongsTo(User, { foreignKey: 'user_id', as: 'artistUserDetails' });

// 2) Employer <-> User
User.hasOne(Employer, { foreignKey: 'user_id', as: 'employerProfile' });
Employer.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
// Chat -> belongsTo(User) for the artist side
Chat.belongsTo(User, { foreignKey: 'artist_user_id', as: 'artistUser' });
// Chat -> belongsTo(User) for the employer side
Chat.belongsTo(User, { foreignKey: 'employer_user_id', as: 'employerUser' });

// Optionally, if you want reverse associations:
User.hasMany(Chat, { foreignKey: 'artist_user_id', as: 'chatsAsArtist' });
User.hasMany(Chat, { foreignKey: 'employer_user_id', as: 'chatsAsEmployer' });
// 4) Chat <-> Message
Chat.hasMany(Message, { foreignKey: 'chat_id', as: 'chatMessages' });
Message.belongsTo(Chat, { foreignKey: 'chat_id', as: 'chatMessages' });

// 5) Message <-> User
Message.belongsTo(User, { foreignKey: 'sender_id', as: 'messageSender' });
Message.belongsTo(User, { foreignKey: 'receiver_id', as: 'messageReceiver' });

// JobPosting <-> Employer
JobPosting.belongsTo(Employer, {
  as: 'employer',
  foreignKey: 'employer_id',
});
Employer.hasMany(JobPosting, {
  as: 'jobPostings',
  foreignKey: 'employer_id',
});
// src/models/associations.ts
// ... other associations ...
Review.belongsTo(Chat, { foreignKey: 'chat_id', as: 'chat' });
Chat.hasMany(Review, { foreignKey: 'chat_id', as: 'reviews' });

Review.belongsTo(User, { foreignKey: 'reviewer_user_id', as: 'reviewer' });
User.hasMany(Review, { foreignKey: 'reviewer_user_id', as: 'reviewsGiven' });

Review.belongsTo(User, { foreignKey: 'reviewed_user_id', as: 'reviewed' });
User.hasMany(Review, { foreignKey: 'reviewed_user_id', as: 'reviewsReceived' });