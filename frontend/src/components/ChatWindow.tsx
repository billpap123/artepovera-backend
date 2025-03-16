import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "../styles/ChatWindow.css";

interface Message {
  message_id: number;
  chat_id: number;
  sender_id: number;
  receiver_id: number;
  message: string;
  created_at: string;
}

interface ChatWindowProps {
  chatId: number;
  userId: number;
  receiverId: number;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ chatId, userId, receiverId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // ✅ Use your Vite environment variable, fallback to localhost
  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:50001";

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await axios.get(`${API_BASE_URL}/api/chats/${chatId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMessages(response.data.messages || []);
      } catch (err) {
        console.error("❌ Error fetching messages:", err);
        setError("Failed to load messages.");
      }
    };

    fetchMessages();
    // Poll messages every 3 seconds
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [chatId, API_BASE_URL]);

  useEffect(() => {
    // Auto-scroll to the bottom when messages update
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const token = localStorage.getItem("token");

      const response = await axios.post(
        `${API_BASE_URL}/api/chats/send`,
        {
          chat_id: chatId,
          sender_id: userId,
          receiver_id: receiverId,
          message: newMessage,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setMessages((prev) => [...prev, response.data.data]);
      setNewMessage("");
    } catch (err) {
      console.error("❌ Error sending message:", err);
      setError("Failed to send message.");
    }
  };

  return (
    <div className="chat-window">
      <div className="messages-container">
        {messages.length > 0 ? (
          messages.map((msg) => (
            <div
              key={msg.message_id}
              className={msg.sender_id === userId ? "sent-message" : "received-message"}
            >
              <p>{msg.message}</p>
              <span>{new Date(msg.created_at).toLocaleString()}</span>
            </div>
          ))
        ) : (
          <p>No messages yet.</p>
        )}
        <div ref={messagesEndRef} />
      </div>
      {error && <div className="error">{error}</div>}
      <div className="message-input">
        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
};

export default ChatWindow;
