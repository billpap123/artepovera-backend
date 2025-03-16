import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "../styles/UserProfile.css";
import '../styles/Global.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:50001";

interface PortfolioItem {
  portfolio_id: number;
  image_url: string;
  description: string;
}

interface UserProfileData {
  fullname: string;
  bio: string;
  profile_picture: string;
  user_type: "Artist" | "Employer";
  portfolio?: PortfolioItem[]; 
}

const UserProfile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const [userData, setUserData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("No authentication token found. Please log in.");
        }

        const response = await axios.get(`${API_BASE_URL}/api/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setUserData(response.data);
      } catch (err) {
        console.error("❌ Error fetching user profile:", err);
        setError("Failed to fetch user profile. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId]);

  if (loading) return <p>Loading profile...</p>;
  if (error) return <p className="error-message">{error}</p>;

  return (
    <div className="user-profile">
      <div className="profile-header">
        <img
          src={userData?.profile_picture || "/default-profile.png"}
          alt={`${userData?.fullname}'s Profile`}
          className="profile-picture"
        />
        <h2>{userData?.fullname}</h2>
        <p className="user-type">{userData?.user_type}</p>
      </div>

      <div className="profile-bio">
        <h3>Bio</h3>
        <p>{userData?.bio || "No bio provided."}</p>
      </div>

      {userData?.user_type === "Artist" && userData.portfolio && (
        <div className="profile-portfolio">
          <h3>Portfolio</h3>
          {userData.portfolio.length > 0 ? (
            <div className="portfolio-grid">
              {userData.portfolio.map((item) => (
                <div key={item.portfolio_id} className="portfolio-item">
                  <img
                    src={item.image_url}
                    alt={item.description || "Portfolio Item"}
                    className="portfolio-image"
                  />
                  <p>{item.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <p>No portfolio items available.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default UserProfile;
