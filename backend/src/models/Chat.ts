// src/models/Chat.ts
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';

interface ChatAttributes {
  chat_id: number;
  artist_user_id: number;    // now referencing users.user_id
  employer_user_id: number;  // now referencing users.user_id
  created_at: Date;
}

interface ChatCreationAttributes extends Optional<ChatAttributes, 'chat_id'> {}

class Chat extends Model<ChatAttributes, ChatCreationAttributes> implements ChatAttributes {
  public chat_id!: number;
  public artist_user_id!: number;
  public employer_user_id!: number;
  public created_at!: Date;
}

Chat.init(
  {
    chat_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    artist_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    employer_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'chats',
    timestamps: false,
  }
);

export default Chat;
