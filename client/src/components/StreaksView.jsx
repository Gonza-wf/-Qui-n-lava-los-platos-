import React, { useState } from 'react';
import { useAppState } from '../context/AppStateContext';
import { getTodayKey, getOtherOwnerIndex, computeNextTurnAt } from '../utils/logic';
import { motion, AnimatePresence } from 'framer-motion';

const StreaksView = () => {
  const { appState, selectedUser, syncState } = useAppState();
  const [showMedals, setShowMedals] = useState(false);

  const displayUser = selectedUser || 'Goti';
  const displayStreak = appState.streaks[displayUser];
  
  const hasAvailableReward = displayStreak.rewardAvailable && (!displayStreak.rewardExpiresAt || Date.now() <= displayStreak.rewardExpiresAt);
  const isActiveReward = displayStreak.rewardActivatedAt === getTodayKey();

  const handleUseReward = () => {
    if (!hasAvailableReward || isActiveReward) return;

    const newState = JSON.parse(JSON.stringify(appState));
    const streak = newState.streaks[displayUser];
    
    streak.rewardAvailable = false;
    streak.rewardActivatedAt = getTodayKey();
    streak.rewardExpiresAt = null;
    streak.current += 1;
    streak.best = Math.max(streak.best, streak.current);
    
    newState.completedDays += 1;
    newState.lastActionDate = getTodayKey();
    newState.nextOwner = getOtherOwnerIndex(newState.currentOwner);
    newState.nextTurnAt = computeNextTurnAt();

    newState.entries.unshift({
      id: `${getTodayKey()}-comodin-${Date.now()}`,
      date: getTodayKey(),
      slot: 'Comodín',
      owner: displayUser,
      action: 'Comodín activado',
      reason: 'Protección de un día sin castigo',
      status: 'cumplido'
    });

    syncState(newState);
  };

  return (
    <div className="center-content">
      <div className="glass-panel" style={{textAlign: 'center', padding: '40px 24px'}}>
        <h2 style={{marginBottom: 40}}>Rachas de {displayUser}</h2>
        
        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 48, width: '100%'}}>
          <div style={{flex: 1}}>
            <div className="eyebrow" style={{marginBottom: 12}}>Días</div>
            <strong style={{fontSize: '2.5rem', color: 'var(--accent)', lineHeight: 1}}>{appState.completedDays}</strong>
          </div>
          <div style={{flex: 1}}>
            <div className="eyebrow" style={{marginBottom: 12}}>Fallos</div>
            <strong style={{fontSize: '2.5rem', color: 'var(--danger)', lineHeight: 1}}>{appState.failedDays}</strong>
          </div>
          <div style={{flex: 1}}>
            <div className="eyebrow" style={{marginBottom: 12}}>Trofeos</div>
            <strong style={{fontSize: '2.5rem', color: '#f59e0b', lineHeight: 1}}>{displayStreak.medals}</strong>
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.8)', 
          padding: 32, 
          borderRadius: 24, 
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
          border: '1px solid rgba(255,255,255,0.5)'
        }}>
          <div style={{height: 12, background: 'rgba(45, 212, 191, 0.15)', borderRadius: 999, overflow: 'hidden', marginBottom: 20}}>
            <div style={{
              height: '100%', 
              width: `${Math.max(2, Math.min(100, (displayStreak.current / 30) * 100))}%`, 
              background: 'linear-gradient(90deg, var(--accent), var(--accent-2))', 
              transition: 'width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}></div>
          </div>
          
          <div style={{minHeight: 60, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
            {isActiveReward ? (
              <p style={{color: 'var(--accent)', fontWeight: 700, fontSize: '1.1rem'}}>Comodín activo hoy</p>
            ) : hasAvailableReward ? (
              <>
                <p style={{color: 'var(--accent)', fontWeight: 700, fontSize: '1.1rem', marginBottom: 6}}>¡Comodín disponible!</p>
                <p style={{color: 'var(--muted)', fontSize: '0.9rem'}}>Vence: {new Date(displayStreak.rewardExpiresAt).toLocaleDateString()}</p>
              </>
            ) : (
              <p style={{color: 'var(--muted)', fontSize: '1.05rem', fontWeight: 500}}>
                Faltan <strong style={{color: 'var(--text)'}}>{30 - (displayStreak.current % 30)}</strong> días para el trofeo.
              </p>
            )}
          </div>

          <div style={{display: 'flex', gap: 16, marginTop: 24}}>
            {hasAvailableReward && !isActiveReward && (
              <button className="btn btn-primary" onClick={handleUseReward}>Usar comodín</button>
            )}
            <button className="btn btn-ghost" onClick={() => setShowMedals(true)}>Ver trofeos</button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showMedals && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="overlay" 
            onClick={() => setShowMedals(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="glass-panel modal" 
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{marginBottom: 24, textAlign: 'center', fontSize: '1.5rem'}}>Tus Trofeos</h3>
              <div className="scroll-area" style={{display: 'grid', gap: 16, maxHeight: '350px'}}>
                {displayStreak.medalsHistory.length > 0 ? displayStreak.medalsHistory.map((date, i) => (
                  <div key={i} style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'rgba(45, 212, 191, 0.1)', borderRadius: 16}}>
                    <strong style={{fontSize: '1.1rem'}}>Trofeo {i + 1}</strong>
                    <span style={{color: 'var(--muted)', fontWeight: 500}}>{date}</span>
                  </div>
                )) : (
                  <p style={{color: 'var(--muted)', textAlign: 'center', padding: '20px 0', fontSize: '1.1rem'}}>Aún no tienes trofeos.</p>
                )}
              </div>
              <button className="btn btn-primary" style={{marginTop: 32}} onClick={() => setShowMedals(false)}>Cerrar</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StreaksView;
