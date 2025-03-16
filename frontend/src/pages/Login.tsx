import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import '../styles/Global.css';
import '../styles/Login.css';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Use environment variable for API URL (for public deployment)
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:50001';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await axios.post(`${API_BASE_URL}/api/users/login`, {
                email,
                password,
            });

            // Store the token and user data in localStorage
            localStorage.setItem('token', response.data.token);
            if (response.data.user) {
                localStorage.setItem('user', JSON.stringify(response.data.user));
            } else {
                throw new Error("User data not found in response");
            }

            navigate('/main'); // Redirect to the main page
        } catch (err) {
            setError('Invalid email or password');
            console.error(err);
        }
    };

    return (
        <div className="login-container">
            <h2 className="login-title">Login</h2>
            <form onSubmit={handleSubmit} className="login-form">
                <div className="form-group">
                    <label>Email:</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="login-input"
                    />
                </div>
                <div className="form-group">
                    <label>Password:</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="login-input"
                    />
                </div>
                <button type="submit" className="login-button">Login</button>
                {error && <p className="login-error">{error}</p>}
            </form>

            {/* Register link */}
            <p className="register-link">
                Don't have an account?{' '}
                <Link to="/register" className="register-link-text">
                    Register now
                </Link>
            </p>
        </div>
    );
};

export default Login;
