// models/Message.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';
import Chat from './Chat';
import User from './User';

interface MessageAttributes {
  message_id: number;
  chat_id: number;
  sender_id: number;
  receiver_id: number;
  message: string;
  created_at: Date;
}

interface MessageCreationAttributes extends Optional<MessageAttributes, 'message_id'> {}

class Message extends Model<MessageAttributes, MessageCreationAttributes> implements MessageAttributes {
  public message_id!: number;
  public chat_id!: number;
  public sender_id!: number;
  public receiver_id!: number;
  public message!: string;
  public created_at!: Date;
}

Message.init(
  {
    message_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    chat_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Chat,
        key: 'chat_id',
      },
    },
    sender_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'user_id',
      },
    },
    receiver_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'user_id',
      },
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'messages',
    timestamps: false,
  }
);

export default Message;
