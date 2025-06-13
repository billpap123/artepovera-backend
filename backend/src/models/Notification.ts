import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';
import User from './User';

// Interface for Notification attributes
interface NotificationAttributes {
  notification_id: number;
  user_id: number;
  sender_id: number;
  message?: string | null; // Keep original message for older notifications
  message_key?: string | null; // NEW: For i18n keys
  message_params?: object | null; // NEW: For i18n variables
  read_status: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for Notification creation attributes
interface NotificationCreationAttributes extends Optional<NotificationAttributes, 'notification_id' | 'createdAt' | 'updatedAt'> {}

class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> implements NotificationAttributes {
  public notification_id!: number;
  public user_id!: number;
  public sender_id!: number;
  public message?: string | null;
  public message_key?: string | null;
  public message_params?: object | null;
  public read_status!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations can be defined here if needed
  public readonly sender?: User;
}

Notification.init({
  notification_id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'user_id',
    },
  },
  sender_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'user_id',
    },
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true, // Allow null for new key-based notifications
  },
  // --- ADD THESE TWO NEW FIELDS ---
  message_key: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  message_params: {
    type: DataTypes.JSONB, // Use JSONB for storing objects like { chatLink: "..." }
    allowNull: true,
  },
  // --- END ADD ---
  read_status: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  sequelize,
  tableName: 'notifications',
  timestamps: true,
});

// Define association
Notification.belongsTo(User, { as: 'sender', foreignKey: 'sender_id' });

export default Notification;
