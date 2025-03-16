import React, { useEffect, useState } from "react";
import axios from "axios";
import Navbar from "../components/Navbar"; // ✅ Import your Navbar component
import ChatWindow from "./ChatWindow";
import "../styles/ChatList.css"; // Include your ChatList styling

interface Chat {
  chat_id: number;
  artist_id: number;
  employer_id: number;
  created_at: string;
}

interface User {
  user_id: number;
  fullname: string;
}

const ChatList = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [users, setUsers] = useState<{ [key: number]: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // ✅ Use your Vite environment variable
  const BACKEND_URL = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const token = localStorage.getItem("token");
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        setUser(storedUser);

        // Replaced hardcoded localhost with BACKEND_URL
        const response = await axios.get(
          `${BACKEND_URL}/api/chats/user/${storedUser.user_id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const fetchedChats = response.data.chats || [];
        setChats(fetchedChats);

        // Fetch recipient details (full names)
        const userIds = new Set<number>();
        fetchedChats.forEach((chat: Chat) => {
          const recipientId =
            storedUser.user_id === chat.artist_id
              ? chat.employer_id
              : chat.artist_id;
          userIds.add(recipientId);
        });

        if (userIds.size > 0) {
          // Also replaced localhost with BACKEND_URL
          const userResponse = await axios.post(
            `${BACKEND_URL}/api/users/get-names`,
            { user_ids: Array.from(userIds) },
            { headers: { Authorization: `Bearer ${token}` } }
          );

          const userMap: { [key: number]: string } = {};
          userResponse.data.users.forEach((u: User) => {
            userMap[u.user_id] = u.fullname;
          });
          setUsers(userMap);
        }
      } catch (error) {
        console.error("Error fetching chats:", error);
        setError("Failed to fetch chats. Please try again.");
      }
    };

    fetchChats();
  }, [BACKEND_URL]);

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <>
      {/* ✅ Navbar at the top */}
      <Navbar />

      {/* The rest of the chat list logic */}
      {activeChatId === null ? (
        <div className="chat-list-container">
          {chats.length > 0 ? (
            <>
              <ul className="chat-list">
                {chats.map((chat) => {
                  const recipientId =
                    user?.user_id === chat.artist_id
                      ? chat.employer_id
                      : chat.artist_id;
                  const recipientName = users[recipientId] || "Unknown User";

                  return (
                    <li
                      key={chat.chat_id}
                      onClick={() => setActiveChatId(chat.chat_id)}
                    >
                      <span>Chat with {recipientName}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p>No chats yet.</p>
          )}
        </div>
      ) : (
        <div className="chat-window-container">
          <button className="back-button" onClick={() => setActiveChatId(null)}>
            Back to Chats
          </button>
          <ChatWindow
            chatId={activeChatId}
            userId={user?.user_id || 0}
            receiverId={
              chats.find((chat) => chat.chat_id === activeChatId)
                ? user?.user_id ===
                  chats.find((chat) => chat.chat_id === activeChatId)?.artist_id
                  ? chats.find((chat) => chat.chat_id === activeChatId)
                      ?.employer_id ?? 0
                  : chats.find((chat) => chat.chat_id === activeChatId)
                      ?.artist_id ?? 0
                : 0
            }
          />
        </div>
      )}
    </>
  );
};

export default ChatList;
