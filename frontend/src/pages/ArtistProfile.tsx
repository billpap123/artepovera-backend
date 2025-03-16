import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useUserContext } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar'; // Import Navbar component
import '../styles/Global.css';
import '../styles/ArtistProfile.css';

const UserProfile = () => {
  const { userId, artistId, employerId, setArtistId, setEmployerId } = useUserContext();
  const [profile, setProfile] = useState({
    fullname: '',
    bio: '',
    profile_picture: '',
    user_type: '',
  });
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newBio, setNewBio] = useState('');
  const [newProfilePicture, setNewProfilePicture] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  // ✅ Use your Vite environment variable, fallback to localhost if not set
  const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:50001';

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/api/users/me`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });

        console.log('API Response:', response.data); // ✅ Log the full response

        const { fullname, user_type, artist, employer } = response.data;

        let bio = '';
        let profile_picture = '';

        if (user_type === 'Artist' && artist) {
          setArtistId(artist.artist_id);
          bio = artist.bio;
          profile_picture = artist.profile_picture;
        } else if (user_type === 'Employer' && employer) {
          setEmployerId(employer.employer_id);
          bio = employer.bio;
          profile_picture = employer.profile_picture;
        }

        setProfile({ fullname, bio, profile_picture, user_type });
        setNewBio(bio);
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [setArtistId, setEmployerId, BACKEND_URL]);

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
  };

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
      setNewProfilePicture(file);
    } else {
      alert('Please upload a valid image file (PNG or JPG).');
    }
  };

  const handleSaveChanges = async () => {
    const formData = new FormData();
    formData.append('bio', newBio);
    if (newProfilePicture) formData.append('profile_picture', newProfilePicture);

    try {
      setSaving(true);

      if (profile.user_type === 'Artist') {
        await axios.post(
          `${BACKEND_URL}/api/artists/profile/${artistId}`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );
      } else if (profile.user_type === 'Employer') {
        await axios.post(
          `${BACKEND_URL}/api/employers/profile/${employerId}`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );
      }

      alert('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving changes:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="loading-message">Loading profile...</p>;

  return (
    <>
      <Navbar /> {/* Navbar at the top */}
      <div className="main-content">
        <div className="profile-container">
          <h2 className="profile-header">{profile.user_type} profile</h2>

          <img
            src={profile.profile_picture || '/default-profile.png'}
            alt="Profile"
            className="profile-image"
          />

          <h3 className="profile-name">{profile.fullname}</h3>

          {!isEditing ? (
            <>
              <p className="profile-bio">{profile.bio}</p>
              <button className="edit-button" onClick={handleEditToggle}>
                Edit profile
              </button>
            </>
          ) : (
            <>
              <textarea
                value={newBio}
                onChange={(e) => setNewBio(e.target.value)}
                className="bio-input"
              />
              <input
                type="file"
                onChange={handleProfilePictureChange}
                className="file-input"
              />
              <div className="button-group">
                <button className="save-button" onClick={handleSaveChanges} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="cancel-button" onClick={handleEditToggle}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default UserProfile;
