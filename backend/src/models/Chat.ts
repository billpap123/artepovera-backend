// src/models/Chat.ts
import { Model, DataTypes, Optional, Sequelize } from 'sequelize';
import sequelize from '../config/db';
// Import Artist and Employer if defining associations here, but it's better in associations.ts
import Artist from './Artist';
 import Employer from './Employer';

interface ChatAttributes {
  chat_id: number;
  artist_user_id: number; // This will store Artist.artist_id
  employer_user_id: number; // This will store Employer.employer_id
  message_count: number;
  artist_rating_status: 'pending' | 'prompted_10' | 'prompted_20' | 'declined' | 'completed';
  employer_rating_status: 'pending' | 'prompted_10' | 'prompted_20' | 'declined' | 'completed';
  created_at?: Date;
  updated_at?: Date;
}

interface ChatCreationAttributes extends Optional<ChatAttributes, 'chat_id' | 'message_count' | 'artist_rating_status' | 'employer_rating_status' | 'created_at' | 'updated_at'> {}

class Chat extends Model<ChatAttributes, ChatCreationAttributes> implements ChatAttributes {
  public chat_id!: number;
  public artist_user_id!: number; // Corresponds to Artist.artist_id
  public employer_user_id!: number; // Corresponds to Employer.employer_id
  public message_count!: number;
  public artist_rating_status!: 'pending' | 'prompted_10' | 'prompted_20' | 'declined' | 'completed';
  public employer_rating_status!: 'pending' | 'prompted_10' | 'prompted_20' | 'declined' | 'completed';

  public readonly created_at!: Date;
  public readonly updatedAt!: Date;

  // For type safety with includes based on associations.ts
  public readonly chatArtistProfile?: Artist;
  public readonly chatEmployerProfile?: Employer;
  // public readonly messages?: Message[]; // Example if you define Message association here
}

Chat.init(
  {
    chat_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      field: 'chat_id'
    },
    artist_user_id: { // Model attribute name
      type: DataTypes.INTEGER.UNSIGNED, // Match Artist.artist_id type
      allowNull: false, // A chat must have an artist participant
      field: 'artist_id', // Actual DB column name
      references: {
        model: 'artists', // <<< CORRECT: Name of the artists TABLE
        key: 'artist_id',   // <<< CORRECT: Primary key in artists TABLE
      }
    },
    employer_user_id: { // Model attribute name
      type: DataTypes.INTEGER.UNSIGNED, // Match Employer.employer_id type
      allowNull: false, // A chat must have an employer participant
      field: 'employer_id', // Actual DB column name
      references: {
        model: 'employers', // <<< CORRECT: Name of the employers TABLE
        key: 'employer_id',   // <<< CORRECT: Primary key in employers TABLE
      }
    },
    message_count: {
      type: DataTypes.INTEGER.UNSIGNED, // Changed to UNSIGNED
      allowNull: false,
      defaultValue: 0,
      field: 'message_count'
    },
    artist_rating_status: {
      type: DataTypes.ENUM('pending', 'prompted_10', 'prompted_20', 'declined', 'completed'),
      allowNull: false,
      defaultValue: 'pending',
      field: 'artist_rating_status'
    },
    employer_rating_status: {
      type: DataTypes.ENUM('pending', 'prompted_10', 'prompted_20', 'declined', 'completed'),
      allowNull: false,
      defaultValue: 'pending',
      field: 'employer_rating_status'
    },
  },
  {
    sequelize,
    tableName: 'chats',
    timestamps: true,
    underscored: true,
  }
);

export default Chat;