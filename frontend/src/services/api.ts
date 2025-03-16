// src/services/api.ts
import axios from 'axios';

// Use environment variable for API URL (for deployment)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:50001/api';

// Register a new user
export const createUser = async (userData: any) => {
    return axios.post(`${API_URL}/users/register`, userData);
};

// Login user
export const loginUser = async (email: string, password: string) => {
    return axios.post(`${API_URL}/users/login`, { email, password });
};

// Add other API calls as needed
