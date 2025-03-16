// UserContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';

// In UserContext.tsx
type UserContextType = {
  userId: string | null;
  artistId: string | null;
  employerId: string | null;
  userType: string | null;  // <-- ADD userType
  setUserId: (userId: string | null) => void;
  setArtistId: (artistId: string | null) => void;
  setEmployerId: (employerId: string | null) => void;
  setUserType: (type: string | null) => void; // <-- ADD setter
};


const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [artistId, setArtistId] = useState<string | null>(null);
  const [employerId, setEmployerId] = useState<string | null>(null);
  const [userType, setUserType] = useState<string | null>(null); // new

  return (
    <UserContext.Provider
      value={{
        userId,
        artistId,
        employerId,
        userType,
        setUserId,
        setArtistId,
        setEmployerId,
        setUserType,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};


export const useUserContext = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUserContext must be used within a UserProvider');
  }
  return context;
};
