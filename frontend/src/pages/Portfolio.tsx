import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import "../styles/Portfolio.css";
import Navbar from "../components/Navbar";
import '../styles/Global.css';

interface PortfolioItem {
    portfolio_id: number;
    image_url: string;
    description: string;
}

interface PortfolioProps {
    artistId: number;
}

const Portfolio: React.FC<PortfolioProps> = ({ artistId }) => {
    const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [description, setDescription] = useState<string>('');
    const [editMode, setEditMode] = useState<{ id: number | null; description: string }>({ id: null, description: '' });

    const navigate = useNavigate();

    // ✅ Use environment variable for API base URL
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:50001';

    useEffect(() => {
        fetchPortfolio();
    }, [artistId]);

    const fetchPortfolio = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/api/portfolios/${artistId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            setPortfolioItems(response.data);
        } catch (error) {
            setError('Error fetching portfolio. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) {
            alert('Please select an image.');
            return;
        }

        const formData = new FormData();
        formData.append('image', selectedFile);
        formData.append('description', description);
        formData.append('artist_id', artistId.toString());

        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE_URL}/api/portfolios`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
            });
            setDescription('');
            setSelectedFile(null);
            fetchPortfolio(); // Refresh portfolio after upload
        } catch (error) {
            alert('Error uploading image.');
            console.error(error);
        }
    };

    const handleEdit = async (id: number) => {
        if (!editMode.description) return;

        try {
            const token = localStorage.getItem('token');
            await axios.put(`${API_BASE_URL}/api/portfolios/${id}`, { description: editMode.description }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setEditMode({ id: null, description: '' });
            fetchPortfolio(); // Refresh portfolio after edit
        } catch (error) {
            alert('Error updating portfolio item.');
            console.error(error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Are you sure you want to delete this portfolio item?')) return;

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`${API_BASE_URL}/api/portfolios/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            fetchPortfolio(); // Refresh portfolio after delete
        } catch (error) {
            alert('Error deleting portfolio item.');
            console.error(error);
        }
    };

    if (loading) return <p className="loading-message">Loading portfolio...</p>;
    if (error) return <p className="error-message">{error}</p>;

    return (
        <>
            <Navbar />
            <div className="portfolio-page">
                <div className="portfolio-container">
                    <h2>My portfolio</h2>

                    {/* Upload Form */}
                    <form onSubmit={handleUpload} className="portfolio-upload-form">
                        <input type="file" accept="image/png, image/jpeg" onChange={handleFileChange} required />
                        <input
                            type="text"
                            placeholder="Enter description..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                        />
                        <button type="submit">Upload</button>
                    </form>

                    {/* Portfolio Display */}
                    <div className="portfolio-grid">
                        {portfolioItems.length > 0 ? (
                            portfolioItems.map((item) => (
                                <div key={item.portfolio_id} className="portfolio-item">
                                    <img src={item.image_url} alt="Portfolio Item" className="portfolio-image" />
                                    {editMode.id === item.portfolio_id ? (
                                        <input
                                            type="text"
                                            value={editMode.description}
                                            onChange={(e) => setEditMode({ ...editMode, description: e.target.value })}
                                        />
                                    ) : (
                                        <p>{item.description}</p>
                                    )}
                                    <div className="portfolio-actions">
                                        {editMode.id === item.portfolio_id ? (
                                            <button onClick={() => handleEdit(item.portfolio_id)}>Save</button>
                                        ) : (
                                            <button onClick={() => setEditMode({ id: item.portfolio_id, description: item.description })}>
                                                Edit
                                            </button>
                                        )}
                                        <button onClick={() => handleDelete(item.portfolio_id)}>Delete</button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p>No portfolio items available.</p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default Portfolio;
