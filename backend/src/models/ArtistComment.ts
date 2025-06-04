// src/models/ArtistComment.ts
import { Model, DataTypes, Optional, Sequelize } from 'sequelize';
import sequelizeInstance from '../config/db';
import User from './User'; // <<< IMPORT THE USER MODEL

export interface ArtistCommentAttributes {
  comment_id: number;
  profile_user_id: number;
  commenter_user_id: number;
  comment_text: string;
  created_at?: Date;
  updated_at?: Date;
}

interface ArtistCommentCreationAttributes extends Optional<ArtistCommentAttributes, 'comment_id' | 'created_at' | 'updated_at'> {}

class ArtistComment extends Model<ArtistCommentAttributes, ArtistCommentCreationAttributes> implements ArtistCommentAttributes {
  public comment_id!: number;
  public profile_user_id!: number;
  public commenter_user_id!: number;
  public comment_text!: string;

  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // --- ADD DECLARATIONS FOR ASSOCIATED MODELS ---
  // These names MUST match the 'as' alias used in your associations
  // and in your controller's 'include' statements.
  public readonly commenterArtist?: User; // For the User who wrote the comment
  public readonly commentedProfileUser?: User; // For the User whose profile was commented on
  // --- END ADD ---
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
}, {
  sequelize: sequelizeInstance,
  tableName: 'artist_profile_comments',
  timestamps: true,
  underscored: true,
});

export default ArtistComment;