import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useUserContext } from '../context/UserContext';
import "../styles/Register.css";
import '../styles/Global.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:50001";

const Register = () => {
  const { setUserId, setArtistId, setEmployerId } = useUserContext();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullname, setFullname] = useState('');
  const [phone_number, setPhoneNumber] = useState('');
  const [user_type, setUserType] = useState('Artist'); // Default user type
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Register the user
      const response = await axios.post(`${API_BASE_URL}/api/users/register`, {
        username,
        email,
        password,
        fullname,
        phone_number,
        user_type,
      });

      const { user_id, artist_id, employer_id, token } = response.data;

      // Store the token for authentication
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(response.data));

      // Set userId in context
      setUserId(user_id);

      // Navigate based on user type
      if (user_type === 'Artist' && artist_id) {
        setArtistId(artist_id);
        navigate('/artist-profile'); 
      } else if (user_type === 'Employer' && employer_id) {
        setEmployerId(employer_id);
        navigate('/employer-profile'); 
      } else {
        navigate('/main'); // Fallback
      }
    } catch (err) {
      setError('Error registering user');
      if (axios.isAxiosError(err) && err.response) {
        console.error('Registration error details:', err.response.data);
      } else {
        console.error(err);
      }
    }
  };

  return (
    <div className="register-container">
      <form onSubmit={handleSubmit} className="register-form">
        <h2>Register</h2>
        <div>
          <label>Username:</label>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div>
          <label>Email:</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label>Password:</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div>
          <label>Full Name:</label>
          <input type="text" value={fullname} onChange={(e) => setFullname(e.target.value)} required />
        </div>
        <div>
          <label>Phone Number:</label>
          <input type="tel" value={phone_number} onChange={(e) => setPhoneNumber(e.target.value)} required />
        </div>
        <div>
          <label>User Type:</label>
          <select value={user_type} onChange={(e) => setUserType(e.target.value)}>
            <option value="Artist">Artist</option>
            <option value="Employer">Employer</option>
          </select>
        </div>
        <button type="submit">Register</button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        
        <p style={{ marginTop: '20px' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#007BFF', textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Register;
