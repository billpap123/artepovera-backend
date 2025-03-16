import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../styles/Global.css';

const ProfileRedirect = () => {
  const navigate = useNavigate();
  const { userType } = useParams(); // Get the userType from the URL
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userType) return; // If userType is missing, do nothing

    const normalizedUserType = userType.toLowerCase(); // Normalize to lowercase

    if (normalizedUserType === 'artist') {
      navigate("/artist-profile"); // Redirect to artist profile
    } else if (normalizedUserType === 'employer') {
      navigate("/employer-profile"); // Redirect to employer profile
    } else {
      navigate("/"); // Redirect to home if invalid userType
    }

    setLoading(false); // Prevent infinite redirects
  }, [navigate, userType]);

  return loading ? <div>Redirecting...</div> : null;
};

export default ProfileRedirect;
