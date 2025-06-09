// src/models/Chat.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelizeInstance from '../config/db';
import User from './User';

// This interface defines all the attributes of a Chat instance
export interface ChatAttributes {
  chat_id: number;
  user1_id: number;
  user2_id: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Defines which attributes are optional when creating a new chat
interface ChatCreationAttributes extends Optional<ChatAttributes, 'chat_id' | 'createdAt' | 'updatedAt'> {}

class Chat extends Model<ChatAttributes, ChatCreationAttributes> implements ChatAttributes {
  public chat_id!: number;
  public user1_id!: number;
  public user2_id!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // For included associations
  public readonly user1?: User;
  public readonly user2?: User;
}

Chat.init({
  chat_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  user1_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  user2_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
}, {
  sequelize: sequelizeInstance,
  tableName: 'chats',
  timestamps: true,
  underscored: true,
});

export default Chat;