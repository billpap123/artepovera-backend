import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/db';
import User from './User';

// Interface defining all attributes of a Notification instance
interface NotificationAttributes {
  notification_id: number;
  user_id: number;
  sender_id: number;
  like_id?: number | null; // This column was seen in your error logs
  message?: string | null; // For old notifications before the change
  message_key?: string | null; // For new i18n-based notifications
  message_params?: object | null; // For variables in i18n keys
  read_status: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface for creating a new Notification (some fields are optional)
interface NotificationCreationAttributes extends Optional<NotificationAttributes, 'notification_id' | 'createdAt' | 'updatedAt'> {}

// Sequelize Model
class Notification extends Model<NotificationAttributes, NotificationCreationAttributes> implements NotificationAttributes {
  public notification_id!: number;
  public user_id!: number;
  public sender_id!: number;
  public like_id?: number | null;
  public message?: string | null;
  public message_key?: string | null;
  public message_params?: object | null;
  public read_status!: boolean;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associated models
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
  like_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
          model: 'likes',
          key: 'like_id'
      }
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
    type: DataTypes.JSON,
    allowNull: true,
  },
  read_status: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  sequelize,
  tableName: 'notifications',
  timestamps: true, // This enables createdAt and updatedAt
  underscored: true, // This is the key fix: It maps camelCase fields in the model to snake_case columns in the DB
});

// Define model associations
Notification.belongsTo(User, { as: 'sender', foreignKey: 'sender_id' });

export default Notification;
