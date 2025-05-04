// src/models/Chat.ts
import { Model, DataTypes, Optional, Sequelize } from 'sequelize';
import sequelize from '../config/db';
// Import User model if defining associations here
// import User from './User';

// Define attributes matching the *model* perspective
interface ChatAttributes {
  chat_id: number;
  artist_user_id: number; // Keep consistent JS name (camelCase or snake_case)
  employer_user_id: number; // Keep consistent JS name
  message_count: number;
  artist_rating_status: 'pending' | 'prompted_10' | 'prompted_20' | 'declined' | 'completed';
  employer_rating_status: 'pending' | 'prompted_10' | 'prompted_20' | 'declined' | 'completed';
  // Timestamps managed by Sequelize
  created_at?: Date; // Use snake_case if underscored: true
  updated_at?: Date; // Use snake_case if underscored: true
}

// Define creation attributes (make optional fields with defaults/autoIncrement)
interface ChatCreationAttributes extends Optional<ChatAttributes, 'chat_id' | 'message_count' | 'artist_rating_status' | 'employer_rating_status' | 'created_at' | 'updated_at'> {}

class Chat extends Model<ChatAttributes, ChatCreationAttributes> implements ChatAttributes {
  public chat_id!: number;
  public artist_user_id!: number;
  public employer_user_id!: number;
  public message_count!: number;
  public artist_rating_status!: 'pending' | 'prompted_10' | 'prompted_20' | 'declined' | 'completed';
  public employer_rating_status!: 'pending' | 'prompted_10' | 'prompted_20' | 'declined' | 'completed';

  // Timestamps managed by Sequelize
  public readonly created_at!: Date; // Use snake_case if underscored: true
  public readonly updatedAt!: Date; // Use snake_case if underscored: true

  // Define associations here or in associations file
  // public readonly artistUser?: User;
  // public readonly employerUser?: User;
}

Chat.init(
  {
    chat_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'chat_id' // Explicitly map to column name (good practice)
    },
    // Model attribute name (JS): artist_user_id
    // Maps to DB column name: artist_id
    artist_user_id: {
      type: DataTypes.INTEGER, // Match DB 'int'
      allowNull: true, // Match DB 'Null YES'
      field: 'artist_id', // <<< MAP to actual DB column name
      references: { model: 'users', key: 'user_id' } // FK reference
    },
    // Model attribute name (JS): employer_user_id
    // Maps to DB column name: employer_id
    employer_user_id: {
      type: DataTypes.INTEGER.UNSIGNED, // Match DB
      allowNull: false, // Match DB 'Null NO'
      field: 'employer_id', // <<< MAP to actual DB column name
      references: { model: 'users', key: 'user_id' } // FK reference
    },
    message_count: {
      type: DataTypes.INTEGER, // Match DB 'int'
      allowNull: false,
      defaultValue: 0,
      field: 'message_count' // Explicit mapping
    },
    artist_rating_status: {
      type: DataTypes.ENUM('pending', 'prompted_10', 'prompted_20', 'declined', 'completed'),
      allowNull: false,
      defaultValue: 'pending',
      field: 'artist_rating_status' // Explicit mapping
    },
    employer_rating_status: {
      type: DataTypes.ENUM('pending', 'prompted_10', 'prompted_20', 'declined', 'completed'),
      allowNull: false,
      defaultValue: 'pending',
      field: 'employer_rating_status' // Explicit mapping
    },
     // REMOVED manual created_at - Let Sequelize handle timestamps
  },
  {
    sequelize,
    tableName: 'chats',
    timestamps: true, // <<< ENABLE Sequelize timestamps
    underscored: true, // <<< ADD This to match DB 'created_at' and handle 'updated_at'
    // This tells Sequelize to expect created_at and updated_at columns
    // and to map camelCase attributes (like artistUserId) to snake_case columns (like artist_user_id)
    // UNLESS overridden by the 'field' option.
  }
);

export default Chat;