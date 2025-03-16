import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/Messages.css";

// ✅ Read API URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:50001";

interface Message {
  id: number;
  senderName: string;
  content: string;
  timestamp: string;
}

const Messages: React.FC<{ userId: number }> = ({ userId }) => {
  const { chatId } = useParams<{ chatId: string }>(); // Get chatId from URL
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(
          `${API_BASE_URL}/api/messages/${chatId}`, // ✅ Updated URL
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setMessages(response.data.messages || []);
      } catch (err) {
        console.error("Error fetching messages:", err);
        setError("Failed to fetch messages.");
      }
    };

    if (chatId) {
      fetchMessages();
    }
  }, [chatId]);

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div className="messages-page">
      <header className="messages-header">
        <div className="logo">Logo</div>
        <ul className="nav-menu">
          <li><Link to="/main">Dashboard</Link></li>
          <li><Link to="/profile">Profile</Link></li>
          <li><button className="logout-button" onClick={handleLogout}>Logout</button></li>
        </ul>
      </header>

      <div className="messages-container">
        <h2>Chat Messages</h2>
        {messages.length > 0 ? (
          messages.map((message) => (
            <div key={message.id} className="message">
              <div className="message-header">
                <strong>{message.senderName}</strong>
                <span className="timestamp">{new Date(message.timestamp).toLocaleString()}</span>
              </div>
              <p className="message-content">{message.content}</p>
            </div>
          ))
        ) : (
          <p className="no-messages">No messages available.</p>
        )}
      </div>
    </div>
  );
};

export default Messages;
