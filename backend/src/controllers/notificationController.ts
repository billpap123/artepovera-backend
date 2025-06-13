import { Request, Response, NextFunction } from 'express';
import Notification from '../models/Notification';
import User from '../models/User'; // Import User model

export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params;

  try {
    const notifications = await Notification.findAll({
      where: { user_id: userId },
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['fullname'],
        },
      ],
      // FIX 1: Use the camelCase property name 'createdAt' for ordering
      order: [['createdAt', 'DESC']],
    });

    // This now correctly includes the message_key and message_params for i18n
    const formattedNotifications = notifications.map((notif) => ({
      notification_id: notif.notification_id,
      message: notif.message,
      message_key: notif.message_key,
      message_params: notif.message_params,
      read_status: notif.read_status,
      // FIX 2: Use the camelCase property 'createdAt' from the model
      createdAt: notif.createdAt, 
      sender_name: notif.sender?.fullname || 'Unknown User',
    }));

    res.status(200).json({ notifications: formattedNotifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Mark a notification as read.
 */
export const markNotificationAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findByPk(notificationId);
    if (!notification) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

    notification.read_status = true;
    await notification.save();

    res.status(200).json({ message: 'Notification marked as read', notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    next(error);
  }
};

/**
 * Mark all notifications for a user as read.
 */
export const markAllNotificationsAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;

    await Notification.update(
      { read_status: true },
      { where: { user_id: userId, read_status: false } }
    );

    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    next(error);
  }
};

/**
 * Delete a notification.
 */
export const deleteNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { notificationId } = req.params;

    const notification = await Notification.findByPk(notificationId);
    if (!notification) {
      res.status(404).json({ message: 'Notification not found' });
      return;
    }

    await notification.destroy();

    res.status(200).json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    next(error);
  }
};

/**
 * Delete all notifications for a specific user.
 */
export const deleteAllNotifications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId } = req.params;

    await Notification.destroy({ where: { user_id: userId } });

    res.status(200).json({ message: 'All notifications deleted successfully' });
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    next(error);
  }
};
