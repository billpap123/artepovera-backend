// src/components/NotificationItem.tsx
import React from "react";

interface NotificationItemProps {
  notif: {
    message: string;
    [key: string]: any; // other notification fields if needed
  };
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notif }) => {
  return (
    <div
      className="notification-item"
      style={{ marginBottom: "10px" }}
      dangerouslySetInnerHTML={{ __html: notif.message }}
    />
  );
};

export default NotificationItem;
