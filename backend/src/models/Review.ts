// src/models/Review.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelizeInstance from '../config/db';
import User from './User';

// This interface now has no reference to chatId
export interface ReviewAttributes {
  review_id: number;
  reviewer_user_id: number;
  reviewed_user_id: number;
  overall_rating: number;
  specific_answers?: object | null;
  createdAt?: Date;
  updatedAt?: Date;
}

// Creation attributes
interface ReviewCreationAttributes extends Optional<ReviewAttributes, 'review_id' | 'specific_answers' | 'createdAt' | 'updatedAt'> {}

class Review extends Model<ReviewAttributes, ReviewCreationAttributes> implements ReviewAttributes {
  public review_id!: number;
  public reviewer_user_id!: number;
  public reviewed_user_id!: number;
  public overall_rating!: number;
  public specific_answers!: object | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public readonly reviewer?: User;
  public readonly reviewed?: User;
}

Review.init({
  review_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  // --- chat_id field is now completely removed ---
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
    validate: { min: 1, max: 5 }
  },
  specific_answers: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  sequelize: sequelizeInstance,
  tableName: 'reviews',
  timestamps: true,
  underscored: true,
});

export default Review;