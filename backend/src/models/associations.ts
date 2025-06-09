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
  onDelete: 'CASCADE' // <<< ADD THIS: Deletes Artist profile when User is deleted
});
Artist.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 2) User <-> Employer Profile
User.hasOne(Employer, {
  foreignKey: 'user_id',
  as: 'employerProfile',
  onDelete: 'CASCADE' // <<< ADD THIS: Deletes Employer profile when User is deleted
});
Employer.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 3) Chat <-> Artist & Chat <-> Employer
// These associations are from Chat to Artist/Employer, not directly to User.
// The deletion of Artist/Employer profiles (handled by the above) should cascade to these.
Chat.belongsTo(Artist, { foreignKey: 'artist_user_id', targetKey: 'artist_id', as: 'chatArtistProfile' });
Artist.hasMany(Chat, { foreignKey: 'artist_user_id', sourceKey: 'artist_id' });

Chat.belongsTo(Employer, { foreignKey: 'employer_user_id', targetKey: 'employer_id', as: 'chatEmployerProfile' });
Employer.hasMany(Chat, { foreignKey: 'employer_user_id', sourceKey: 'employer_id' });

// 4) Chat <-> Message
Chat.hasMany(Message, {
  foreignKey: 'chat_id',
  as: 'chatMessages',
  onDelete: 'CASCADE' // Deletes messages if a chat is deleted
});
Message.belongsTo(Chat, { foreignKey: 'chat_id', as: 'chat' });

// 5) Message <-> User (for sender and receiver)
Message.belongsTo(User, { foreignKey: 'sender_id', as: 'messageSender' });
Message.belongsTo(User, { foreignKey: 'receiver_id', as: 'messageReceiver' });
// Add the corresponding hasMany with cascade
User.hasMany(Message, { foreignKey: 'sender_id', as: 'sentMessages', onDelete: 'CASCADE' });
User.hasMany(Message, { foreignKey: 'receiver_id', as: 'receivedMessages', onDelete: 'CASCADE' });

// 6) JobPosting <-> Employer
JobPosting.belongsTo(Employer, { foreignKey: 'employer_id', as: 'employer' });
Employer.hasMany(JobPosting, {
  foreignKey: 'employer_id',
  as: 'jobPostings',
  onDelete: 'CASCADE' // Deletes job postings if an employer is deleted
});



Review.belongsTo(User, { foreignKey: 'reviewer_user_id', as: 'reviewer' });
User.hasMany(Review, {
  foreignKey: 'reviewer_user_id',
  as: 'reviewsGiven',
  onDelete: 'CASCADE' // <<< ADD THIS: Deletes reviews a user has written
});

Review.belongsTo(User, { foreignKey: 'reviewed_user_id', as: 'reviewed' });
User.hasMany(Review, {
  foreignKey: 'reviewed_user_id',
  as: 'reviewsReceived',
  onDelete: 'CASCADE' // <<< ADD THIS: Deletes reviews a user has received
});

// Portfolio Associations
Portfolio.belongsTo(Artist, { foreignKey: 'artist_id', targetKey: 'artist_id', as: 'artist' });
Artist.hasMany(Portfolio, {
  foreignKey: 'artist_id',
  sourceKey: 'artist_id',
  as: 'portfolioItems',
  onDelete: 'CASCADE' // Deletes portfolio items if an artist is deleted
});

// Job Application Associations
JobPosting.hasMany(JobApplication, { foreignKey: 'job_id', as: 'applications', onDelete: 'CASCADE' });
JobApplication.belongsTo(JobPosting, { foreignKey: 'job_id', as: 'jobPostingDetails' });

User.hasMany(JobApplication, {
  foreignKey: 'artist_user_id',
  as: 'jobApplicationsMade',
  onDelete: 'CASCADE' // <<< ADD THIS: Deletes applications a user has made
});
JobApplication.belongsTo(User, { foreignKey: 'artist_user_id', as: 'applyingArtistDetails' });

// Artist Support Associations
User.hasMany(ArtistSupport, {
  foreignKey: 'supporter_artist_user_id',
  as: 'givenSupports',
  onDelete: 'CASCADE' // <<< ADD THIS
});
ArtistSupport.belongsTo(User, { foreignKey: 'supporter_artist_user_id', as: 'supporterArtist' });

User.hasMany(ArtistSupport, {
  foreignKey: 'supported_artist_user_id',
  as: 'receivedSupports',
  onDelete: 'CASCADE' // <<< ADD THIS
});
ArtistSupport.belongsTo(User, { foreignKey: 'supported_artist_user_id', as: 'supportedArtist' });

// Artist Profile Comment Associations
ArtistComment.belongsTo(User, { foreignKey: 'profile_user_id', as: 'commentedProfileUser' });
User.hasMany(ArtistComment, {
  foreignKey: 'profile_user_id',
  as: 'receivedProfileComments',
  onDelete: 'CASCADE' // <<< ADD THIS
});

ArtistComment.belongsTo(User, { foreignKey: 'commenter_user_id', as: 'commenterArtist' });
User.hasMany(ArtistComment, {
  foreignKey: 'commenter_user_id',
  as: 'writtenProfileComments',
  onDelete: 'CASCADE' // <<< ADD THIS
});