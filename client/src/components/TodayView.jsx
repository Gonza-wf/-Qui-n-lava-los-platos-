import React, { useState, useEffect } from 'react';
import { useAppState } from '../context/AppStateContext';
import { getCurrentSlot, getOwnerName, hasActionToday, isAfterTurnStart, processAction, checkPendingOwnerChange } from '../utils/logic';
import { motion, AnimatePresence } from 'framer-motion';

const TodayView = () => {
  const { appState, selectedUser, syncState } = useAppState();
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    const newState = checkPendingOwnerChange(appState);
    if (newState !== appState) {
      syncState(newState);
    }
  }, [appState]);

  const ownerName = getOwnerName(appState.currentOwner);
  const slot = getCurrentSlot();
  const isCurrentTurn = selectedUser === ownerName;
  const actionDone = hasActionToday(appState);
  const turnAvailable = isAfterTurnStart() && !actionDone;

  const punishedDays = appState.punishments[selectedUser] || 0;
  const otherUser = selectedUser === 'Goti' ? 'Vale' : 'Goti';
  const otherPunishedDays = appState.punishments[otherUser] || 0;

  const handleAction = (actionType) => {
    if (actionType === 'lavé') {
      const newState = processAction(appState, 'lavé');
      syncState(newState);
    } else {
      setShowReasonModal(true);
    }
  };

  const submitReason = () => {
    const newState = processAction(appState, 'no-pude', reason);
    syncState(newState);
    setShowReasonModal(false);
    setReason('');
  };

  const handleForgive = (forgive) => {
    const newState = JSON.parse(JSON.stringify(appState));
    const todayKey = new Date().toISOString().slice(0, 10);
    
    if (forgive) {
      newState.punishments[otherUser] = 0;
      newState.entries.unshift({
        id: `${todayKey}-perdonar-${Date.now()}`,
        date: todayKey,
        slot: 'Perdón',
        owner: selectedUser,
        action: `Perdonó a ${otherUser}`,
        reason: `${otherUser} fue perdonado`,
        status: 'cumplido'
      });
    } else {
      newState.entries.unshift({
        id: `${todayKey}-no-perdonar-${Date.now()}`,
        date: todayKey,
        slot: 'Perdón',
        owner: selectedUser,
        action: `No perdonó a ${otherUser}`,
        reason: `${otherUser} mantiene el castigo`,
        status: 'no-pude'
      });
    }
    syncState(newState);
  };

  return (
    <div className="center-content" style={{gap: 24}}>
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="glass-panel" 
        style={{textAlign: 'center', padding: '40px 24px'}}
      >
        <div style={{display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24}}>
          <span className="chip">{slot}</span>
          <span className="chip" style={{background: 'rgba(255,255,255,0.5)', color: 'var(--muted)'}}>Turno actual</span>
        </div>
        
        <p className="eyebrow" style={{marginBottom: 8}}>Le toca a</p>
        <h1 style={{marginBottom: 40, color: 'var(--text)'}}>{ownerName}</h1>

        {isCurrentTurn && turnAvailable && (
          <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
            <button className="btn btn-primary" style={{padding: '20px', fontSize: '1.2rem'}} onClick={() => handleAction('lavé')}>Lavé los platos</button>
            <button className="btn btn-secondary" onClick={() => handleAction('no-pude')}>No pude hoy</button>
          </div>
        )}

        {actionDone && (
          <motion.p initial={{opacity:0, y: 10}} animate={{opacity:1, y: 0}} style={{marginTop: 20, color: 'var(--accent)', fontWeight: 700, fontSize: '1.2rem'}}>
            Turno completado hoy. ¡Buen trabajo!
          </motion.p>
        )}
        {!actionDone && !turnAvailable && isCurrentTurn && (
          <p style={{marginTop: 24, color: 'var(--muted)', fontSize: '1.1rem'}}>El turno comienza hoy a las 15:00.</p>
        )}
        {!isCurrentTurn && !actionDone && (
          <p style={{marginTop: 24, color: 'var(--muted)', fontSize: '1.1rem'}}>Esperando acción de <strong>{ownerName}</strong>.</p>
        )}
      </motion.div>

      <AnimatePresence>
        {punishedDays > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="glass-panel" 
            style={{background: 'rgba(244, 63, 94, 0.1)', borderColor: 'rgba(244, 63, 94, 0.2)', textAlign: 'center'}}
          >
            <strong style={{color: 'var(--danger)', fontSize: '1.1rem'}}>Tienes {punishedDays} día{punishedDays === 1 ? '' : 's'} de castigo pendiente.</strong>
            <p style={{color: 'var(--danger)', opacity: 0.8, fontSize: '0.95rem', marginTop: 12}}>Completa el día para reducirlo.</p>
          </motion.div>
        )}

        {otherPunishedDays > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="glass-panel" 
            style={{textAlign: 'center'}}
          >
            <strong style={{fontSize: '1.1rem'}}>{otherUser} tiene {otherPunishedDays} día{otherPunishedDays === 1 ? '' : 's'} de castigo.</strong>
            <p style={{color: 'var(--muted)', fontSize: '0.95rem', margin: '12px 0 24px'}}>Decide si perdonar o mantener el castigo.</p>
            <div style={{display: 'flex', gap: 16, justifyContent: 'center'}}>
              <button className="btn btn-primary" style={{flex: 1}} onClick={() => handleForgive(true)}>Perdonar</button>
              <button className="btn btn-danger" style={{flex: 1}} onClick={() => handleForgive(false)}>Mantener</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReasonModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="overlay"
            onClick={() => setShowReasonModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="glass-panel modal"
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{marginBottom: 20, fontSize: '1.3rem'}}>¿Por qué no pudiste?</h3>
              <textarea 
                className="input-field"
                placeholder="Escribe un motivo breve..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                maxLength={120}
                autoFocus
              />
              <div style={{display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end'}}>
                <button className="btn btn-ghost" onClick={() => setShowReasonModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={submitReason} disabled={!reason.trim()}>Guardar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TodayView;
