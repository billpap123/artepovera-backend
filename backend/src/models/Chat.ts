import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';

interface ChatAttributes {
  chat_id: number;
  artist_id: number;
  employer_id: number;
  created_at: Date;
}

interface ChatCreationAttributes extends Optional<ChatAttributes, 'chat_id'> {}

class Chat extends Model<ChatAttributes, ChatCreationAttributes> implements ChatAttributes {
  public chat_id!: number;
  public artist_id!: number;
  public employer_id!: number;
  public created_at!: Date;
}

Chat.init(
  {
    chat_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    artist_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'artists', // The actual table name
        key: 'artist_id',
      },
    },
    employer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'employers', // The actual table name
        key: 'employer_id',
      },
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
