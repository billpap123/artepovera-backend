import React, { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/Navbar.css"; // or wherever your CSS is

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const token = localStorage.getItem("token");

  // ✅ Use your Vite environment variable, fallback to localhost
  const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:50001";

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!token || !user.user_id) {
        setLoadingNotifications(false);
        return;
      }

      setLoadingNotifications(true);
      try {
        const response = await axios.get(
          `${BACKEND_URL}/api/notifications/${user.user_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setNotifications(response.data.notifications || []);
        setError("");
      } catch (err) {
        console.error("Error fetching notifications:", err);
        setError("Failed to fetch notifications.");
      } finally {
        setLoadingNotifications(false);
      }
    };

    fetchNotifications();
  }, [user.user_id, token, BACKEND_URL]);

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);

  // Show/hide notifications dropdown
  const toggleDropdown = () => setShowDropdown((prev) => !prev);

  // Mark a notification as read
  const markAsRead = async (notificationId: number) => {
    try {
      await axios.put(
        `${BACKEND_URL}/api/notifications/${notificationId}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.notification_id === notificationId ? { ...notif, read_status: true } : notif
        )
      );
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  // Delete a notification
  const deleteNotification = async (notificationId: number) => {
    try {
      await axios.delete(`${BACKEND_URL}/api/notifications/${notificationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications((prev) => prev.filter((n) => n.notification_id !== notificationId));
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      navigate("/login");
    }
  };

  return (
    <nav className="navbar">
      <div className="logo">ARTEPOVERA</div>
      <div className="hamburger" onClick={toggleMenu}>
        <span></span>
        <span></span>
        <span></span>
      </div>
      <ul className={`nav-links ${isMenuOpen ? "open" : ""}`}>
        <li>
          <NavLink to="/" className={({ isActive }) => (isActive ? "active" : "")}>
            Home
          </NavLink>
        </li>
        <li>
          <NavLink to="/artist-profile" className={({ isActive }) => (isActive ? "active" : "")}>
            Profile
          </NavLink>
        </li>
        <li className="notifications">
          <button className="notifications-button" onClick={toggleDropdown}>
            Notifications ({notifications.length})
          </button>
          {showDropdown && (
            <div className="notifications-dropdown">
              {loadingNotifications ? (
                <p>Loading...</p>
              ) : error ? (
                <p className="error">{error}</p>
              ) : notifications.length > 0 ? (
                <ul>
                  {notifications.map((notif) => (
                    <li
                      key={notif.notification_id}
                      className={notif.read_status ? "read" : "unread"}
                    >
                      <div className="notification-item">
                        {/* If your message is HTML: */}
                        <div dangerouslySetInnerHTML={{ __html: notif.message }} />
                        <div className="timestamp">
                          {new Date(notif.created_at).toLocaleString()}
                        </div>
                        <div>
                          {!notif.read_status && (
                            <button onClick={() => markAsRead(notif.notification_id)}>
                              Mark as Read
                            </button>
                          )}
                          <button onClick={() => deleteNotification(notif.notification_id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No notifications</p>
              )}
            </div>
          )}
        </li>

        <li>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default Navbar;
