import React, { useEffect, useState } from 'react';
import "leaflet/dist/leaflet.css";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/MapView.css'; // Make sure this file contains your map styles
import artistIconPath from '../assets/icons/artist-icon.png';
import employerIconPath from '../assets/icons/employer-icon.png';
import '../styles/Global.css';

// ✅ Read API URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:50001';

// Define custom icons
const artistIcon = new L.Icon({
  iconUrl: artistIconPath,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const employerIcon = new L.Icon({
  iconUrl: employerIconPath,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// 1) Basic location data
interface LocationData {
  user_id: number;
  fullname: string;
  location: {
    latitude: number;
    longitude: number;
  };
  // 2) Optional user profile data after second fetch
  profile?: {
    fullname?: string;
    bio?: string;
    profile_picture?: string;
    // Add any other fields your server returns
  };
}

// (Optional) Component to reset the view on zoom changes
const ResetViewOnZoom = ({ center }: { center: [number, number] }) => {
  const map = useMapEvents({
    zoomend: () => {
      map.setView(center); // This keeps the center fixed after zoom
    },
  });
  return null;
};

const MapView = ({ userType }: { userType: string }) => {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const navigate = useNavigate();

  // Center of Patras, Greece
  const center: [number, number] = [38.246639, 21.734573];

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return console.warn('No token found; user might not be logged in.');

        const targetUserType = userType === 'Artist' ? 'Employer' : 'Artist';

        // 1) Fetch the basic location data
        const response = await axios.get(
          `${API_BASE_URL}/api/locations?userType=${targetUserType}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const fetchedLocations: LocationData[] = response.data;

        // 2) Fetch each user’s full profile
        const updatedLocations = await Promise.all(
          fetchedLocations.map(async (loc) => {
            try {
              const profileRes = await axios.get(
                `${API_BASE_URL}/api/users/profile/${loc.user_id}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              return {
                ...loc,
                profile: profileRes.data,
              };
            } catch (err) {
              console.error('Error fetching profile for user_id=', loc.user_id, err);
              return loc;
            }
          })
        );

        setLocations(updatedLocations);
      } catch (error) {
        console.error('Error fetching locations:', error);
      }
    };

    fetchLocations();
  }, [userType]);

  return (
    <div className="map-page">
      <MapContainer
        className="leaflet-map"
        center={center}
        zoom={15}
        maxZoom={24}
      >
        <ResetViewOnZoom center={center} />

        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CartoDB</a> contributors'
        />

        {locations.map((loc) => (
          <Marker
            key={loc.user_id}
            position={[loc.location.latitude, loc.location.longitude]}
            icon={userType === 'Artist' ? employerIcon : artistIcon}
          >
            <Popup>
              <div className="popup-content">
                {/* If we have a full profile, show more details */}
                {loc.profile ? (
                  <>
                    <strong>{loc.profile.fullname}</strong>
                    <br />
                    {loc.profile.bio ? (
                      <em>{loc.profile.bio}</em>
                    ) : (
                      <span>No bio available</span>
                    )}
                    <br />
                    {loc.profile.profile_picture && (
                      <img
                        src={loc.profile.profile_picture}
                        alt="Profile"
                        style={{ width: '60px', height: '60px', borderRadius: '50%' }}
                      />
                    )}
                  </>
                ) : (
                  // Fallback if no profile data
                  <>
                    <strong>{loc.fullname}</strong>
                    <br />
                    <span>Loading profile...</span>
                  </>
                )}

                <br />
                {/* The userType logic: if I'm Artist, loc is Employer, else Artist */}
                <small>
                  {userType === 'Artist' ? 'Employer' : 'Artist'}
                </small>
                <br />

                {/* Button to go to the user profile page */}
                <button
                  className="popup-button"
                  onClick={() => navigate(`/user-profile/${loc.user_id}`)}
                >
                  View Profile
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MapView;
