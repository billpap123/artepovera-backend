import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db'; 
import User from './User'; 
import Notification from './Notification';

class Like extends Model {
  public like_id!: number;
  public user_id!: number;       // user who liked
  public liked_user_id!: number; // user being liked
  public readonly created_at!: Date;
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
    timestamps: false,
  }
);

Like.belongsTo(User, { as: 'liker', foreignKey: 'user_id' });
Like.belongsTo(User, { as: 'likedUser', foreignKey: 'liked_user_id' });
Notification.belongsTo(Like, { foreignKey: 'like_id', as: 'likeDetails' });

export default Like;
