import React, { useEffect, useState } from "react";
import axios from "axios";
import "../styles/Notifications.css";

type Notification = {
  notification_id: number;
  user_id: number;
  message: string;      // HTML or text stored in your DB
  read_status: boolean;
  created_at: string;
  sender_name: string;  // Fetched from the backend (the name of the sender)
};

const NotificationList: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 1) Grab the user & token from localStorage
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const token = localStorage.getItem("token");

  // ✅ Use your Vite environment variable, fallback to localhost for dev
  const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:50001";

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // 2) Request the user’s notifications
        const response = await axios.get(
          `${BACKEND_URL}/api/notifications/${user.user_id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setNotifications(response.data.notifications || []);
      } catch (err) {
        setError("Failed to fetch notifications.");
        console.error("❌ Error fetching notifications:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.user_id && token) {
      fetchNotifications();
    } else {
      setLoading(false);
      setError("No user or token found. Please log in.");
    }
  }, [user.user_id, token, BACKEND_URL]);

  // 3) Mark notification as read
  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await axios.put(
        `${BACKEND_URL}/api/notifications/${notificationId}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      // Update state so the notification is marked as read
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.notification_id === notificationId
            ? { ...notif, read_status: true }
            : notif
        )
      );
    } catch (err) {
      setError("Failed to mark notification as read.");
      console.error("❌ Error marking as read:", err);
    }
  };

  // 4) Delete a notification
  const handleDelete = async (notificationId: number) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/notifications/${notificationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Remove it from state
      setNotifications((prev) =>
        prev.filter((notif) => notif.notification_id !== notificationId)
      );
    } catch (err) {
      setError("Failed to delete notification.");
      console.error("❌ Error deleting notification:", err);
    }
  };

  if (loading) return <div>Loading notifications...</div>;
  if (error) return <div style={{ color: "red" }}>{error}</div>;

  return (
    <div className="notification-list">
      <h2>Notifications</h2>
      {notifications.length === 0 ? (
        <p>No notifications yet.</p>
      ) : (
        <ul>
          {notifications.map((notif) => (
            <li
              key={notif.notification_id}
              className={notif.read_status ? "read" : "unread"}
              style={{ marginBottom: "15px" }}
            >
              {/* Sender Name + HTML Message */}
              <div>
                <strong>{notif.sender_name}</strong>:{" "}
                <span dangerouslySetInnerHTML={{ __html: notif.message }} />
              </div>

              {/* Created at */}
              <small
                style={{ display: "block", marginTop: "5px", color: "#555" }}
              >
                {new Date(notif.created_at).toLocaleString()}
              </small>

              {/* Action Buttons */}
              <div style={{ marginTop: "8px" }}>
                {!notif.read_status && (
                  <button
                    onClick={() => handleMarkAsRead(notif.notification_id)}
                    style={{ marginRight: "8px" }}
                  >
                    Mark as Read
                  </button>
                )}
                <button onClick={() => handleDelete(notif.notification_id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default NotificationList;
