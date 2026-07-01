import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const AppStateContext = createContext(null);

// For local testing, default to localhost:3001
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || `http://${window.location.hostname}:3001`;

const STATE_BACKUP_KEY = 'appState_backup';

export const AppStateProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [appState, setAppState] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedUser, setSelectedUser] = useState(() => {
    return localStorage.getItem('selectedUser') || null;
  });
  const appStateRef = useRef(null); // keep a ref so socket callbacks get fresh state

  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => setIsConnected(true));
    newSocket.on('disconnect', () => setIsConnected(false));
    
    newSocket.on('stateUpdated', (newState) => {
      // Save every state update to localStorage as disaster-recovery backup
      try { localStorage.setItem(STATE_BACKUP_KEY, JSON.stringify(newState)); } catch {}
      appStateRef.current = newState;
      setAppState(newState);
    });

    // Server lost its data (redeploy) — send backup from localStorage
    newSocket.on('requestStateBackup', () => {
      console.log('[Backup] Server requested state backup');
      try {
        const backup = localStorage.getItem(STATE_BACKUP_KEY);
        if (backup) {
          const parsed = JSON.parse(backup);
          console.log(`[Backup] Sending ${parsed.entries?.length || 0} entries to server`);
          newSocket.emit('restoreStateBackup', parsed);
        }
      } catch (e) {
        console.warn('[Backup] Failed to parse backup', e);
      }
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
