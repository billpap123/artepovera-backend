// src/models/Review.ts
import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import sequelize from '../config/db'; // Adjust path if needed
import User from './User'; // Import User model
import Chat from './Chat'; // Import Chat model

// Define attributes for the Review model
interface ReviewAttributes {
  review_id: number;
  chat_id: number;
  reviewer_user_id: number;
  reviewed_user_id: number;
  overall_rating: number; // Assuming 1-5
  specific_answers: object | null; // Using object for JSON type
  // created_at and updated_at managed by Sequelize timestamps
}

// Define creation attributes (review_id is optional on creation)
interface ReviewCreationAttributes extends Optional<ReviewAttributes, 'review_id' | 'specific_answers'> {}

class Review extends Model<ReviewAttributes, ReviewCreationAttributes>
  implements ReviewAttributes {
  public review_id!: number;
  public chat_id!: number;
  public reviewer_user_id!: number;
  public reviewed_user_id!: number;
  public overall_rating!: number;
  public specific_answers!: object | null;

  // Timestamps
  public readonly created_at!: Date;
  public readonly updatedAt!: Date;

  // Define associations here if preferred, or in a central associations file
   public readonly chat?: Chat;
   public readonly reviewer?: User;
   public readonly reviewed?: User;
}

Review.init({
  review_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  chat_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: 'chats', key: 'chat_id' } // Verify table/key names
  },
  reviewer_user_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: 'users', key: 'user_id' } // Verify table/key names
  },
  reviewed_user_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: 'users', key: 'user_id' } // Verify table/key names
  },
  overall_rating: {
    type: DataTypes.TINYINT.UNSIGNED, // Efficient for 1-5
    allowNull: false,
    validate: { // Add Sequelize validation
      min: 1,
      max: 5
    }
  },
  specific_answers: {
    type: DataTypes.JSON, // Use JSON type
    allowNull: true,
  },
  // created_at and updated_at automatically added by timestamps: true
}, {
  sequelize,
  tableName: 'reviews', // Verify table name
  timestamps: true, // Enable createdAt and updatedAt
  underscored: true, // Use snake_case for createdAt/updatedAt to match default
});

// Define associations (can also be in src/models/associations.ts)
// Review.belongsTo(Chat, { foreignKey: 'chat_id', as: 'chat' });
// Review.belongsTo(User, { foreignKey: 'reviewer_user_id', as: 'reviewer' });
// Review.belongsTo(User, { foreignKey: 'reviewed_user_id', as: 'reviewed' });

export default Review;