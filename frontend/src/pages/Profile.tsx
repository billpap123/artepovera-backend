import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import '../styles/UserProfile.css'; // Make sure this file exists

// ✅ Read API URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:50001";

interface UserProfile {
  user_id: number;
  fullname: string;
  bio: string;
  profile_picture?: string;
  // Add other fields as needed
}

const UserProfilePage: React.FC = () => {
  const { userId } = useParams(); // e.g. route: /user-profile/:userId
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) return; // No userId in params? Just return or show error

      try {
        const token = localStorage.getItem("token");
        // ✅ Updated API URL for deployment
        const response = await axios.get(
          `${API_BASE_URL}/api/users/profile/${userId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setProfile(response.data); // Store in state
      } catch (err) {
        console.error("❌ Error fetching user profile:", err);
        setError("Could not fetch user profile. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId]);

  if (loading) {
    return <div className="profile-loading">Loading profile...</div>;
  }

  if (error) {
    return <div className="profile-error">{error}</div>;
  }

  if (!profile) {
    return <div className="profile-no-data">No profile data available.</div>;
  }

  // Render the user's data in a nice card
  return (
    <div className="profile-page">
      <div className="profile-card">
        <img
          src={profile.profile_picture || "/default-profile.png"}
          alt="Profile"
          className="profile-image"
        />
        <h2 className="profile-name">{profile.fullname}</h2>
        <p className="profile-bio">{profile.bio || "No bio provided."}</p>

        {/* Example: A button to 'Unlike' if you want to show that action */}
        <button className="profile-action-btn">Unlike</button>
      </div>
    </div>
  );
};

export default UserProfilePage;
