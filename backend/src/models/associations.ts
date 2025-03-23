import User from './User';
import Artist from './Artist';
import Employer from './Employer';
import Chat from './Chat';
import Message from './Message';
import JobPosting from './JobPosting';

// 1) Artist <-> User
User.hasOne(Artist, { foreignKey: 'user_id', as: 'artistProfile' });
Artist.belongsTo(User, { foreignKey: 'user_id', as: 'artistUserDetails' });

// 2) Employer <-> User
User.hasOne(Employer, { foreignKey: 'user_id', as: 'employerProfile' });
Employer.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 3) Chat <-> Artist/Employer
Chat.belongsTo(Artist, { foreignKey: 'artist_id', as: 'chatArtist' });
Chat.belongsTo(Employer, { foreignKey: 'employer_id', as: 'chatEmployer' });
Artist.hasMany(Chat, { foreignKey: 'artist_id', as: 'artistChats' });
Employer.hasMany(Chat, { foreignKey: 'employer_id', as: 'employerChats' });

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
