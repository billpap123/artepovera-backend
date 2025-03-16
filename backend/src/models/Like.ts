import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db'; // Import your Sequelize instance
import User from './User'; // Import User model
import Notification from './Notification';

class Like extends Model {
  public like_id!: number;
  public user_id!: number; // User who liked
  public liked_user_id!: number; // User being liked
  public readonly created_at!: Date; // Timestamp of the like
}

Like.init(
  {
    like_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'user_id',
      },
      onDelete: 'CASCADE',
    },
    liked_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'user_id',
      },
      onDelete: 'CASCADE',
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'likes',
    timestamps: false, // Disable updatedAt and createdAt
  }
);

Like.belongsTo(User, { as: 'liker', foreignKey: 'user_id' }); // Who gave the like
Like.belongsTo(User, { as: 'likedUser', foreignKey: 'liked_user_id' }); // Who received the like
Notification.belongsTo(Like, { foreignKey: 'like_id', as: 'likeDetails' });


export default Like;
