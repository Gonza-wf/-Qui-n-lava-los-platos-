import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const AppStateContext = createContext(null);

// For local testing, default to localhost:3001
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || `http://${window.location.hostname}:3001`;

export const AppStateProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [appState, setAppState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedUser, setSelectedUser] = useState(() => {
    return localStorage.getItem('selectedUser') || null;
  });

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));
    
    newSocket.on('stateUpdated', (newState) => {
      setAppState(newState);
    });

    return () => newSocket.close();
  }, []);

  const selectUser = (user) => {
    setSelectedUser(user);
    localStorage.setItem('selectedUser', user);
  };

  const syncState = (updates) => {
    if (!socket || !appState) return;
    const newState = { ...appState, ...updates };
    setAppState(newState); // Optimistic update
    socket.emit('syncState', newState);
  };

  const resetState = () => {
    if (socket) socket.emit('resetState');
  };

  return (
    <AppStateContext.Provider value={{
      appState,
      isConnected,
      selectedUser,
      selectUser,
      syncState,
      resetState
    }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => useContext(AppStateContext);
