// src/models/ArtistComment.ts
import { Model, DataTypes, Optional, Sequelize } from 'sequelize';
import sequelizeInstance from '../config/db'; // Your Sequelize instance
import User from './User'; // Import User model for association typing

// Interface for the attributes of an ArtistComment (columns you directly manage)
export interface ArtistCommentAttributes {
  comment_id: number;
  profile_user_id: number; // The user_id of the artist whose profile is being commented on
  commenter_user_id: number; // The user_id of the artist who wrote the comment
  comment_text: string;
  // createdAt and updatedAt are managed by Sequelize via `timestamps: true`,
  // so they are not typically part of this interface for creation/update purposes.
  support_rating: number; // <-- 1. ADDED HERE
  commenterArtist?: User;
  commentedProfileUser?: User;

}

// Interface for attributes passed to ArtistComment.create()
// comment_id is auto-generated. createdAt and updatedAt are auto-managed by Sequelize.
interface ArtistCommentCreationAttributes extends Optional<ArtistCommentAttributes, 'comment_id'> {}

class ArtistComment extends Model<ArtistCommentAttributes, ArtistCommentCreationAttributes> implements ArtistCommentAttributes {
  public comment_id!: number;
  public profile_user_id!: number;
  public commenter_user_id!: number;
  public comment_text!: string;
  public support_rating!: number; // <-- 2. ADDED HERE

  // --- STANDARD SEQUELIZE INSTANCE PROPERTIES (camelCase) ---
  // These are automatically added by Sequelize if timestamps: true in init options.
  // Your controller should access these properties on the model instance.
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  // --- END STANDARD ---

  // Declarations for Associated Models
  // These names MUST match the 'as' alias used in your associations
  // and in your controller's 'include' statements.
  public readonly commenterArtist?: User; // For the User who wrote the comment (associated as 'commenterArtist')
  public readonly commentedProfileUser?: User; // For the User whose profile was commented on
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
        model: 'users', // Name of the User table in your database
        key: 'user_id',
      }
    },
    commenter_user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      comment: 'FK to users table (user who wrote the comment)',
      references: { // Optional: Add explicit FK reference
        model: 'users', // Name of the User table in your database
        key: 'user_id',
      }
    },
    comment_text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
       // --- 3. ADDED THIS NEW COLUMN DEFINITION ---
       support_rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1, // Ensures the rating is at least 1
            max: 5  // Ensures the rating is at most 5
        }
    }
    // `created_at` and `updated_at` columns are automatically defined by Sequelize
    // in the database due to `timestamps: true` and named with snake_case
    // due to `underscored: true`. You do NOT define them here in the attributes block.
  },
  {
    sequelize: sequelizeInstance,
    tableName: 'artist_profile_comments', // Your chosen table name
    timestamps: true,  // This enables Sequelize to manage createdAt and updatedAt columns
    underscored: true, // This ensures:
                       // 1. Database columns are `created_at` and `updated_at`.
                       // 2. Plain objects from .get({ plain: true }) or .toJSON()
                       //    will have `created_at` and `updated_at` as keys.
  }
);

export default ArtistComment;