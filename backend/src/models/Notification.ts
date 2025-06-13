import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';
import User from './User';

// Interface for Notification attributes
interface NotificationAttributes {
  notification_id: number;
  user_id: number;
  sender_id: number;
  message?: string | null;
  message_key?: string | null;
  message_params?: object | null;
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
    allowNull: true,
  },
  message_key: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  message_params: {
    type: DataTypes.JSON, // Changed to JSON from JSONB for broader compatibility
    allowNull: true,
  },
  read_status: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  // --- ADD THESE TWO PROPERTIES TO FIX THE NAMING MISMATCH ---
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at' // Maps the 'createdAt' property to the 'created_at' column
  },
  updatedAt: {
    type: DataTypes.DATE,
    field: 'updated_at' // Maps the 'updatedAt' property to the 'updated_at' column
  }
  // --- END FIX ---
}, {
  sequelize,
  tableName: 'notifications',
  timestamps: true, // Keep this as true
});

// Define association
Notification.belongsTo(User, { as: 'sender', foreignKey: 'sender_id' });

export default Notification;

