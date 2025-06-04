// src/models/Review.ts
import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import sequelizeInstance from '../config/db'; // Ensure this is your exported sequelize instance
import User from './User';
import Chat from './Chat';

interface ReviewAttributes {
  review_id: number;
  chat_id?: number | null; // MADE OPTIONAL AND NULLABLE
  reviewer_user_id: number;
  reviewed_user_id: number;
  overall_rating: number;
  specific_answers?: object | null; //  'any' or a specific interface might be more flexible for JSON
}

interface ReviewCreationAttributes extends Optional<ReviewAttributes, 'review_id' | 'specific_answers' | 'chat_id'> {} // 'chat_id' ADDED HERE

class Review extends Model<ReviewAttributes, ReviewCreationAttributes>
  implements ReviewAttributes {
  public review_id!: number;
  public chat_id?: number | null; // MADE OPTIONAL AND NULLABLE
  public reviewer_user_id!: number;
  public reviewed_user_id!: number;
  public overall_rating!: number;
  public specific_answers?: object | null; // Made optional to match interface

  public readonly created_at!: Date;
  public readonly updatedAt!: Date; // Standard Sequelize camelCase for model property

  public readonly chat?: Chat;
  public readonly reviewer?: User;
  public readonly reviewed?: User; // Or 'reviewedUser'
}

Review.init({
  review_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  chat_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true, // ESSENTIAL CHANGE: Allow null
    references: { model: 'chats', key: 'chat_id' },
    onDelete: 'SET NULL', // Good practice for optional foreign keys
    onUpdate: 'CASCADE',
  },
  reviewer_user_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  reviewed_user_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  overall_rating: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    }
  },
  specific_answers: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  sequelize: sequelizeInstance, // Use your imported sequelize instance
  tableName: 'reviews',
  timestamps: true,
  underscored: true, // Maps model's camelCase (e.g., updatedAt) to DB's snake_case (e.g., updated_at)
});

export default Review;