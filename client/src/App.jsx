import { useState, useEffect } from 'react';
import { useAppState } from './context/AppStateContext';
import { Home, History, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TodayView from './components/TodayView';
import HistoryView from './components/HistoryView';
import StreaksView from './components/StreaksView';
import AdminView from './components/AdminView';
import { requestNotificationPermission, scheduleDailyReminder } from './utils/notifications';
import { getOwnerName } from './utils/logic';

function App() {
  const { appState, isConnected, selectedUser, selectUser } = useAppState();
  const [currentTab, setCurrentTab] = useState('today');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'a') {
        setShowAdminLogin(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Request notification permission and start daily reminder
  useEffect(() => {
    if (!appState) return;
    requestNotificationPermission();
    const intervalId = scheduleDailyReminder(
      () => getOwnerName(appState.currentOwner)
    );
    return () => clearInterval(intervalId);
  }, [appState?.currentOwner]);

  if (!appState) {
    return (
      <div className="overlay">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="glass-panel" 
          style={{textAlign: 'center'}}
        >
          <h2>Cargando...</h2>
        </motion.div>
      </div>
    );
  }

  if (!selectedUser) {
    return (
      <div className="overlay">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="glass-panel modal" 
          style={{textAlign: 'center'}}
        >
          <p className="eyebrow" style={{marginBottom: 16}}>¿Quién sos?</p>
          <div style={{display: 'flex', gap: 12}}>
            <button className="btn btn-primary" onClick={() => selectUser('Goti')}>Goti</button>
            <button className="btn btn-primary" onClick={() => selectUser('Vale')}>Vale</button>
          </div>
        </motion.div>
      </div>
    );
  }

  const handleAdminLogin = () => {
    if (adminPassword === 'admin123') {
      setIsAdmin(true);
      setShowAdminLogin(false);
      setCurrentTab('admin');
      setAdminPassword('');
    } else {
      alert('Clave incorrecta');
    }
  };

  const pageVariants = {
    initial: { opacity: 0, y: 15, scale: 0.98 },
    in: { opacity: 1, y: 0, scale: 1 },
    out: { opacity: 0, y: -15, scale: 0.98 }
  };

  const pageTransition = {
    type: 'spring',
    stiffness: 300,
    damping: 24
  };

  return (
    <div className="app-shell">
      <div className="status-indicator">
        <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
        {isConnected ? 'Sincronizado' : 'Sin conexión'}
      </div>

      <main>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab}
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            {currentTab === 'today' && <TodayView />}
            {currentTab === 'history' && <HistoryView />}
            {currentTab === 'streaks' && <StreaksView />}
            {currentTab === 'admin' && isAdmin && <AdminView />}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="bottom-nav">
        <button className={`nav-item ${currentTab === 'today' ? 'active' : ''}`} onClick={() => setCurrentTab('today')}>
          <Home /> Hoy
        </button>
        <button className={`nav-item ${currentTab === 'history' ? 'active' : ''}`} onClick={() => setCurrentTab('history')}>
          <History /> Historial
        </button>
        <button className={`nav-item ${currentTab === 'streaks' ? 'active' : ''}`} onClick={() => setCurrentTab('streaks')}>
          <Trophy /> Rachas
        </button>
        {isAdmin && (
          <button className={`nav-item ${currentTab === 'admin' ? 'active' : ''}`} onClick={() => setCurrentTab('admin')}>
            Admin
          </button>
        )}
      </nav>

      <AnimatePresence>
        {showAdminLogin && !isAdmin && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="overlay"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} 
              className="glass-panel modal"
            >
              <h3 style={{marginBottom: 8}}>Acceso administrador</h3>
              <input 
                type="password" 
                className="input-field" 
                placeholder="Clave" 
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                autoFocus
              />
              <div style={{display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end'}}>
                <button className="btn btn-ghost" onClick={() => setShowAdminLogin(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleAdminLogin}>Entrar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
