import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import Navbar from '../components/Navbar';
import '../styles/UserProfilePage.css';

// Use API URL from environment variables for deployment
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:50001";

// Portfolio and job posting interfaces
interface PortfolioItem {
  portfolio_id: number;
  image_url?: string;
  description?: string;
}

interface JobPosting {
  job_id: number;
  title: string;
  description?: string;
}

// Artist/Employer profile interfaces
interface ArtistProfile {
  artist_id: number;
  bio?: string;
  profile_picture?: string;
}

interface EmployerProfile {
  employer_id: number;
  bio?: string;
  profile_picture?: string;
}

// The main user profile
interface UserProfile {
  user_id: number;
  fullname: string;
  user_type: string;
  artistProfile?: ArtistProfile | null;
  employerProfile?: EmployerProfile | null;
}

const UserProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [liked, setLiked] = useState<boolean>(false);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function for full image URL
  const getImageUrl = (path?: string) => {
    if (!path) return '/default-profile.png';
    if (path.startsWith('http')) return path;
    return `${API_BASE_URL}/${path.replace(/^uploads\/uploads\//, 'uploads/')}`;
  };

  // Fetch Like Status
  const fetchLikeStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await axios.get(`${API_BASE_URL}/api/users/${userId}/like`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLiked(response.data.liked);
    } catch (err) {
      console.error('Error fetching like status:', err);
    }
  };

  // Handle Liking User
  const handleLike = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert("You must be logged in to like someone.");
        return;
      }
      if (liked) return;
      await axios.post(`${API_BASE_URL}/api/users/${userId}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLiked(true);
    } catch (err) {
      console.error('Error liking user:', err);
      alert('Failed to like. Check console for details.');
    }
  };

  // Fetch User Profile
  useEffect(() => {
    if (!userId) {
      setError("Invalid user ID.");
      setLoading(false);
      return;
    }

    const fetchUserProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError("No token found; user might not be logged in.");
          setLoading(false);
          return;
        }

        const response = await axios.get(`${API_BASE_URL}/api/users/profile/${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        setUserProfile(response.data);
        fetchLikeStatus();
      } catch (err) {
        setError('Error fetching user profile.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId]);

  // Fetch Portfolio or Job Postings
  useEffect(() => {
    if (!userProfile) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    if (userProfile.user_type === 'Artist' && userProfile.artistProfile?.artist_id) {
      axios.get(`${API_BASE_URL}/api/portfolios/${userProfile.artistProfile.artist_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => setPortfolio(res.data))
        .catch(err => console.error('Error fetching portfolio:', err));

    } else if (userProfile.user_type === 'Employer' && userProfile.employerProfile?.employer_id) {
      axios.get(`${API_BASE_URL}/api/job-postings/employer?employer_id=${userProfile.employerProfile.employer_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => setJobPostings(res.data))
        .catch(err => console.error('Error fetching job postings:', err));
    }
  }, [userProfile]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;
  if (!userProfile) return <><Navbar /><p>No user profile data found.</p></>;

  const isArtistProfile = userProfile.user_type === 'Artist';
  const bio = isArtistProfile ? userProfile.artistProfile?.bio : userProfile.employerProfile?.bio;
  const profilePic = isArtistProfile ? userProfile.artistProfile?.profile_picture : userProfile.employerProfile?.profile_picture;

  return (
    <>
      <Navbar />

      <div className="user-profile-page">
        <div className="profile-decor"></div>
        <div className="profile-card">
          <img
            className="user-profile-img"
            src={getImageUrl(profilePic)}
            alt="Profile"
            onError={(e) => { e.currentTarget.src = '/default-profile.png'; }}
          />
          <h3 className="user-fullname">{userProfile.fullname}</h3>
          <p className="user-bio">{bio || 'No bio available.'}</p>

          <button onClick={handleLike} disabled={liked} className={`like-button ${liked ? 'liked' : ''}`}>
            {liked ? 'Liked' : 'Like'}
          </button>

          {isArtistProfile ? (
            <div className="portfolio-section">
              <h4>Portfolio</h4>
              {portfolio.length === 0 ? (
                <p>No portfolio items.</p>
              ) : (
                <div className="portfolio-items">
                  {portfolio.map((item) => (
                    <div key={item.portfolio_id} className="portfolio-item">
                      {item.image_url && (
                        <img
                          className="portfolio-image"
                          src={getImageUrl(item.image_url)}
                          alt="Portfolio"
                          onError={(e) => { e.currentTarget.src = '/default-portfolio.png'; }}
                        />
                      )}
                      <p>{item.description || 'No description'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="job-postings-section">
              <h4>Job feed</h4>
              {jobPostings.length === 0 ? (
                <p>No job postings.</p>
              ) : (
                <div className="job-postings-list">
                  {jobPostings.map((job) => (
                    <div key={job.job_id} className="job-posting-item">
                      <h5>{job.title}</h5>
                      <p>{job.description || 'No description'}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default UserProfilePage;
