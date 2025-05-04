// src/models/Chat.ts
import { Model, DataTypes, Optional, Sequelize } from 'sequelize'; // Added Sequelize import
import sequelize from '../config/db';
// Import User model if defining associations here
// import User from './User';

// Define attributes for Chat model including new fields
interface ChatAttributes {
  chat_id: number;
  artist_user_id: number;
  employer_user_id: number;
  // --- ADDED FIELDS ---
  message_count: number;
  artist_rating_status: 'pending' | 'prompted_10' | 'prompted_20' | 'declined' | 'completed';
  employer_rating_status: 'pending' | 'prompted_10' | 'prompted_20' | 'declined' | 'completed';
  // --- END ADDED FIELDS ---
  created_at: Date; // Keep your manual created_at
}

// Define creation attributes (make new fields optional due to DB defaults)
interface ChatCreationAttributes extends Optional<ChatAttributes, 'chat_id' | 'message_count' | 'artist_rating_status' | 'employer_rating_status' | 'created_at'> {}

class Chat extends Model<ChatAttributes, ChatCreationAttributes> implements ChatAttributes {
  public chat_id!: number;
  public artist_user_id!: number;
  public employer_user_id!: number;
  // --- ADDED PUBLIC PROPERTIES ---
  public message_count!: number;
  public artist_rating_status!: 'pending' | 'prompted_10' | 'prompted_20' | 'declined' | 'completed';
  public employer_rating_status!: 'pending' | 'prompted_10' | 'prompted_20' | 'declined' | 'completed';
  // --- END ADDED ---
  public created_at!: Date; // Keep manual created_at

  // Define associations here or in associations file
  // public readonly artistUser?: User;
  // public readonly employerUser?: User;
}

Chat.init(
  {
    chat_id: {
      type: DataTypes.INTEGER.UNSIGNED, // Use UNSIGNED if IDs are always positive
      autoIncrement: true,
      primaryKey: true,
    },
    artist_user_id: {
      type: DataTypes.INTEGER.UNSIGNED, // Use UNSIGNED
      allowNull: false,
      // Optional: Add references if not handled in associations.ts
      // references: { model: 'users', key: 'user_id' }
    },
    employer_user_id: {
      type: DataTypes.INTEGER.UNSIGNED, // Use UNSIGNED
      allowNull: false,
      // Optional: Add references if not handled in associations.ts
      // references: { model: 'users', key: 'user_id' }
    },
    // --- ADDED COLUMN DEFINITIONS ---
    message_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    artist_rating_status: {
      type: DataTypes.ENUM('pending', 'prompted_10', 'prompted_20', 'declined', 'completed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    employer_rating_status: {
      type: DataTypes.ENUM('pending', 'prompted_10', 'prompted_20', 'declined', 'completed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    // --- END ADDED ---
    created_at: { // Keep your manual created_at definition
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW, // Or Sequelize.fn('NOW')
      allowNull: false, // Make sure it's not null if you rely on it
    },
  },
  {
    sequelize,
    tableName: 'chats',
    timestamps: false, // Keep as false since you manually define created_at
    // underscored: true, // Add if your DB columns are snake_case like artist_user_id
  }
);

// Define associations (Example - uncomment/move to associations.ts if needed)
// Chat.belongsTo(User, { foreignKey: 'artist_user_id', as: 'artistUser' });
// Chat.belongsTo(User, { foreignKey: 'employer_user_id', as: 'employerUser' });

export default Chat;