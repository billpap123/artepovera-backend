import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/db';
import User from './User';

interface NotificationAttributes {
  notification_id: number;
  user_id: number;
  sender_id?: number; // Add sender_id as an optional attribute
  message: string;
  read_status: boolean;
  created_at: Date;
}

// Optional attributes for Notification creation
interface NotificationCreationAttributes extends Optional<NotificationAttributes, 'notification_id'> {}

class Notification
  extends Model<NotificationAttributes, NotificationCreationAttributes>
  implements NotificationAttributes {
  public notification_id!: number;
  public user_id!: number;
  public sender_id?: number; // Add sender_id here as well
  public message!: string;
  public read_status!: boolean;
  public created_at!: Date;

  // Virtual properties
  public sender?: User; // For the sender of the notification
  public recipient?: User; // For the recipient of the notification
}

Notification.init(
  {
    notification_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: User, key: 'user_id' },
    },
    sender_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: User, key: 'user_id' },
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    read_status: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Notification',
    tableName: 'notifications',
    timestamps: false,
  }
);

// Define associations
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'recipient' }); // Recipient of the notification
User.hasMany(Notification, { foreignKey: 'user_id', as: 'receivedNotifications' });

Notification.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' }); // Sender of the notification
User.hasMany(Notification, { foreignKey: 'sender_id', as: 'sentNotifications' });

export default Notification;
