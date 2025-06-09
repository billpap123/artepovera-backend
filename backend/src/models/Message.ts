// src/models/Message.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelizeInstance from '../config/db';
import User from './User';
import Chat from './Chat';

export interface MessageAttributes {
  message_id: number;
  chat_id: number;
  sender_id: number;
  receiver_id: number;
  message: string;
  read_status?: boolean;
  createdAt?: Date;
}

interface MessageCreationAttributes extends Optional<MessageAttributes, 'message_id' | 'read_status' | 'createdAt'> {}

class Message extends Model<MessageAttributes, MessageCreationAttributes> implements MessageAttributes {
  public message_id!: number;
  public chat_id!: number;
  public sender_id!: number;
  public receiver_id!: number;
  public message!: string;
  public read_status!: boolean;

  public readonly createdAt!: Date;
  
  // Associations
  public readonly chat?: Chat;
  public readonly messageSender?: User;
  public readonly messageReceiver?: User;
}

Message.init({
  message_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  chat_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: 'chats', key: 'chat_id' }
  },
  sender_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  receiver_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: 'users', key: 'user_id' }
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  read_status: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  }
}, {
  sequelize: sequelizeInstance,
  tableName: 'messages',
  timestamps: true,      // Enables createdAt and updatedAt
  updatedAt: false,      // We don't need updatedAt for messages
  underscored: true,     // DB column will be created_at
});

export default Message;