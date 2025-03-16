import React, { useState, useEffect } from "react";
import axios from "axios";
import { useUserContext } from "../context/UserContext";
import "../styles/Global.css";
import "../styles/EmployerProfile.css";

const EmployerProfile = () => {
  const { userId, setUserId, employerId, setEmployerId } = useUserContext();
  const [bio, setBio] = useState("");
  const [profilePicture, setProfilePicture] = useState<File | null>(null);

  // ✅ Use your Vite environment variable, fallback to localhost if not set
  const BACKEND_URL = import.meta.env.VITE_API_URL || "http://localhost:50001";

  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/users/me`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });
        const { user_id, employer_id } = response.data;

        if (!userId) setUserId(user_id);
        if (!employerId) setEmployerId(employer_id);
      } catch (error) {
        console.error("Error fetching user ID:", error);
        alert("Could not retrieve user information. Please log in again.");
      }
    };

    if (!userId || !employerId) {
      fetchUserId();
    }
  }, [userId, employerId, setUserId, setEmployerId, BACKEND_URL]);

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files ? e.target.files[0] : null;
    if (file && (file.type === "image/png" || file.type === "image/jpeg")) {
      setProfilePicture(file);
    } else {
      alert("Please upload a valid image file (PNG or JPG).");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profilePicture) {
      alert("Please upload a profile picture.");
      return;
    }

    const idToUse = employerId || userId;
    if (!idToUse) {
      alert("User ID is missing. Please log in again.");
      return;
    }

    const formData = new FormData();
    formData.append("bio", bio);
    formData.append("profile_picture", profilePicture);

    try {
      await axios.post(
        `${BACKEND_URL}/api/employers/profile/${idToUse}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      alert("Profile updated successfully!");
    } catch (err) {
      console.error("Error updating employer profile:", err);
    }
  };

  return (
    <div className="employer-profile">
      <h2>Create your employer profile</h2>
      <form onSubmit={handleSubmit} className="profile-form">
        <div className="form-group">
          <label>Bio:</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Profile Picture (PNG or JPG):</label>
          <input
            type="file"
            accept="image/png, image/jpeg"
            onChange={handleProfilePictureChange}
            required
          />
        </div>
        <button type="submit">Save Profile</button>
      </form>
    </div>
  );
};

export default EmployerProfile;
