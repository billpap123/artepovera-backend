import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/Global.css';

// ✅ Use environment variable for API URL
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:50001";

// Define the structure of a job posting
interface JobPosting {
  id: number;
  title: string;
  description: string;
  employerName?: string; // Optional employer name if returned
  created_at?: string;   // If your backend returns a date
}

interface JobPostingsProps {
  employerId?: number; // The employer ID to fetch job postings
}

const JobPostings: React.FC<JobPostingsProps> = ({ employerId }) => {
  const [jobPostings, setJobPostings] = useState<JobPosting[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Check if current user is an Artist
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isArtist = storedUser?.user_type === 'Artist';

  useEffect(() => {
    const fetchJobPostings = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.warn("No token found; user might not be logged in.");
          return;
        }

        let url = `${API_URL}/api/job-postings`; // ✅ Fixed API URL with .env variable
        if (employerId) {
          url += `?employer_id=${employerId}`;
        }

        const response = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setJobPostings(response.data);
      } catch (err) {
        console.error('Error fetching job postings:', err);
        setError('Failed to load job postings. Please try again.');
      }
    };

    fetchJobPostings();
  }, [employerId]);

  // Apply logic if user is an Artist
  const handleApply = async (jobId: number) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert("You must be logged in as an artist to apply for jobs.");
        return;
      }

      const response = await axios.post(
        `${API_URL}/api/jobs/${jobId}/apply`, // ✅ Fixed API URL with .env variable
        {}, // empty body
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert(response.data.message);
    } catch (error) {
      console.error(`Error applying to job ${jobId}:`, error);
      alert("Failed to apply. Check console for details.");
    }
  };

  return (
    <div className="job-postings" style={{ padding: '20px' }}>
      <h4>Job Postings</h4>

      {error ? (
        <p className="error-message">{error}</p>
      ) : jobPostings.length > 0 ? (
        jobPostings.map((job) => (
          <div
            key={job.id}
            className="job-posting"
            style={{
              border: '1px solid #ccc',
              borderRadius: '8px',
              padding: '10px',
              marginBottom: '10px',
            }}
          >
            <h5 style={{ margin: '0 0 5px' }}>{job.title}</h5>
            <p style={{ margin: '5px 0' }}>{job.description}</p>
            {job.employerName && (
              <p style={{ margin: '5px 0' }}>
                <strong>Posted by:</strong> {job.employerName}
              </p>
            )}

            {job.created_at && (
              <p style={{ fontSize: '0.9em', color: '#666' }}>
                Posted on: {new Date(job.created_at).toLocaleString()}
              </p>
            )}

            {/* Only show "Apply" if user is an Artist */}
            {isArtist && (
              <button
                onClick={() => handleApply(job.id)}
                style={{
                  backgroundColor: '#C96A50',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Apply
              </button>
            )}
          </div>
        ))
      ) : (
        <p>No job postings available.</p>
      )}
    </div>
  );
};

export default JobPostings;
