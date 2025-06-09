// src/models/Review.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelizeInstance from '../config/db';
import User from './User';
// The Chat model is no longer needed or imported here

// This interface now has NO reference to chat_id
export interface ReviewAttributes {
  review_id: number;
  reviewer_user_id: number;
  reviewed_user_id: number;
  overall_rating: number;
  specific_answers?: object | null;
  // createdAt and updatedAt are managed by Sequelize, not part of this interface
}

// Creation attributes
interface ReviewCreationAttributes extends Optional<ReviewAttributes, 'review_id' | 'specific_answers'> {}

class Review extends Model<ReviewAttributes, ReviewCreationAttributes> implements ReviewAttributes {
  public review_id!: number;
  public reviewer_user_id!: number;
  public reviewed_user_id!: number;
  public overall_rating!: number;
  public specific_answers!: object | null;

  // Standard Sequelize instance properties for timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associated models
  public readonly reviewer?: User;
  public readonly reviewed?: User;
  // The 'chat' association has been completely removed
}

Review.init({
  review_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  // --- The chat_id attribute definition is completely removed from init() ---
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