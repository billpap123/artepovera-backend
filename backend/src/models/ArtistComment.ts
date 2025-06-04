// src/models/ArtistComment.ts
import { Model, DataTypes, Optional, Sequelize } from 'sequelize';
import sequelizeInstance from '../config/db'; // Your Sequelize instance
// User model will be associated in associations.ts, no need to import here for definition usually

export interface ArtistCommentAttributes {
  comment_id: number;
  profile_user_id: number; // The user_id of the artist whose profile is being commented on
  commenter_user_id: number; // The user_id of the artist who wrote the comment
  comment_text: string;
  created_at?: Date;
  updated_at?: Date;
}

// Some attributes are optional in creation (like comment_id, created_at, updated_at)
interface ArtistCommentCreationAttributes extends Optional<ArtistCommentAttributes, 'comment_id' | 'created_at' | 'updated_at'> {}

class ArtistComment extends Model<ArtistCommentAttributes, ArtistCommentCreationAttributes> implements ArtistCommentAttributes {
  public comment_id!: number;
  public profile_user_id!: number;
  public commenter_user_id!: number;
  public comment_text!: string;

  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Associations can be defined here or (preferably) in a central associations file
  // For example:
  // public readonly commenter?: User;
  // public readonly commentedProfile?: User;
}

ArtistComment.init({
  comment_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  profile_user_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    comment: 'FK to users table (profile being commented on)',
  },
  commenter_user_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    comment: 'FK to users table (user who wrote the comment)',
  },
  comment_text: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  // created_at and updated_at are handled by Sequelize's timestamps option
}, {
  sequelize: sequelizeInstance,
  tableName: 'artist_profile_comments', // Choose your table name
  timestamps: true, // This will add created_at and updated_at fields
  underscored: true, // For created_at and updated_at to be snake_case in DB
});

export default ArtistComment;