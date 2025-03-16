import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// ✅ Read API URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:50001";

const PostJobPage: React.FC = () => {
  // 1. Fetch user from localStorage
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  // 2. Extract the real employer_id (not 0)
  const [employerId, setEmployerId] = useState<number | null>(null);

  // 3. Local form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState<number | "">(0);
  const [lng, setLng] = useState<number | "">(0);

  const navigate = useNavigate();

  // 4. On component mount, check if user has employer_id
  useEffect(() => {
    if (storedUser && storedUser.user_type === "Employer" && storedUser.employer_id) {
      setEmployerId(storedUser.employer_id);
    } else {
      // Optionally fetch employer data from the server, or show error
      // For now, we just show an alert if missing
      alert("No valid employer_id found. Please ensure you're logged in as an Employer.");
    }
  }, [storedUser]);

  // 5. Submit the form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      if (!employerId) {
        alert("No valid employer ID found. Cannot create job.");
        return;
      }

      // Construct the geometry object for location (lng, lat)
      const location = {
        type: "Point",
        coordinates: [Number(lng), Number(lat)],
      };

      // Make the POST request to your backend
      await axios.post(
        `${API_BASE_URL}/api/job-postings`, // ✅ Updated URL
        {
          employer_id: employerId,
          title,
          description,
          location,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      alert("Job posted successfully!");
      // Clear the form
      setTitle("");
      setDescription("");
      setLat(0);
      setLng(0);

      navigate("/main");
    } catch (error) {
      console.error("Error posting job:", error);
      alert("Failed to post job. See console for details.");
    }
  };

  return (
    <div style={{ margin: "20px" }}>
      <h2>Post a Job</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "10px" }}>
          <label>Job Title:</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{ marginLeft: "10px" }}
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Job Description:</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            style={{ marginLeft: "10px" }}
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Latitude:</label>
          <input
            type="number"
            step="any"
            value={lat}
            onChange={(e) =>
              setLat(e.target.value === "" ? "" : Number(e.target.value))
            }
            style={{ marginLeft: "10px" }}
          />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label>Longitude:</label>
          <input
            type="number"
            step="any"
            value={lng}
            onChange={(e) =>
              setLng(e.target.value === "" ? "" : Number(e.target.value))
            }
            style={{ marginLeft: "10px" }}
          />
        </div>

        <button type="submit">Create Job</button>
      </form>
    </div>
  );
};

export default PostJobPage;
