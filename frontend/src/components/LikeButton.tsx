import React, { useState } from "react";
import axios from "axios";

interface LikeButtonProps {
  userId: number;
  likedUserId: number;
}

const LikeButton: React.FC<LikeButtonProps> = ({ userId, likedUserId }) => {
  const [isLiked, setIsLiked] = useState(false);

  // ✅ Use Vite environment variable, fallback to localhost for dev
  const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:50001";

  const handleLike = async () => {
    try {
      // Send like request
      await axios.post(`${BACKEND_URL}/api/users/${userId}/like`, { likedUserId });

      // Check for mutual like
      const response = await axios.get(`${BACKEND_URL}/api/users/${userId}/like`);
      const { isMutualLike } = response.data;

      if (isMutualLike) {
        alert("It’s a match! A chat has been created!");
        createChat();
      } else {
        alert("You liked this user!");
      }

      setIsLiked(true);
    } catch (error) {
      console.error("Error liking user:", error);
      alert("An error occurred. Please try again.");
    }
  };

  const createChat = async () => {
    try {
      await axios.post(`${BACKEND_URL}/api/chats`, {
        artist_id: userId,
        employer_id: likedUserId,
      });
    } catch (error) {
      console.error("Error creating chat:", error);
    }
  };

  return (
    <button onClick={handleLike} disabled={isLiked}>
      {isLiked ? "Liked" : "Like"}
    </button>
  );
};

export default LikeButton;
