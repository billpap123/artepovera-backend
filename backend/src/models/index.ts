import User from './User';
import Artist from './Artist';
import Employer from './Employer';
import JobPosting from './JobPosting';
import Chat from './Chat';
import Review from './Review';

// Define relationships
User.hasOne(Artist, { foreignKey: 'user_id' });
User.hasOne(Employer, { foreignKey: 'user_id' });
Employer.hasMany(JobPosting, { foreignKey: 'employer_id' });
Artist.hasMany(Chat, { foreignKey: 'artist_id' });
Employer.hasMany(Chat, { foreignKey: 'employer_id' });
Chat.belongsTo(Artist, { foreignKey: 'artist_id' });
Chat.belongsTo(Employer, { foreignKey: 'employer_id' });
Chat.hasMany(Review, { foreignKey: 'chat_id' });
Review.belongsTo(Chat, { foreignKey: 'chat_id' });

export { User, Artist, Employer, JobPosting, Chat, Review };
