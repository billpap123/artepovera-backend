import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { UserProvider } from "./context/UserContext";

// Pages & Components
import LandingPage from "./pages/LandingPage"; // ✅ Your new landing page
import Register from "./pages/Register";
import Login from "./pages/Login";
import ArtistProfile from "./pages/ArtistProfile";
import EmployerProfile from "./pages/EmployerProfile";
import MainPage from "./pages/MainPage";
import ProtectedRoute from "./components/ProtectedRoute";
import Portfolio from "./pages/Portfolio";
import UserProfilePage from "./pages/UserProfilePage";
import JobListings from "./pages/JobListings";
import ChatPage from "./pages/ChatPage";
import PostJobPage from "./pages/PostJobPage";

const App = () => {
  const token = localStorage.getItem("token");
  const user = token ? JSON.parse(localStorage.getItem("user") || "{}") : null;

  return (
    <UserProvider>
      <Router basename={import.meta.env.VITE_BASE_URL || "/"}>
        <Routes>
          {/* 
            1) Root route: if user is logged in, go to /main, 
               else show LandingPage 
          */}
          <Route
            path="/"
            element={
              token ? (
                <Navigate to="/main" replace />
              ) : (
                <LandingPage />  // Show the landing page if not authenticated
              )
            }
          />

          {/* Public routes */}
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />

          {/* Protected routes (must be logged in) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/main" element={<MainPage />} />
            <Route path="/artist-profile" element={<ArtistProfile />} />
            <Route path="/employer-profile" element={<EmployerProfile />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route
              path="/portfolio"
              element={<Portfolio artistId={user?.user_id || 0} />}
            />
            <Route path="/user-profile/:userId" element={<UserProfilePage />} />
            <Route path="/job-listings" element={<JobListings />} />
          </Route>

          {/* PostJob is presumably an Employer route, but if it's not protected, leave as is */}
          <Route path="/post-job" element={<PostJobPage />} />

          {/* Catch-all route */}
          <Route
            path="*"
            element={<Navigate to={token ? "/main" : "/login"} replace />}
          />
        </Routes>
      </Router>
    </UserProvider>
  );
};

export default App;
