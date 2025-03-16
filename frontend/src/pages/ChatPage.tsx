import React from "react";
import ChatList from "../components/ChatList";
import '../styles/ChatList.css'



const ChatPage = () => {
  return (
    <div className="chat-page">
      <h1>Your Chats</h1>
      <ChatList />
    </div>
  );
};

export default ChatPage;
