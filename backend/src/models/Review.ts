import { Model, DataTypes, Optional } from 'sequelize';
import sequelizeInstance from '../config/db';
import User from './User';

// 1. UPDATE The interface to include the new database columns
export interface ReviewAttributes {
  review_id: number;
  reviewer_user_id: number;
  reviewed_user_id: number;
  overall_rating: number | null; // <-- FIX: Made nullable
  specific_answers?: object | null;
  
  // --- ADD New DB columns ---
  deal_made: boolean | null;
  communication_rating_no_deal: number | null;
  no_deal_primary_reason: string | null;
}

// Creation attributes can remain mostly the same
interface ReviewCreationAttributes extends Optional<ReviewAttributes, 'review_id' | 'specific_answers' | 'deal_made' | 'communication_rating_no_deal' | 'no_deal_primary_reason' > {}

class Review extends Model<ReviewAttributes, ReviewCreationAttributes> implements ReviewAttributes {
  public review_id!: number;
  public reviewer_user_id!: number;
  public reviewed_user_id!: number;
  public overall_rating!: number | null; // <-- FIX: Made nullable
  public specific_answers!: object | null;

  // --- ADD New class properties to match the database ---
  public deal_made!: boolean | null;
  public communication_rating_no_deal!: number | null;
  public no_deal_primary_reason!: string | null;


  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public readonly reviewer?: User;
  public readonly reviewed?: User;
}

// 2. UPDATE the init() method to define the new columns and validation rules
Review.init({
  review_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
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
    allowNull: true, // <-- FIX: Set to true. This is critical for "no" reviews.
    validate: {
      min: 1,
      max: 5,
    }
  },
  specific_answers: {
    type: DataTypes.JSON,
    allowNull: true,
  },

  // --- ADD definitions for the new columns ---
  deal_made: {
    type: DataTypes.BOOLEAN, // Corresponds to TINYINT(1) in MySQL
    allowNull: true, // Set to true to be safe, but our form should always provide it
  },
  communication_rating_no_deal: {
    type: DataTypes.INTEGER,
    allowNull: true, // Only exists for "no" deals
    validate: {
      min: 1,
      max: 5
    }
  },
  no_deal_primary_reason: {
    type: DataTypes.STRING,
    allowNull: true, // Only exists for "no" deals
  }

}, {
  sequelize: sequelizeInstance,
  tableName: 'reviews',
  timestamps: true,
  underscored: true,
});

export default Review;