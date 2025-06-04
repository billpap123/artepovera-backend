// src/models/ArtistComment.ts
import { Model, DataTypes, Optional, Sequelize } from 'sequelize';
import sequelizeInstance from '../config/db'; // Your Sequelize instance
import User from './User'; // Import User model for association typing

// Interface for the attributes of an ArtistComment (direct columns)
export interface ArtistCommentAttributes {
  comment_id: number;
  profile_user_id: number; // The user_id of the artist whose profile is being commented on
  commenter_user_id: number; // The user_id of the artist who wrote the comment
  comment_text: string;
  // createdAt and updatedAt are managed by Sequelize via timestamps: true,
  // so they are not typically part of the "creation" attributes passed by the user.
  // They will be available on instances and plain objects.
}

// Interface for attributes passed to ArtistComment.create()
// comment_id is auto-generated. createdAt and updatedAt are auto-managed.
interface ArtistCommentCreationAttributes extends Optional<ArtistCommentAttributes, 'comment_id'> {}

class ArtistComment extends Model<ArtistCommentAttributes, ArtistCommentCreationAttributes> implements ArtistCommentAttributes {
  public comment_id!: number;
  public profile_user_id!: number;
  public commenter_user_id!: number;
  public comment_text!: string;

  // Standard Sequelize instance properties for timestamps (camelCase)
  // These are automatically added by Sequelize if timestamps: true
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // --- Declarations for Associated Models ---
  // These names MUST match the 'as' alias used in your associations
  // and in your controller's 'include' statements.
  public readonly commenterArtist?: User; // For the User who wrote the comment (associated as 'commenterArtist')
  public readonly commentedProfileUser?: User; // For the User whose profile was commented on (associated as 'commentedProfileUser')
  // --- End Declarations ---
}

ArtistComment.init(
  {
    comment_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    profile_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      comment: 'FK to users table (profile being commented on)',
      references: { // Optional: Add explicit FK reference for clarity and DB integrity
        model: 'users', // Name of the User table
        key: 'user_id',
      }
    },
    commenter_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      comment: 'FK to users table (user who wrote the comment)',
      references: { // Optional: Add explicit FK reference
        model: 'users', // Name of the User table
        key: 'user_id',
      }
    },
    comment_text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    // `created_at` and `updated_at` columns are automatically defined by Sequelize
    // due to `timestamps: true` and named with snake_case due to `underscored: true`.
    // You do not define them here in the attributes.
  },
  {
    sequelize: sequelizeInstance,
    tableName: 'artist_profile_comments', // Your chosen table name
    timestamps: true,  // This enables createdAt and updatedAt columns
    underscored: true, // This makes database columns `created_at` and `updated_at`
                       // AND it makes plain objects from .get({ plain: true }) or .toJSON()
                       // use `created_at` and `updated_at` as keys.
  }
);

export default ArtistComment;