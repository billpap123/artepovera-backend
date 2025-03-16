import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';

class Review extends Model {
  public review_id!: number;
  public chat_id!: number;
  public rating?: number;
  public comment?: string;
  public created_at!: Date;
}

Review.init(
  {
    review_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    chat_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    rating: {
      type: DataTypes.INTEGER,
      validate: {
        min: 1,
        max: 5,
      },
      allowNull: true,
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'reviews',
    timestamps: false,
  }
);

export default Review;
