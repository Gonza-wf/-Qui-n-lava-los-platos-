import React, { useState, useEffect } from 'react';
import { useAppState } from '../context/AppStateContext';
import {
  getUserTurnInfo, getUserSlotDoneToday, getUserPendingMorning,
  processAction, checkExpiredMakeup, getSlotLabel, SLOTS, USERS, getOtherUser, getOwnerName
} from '../utils/logic';
import { motion, AnimatePresence } from 'framer-motion';

const SlotStatus = ({ label, done }) => (
  <div style={{
    flex: 1,
    padding: '12px 8px',
    borderRadius: 16,
    background: done ? 'rgba(45, 212, 191, 0.15)' : 'rgba(0,0,0,0.04)',
    border: `1px solid ${done ? 'rgba(45,212,191,0.3)' : 'rgba(0,0,0,0.06)'}`,
    textAlign: 'center',
    transition: 'all 0.3s'
  }}>
    <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: done ? 'var(--accent-2)' : 'var(--muted)' }}>
      {done ? '✓' : '—'}
    </div>
  </div>
);

const TodayView = () => {
  const { appState, selectedUser, syncState } = useAppState();
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // { slot }
  const [reason, setReason] = useState('');

  // Check every minute if we crossed 15:00 (turn change) or expired makeups
  useEffect(() => {
    if (!appState) return;
    const run = () => {
      const updated = checkExpiredMakeup(appState);
      if (updated !== appState) syncState(updated);
    };
    run(); // run immediately on mount
    const id = setInterval(run, 60_000); // and every minute
    return () => clearInterval(id);
  }, [appState?.lastDayChangeDate]);

  if (!appState || !selectedUser) return null;

  const otherUser = getOtherUser(selectedUser);

  // Per-user turn info
  const myInfo = getUserTurnInfo(appState, selectedUser);
  const otherInfo = getUserTurnInfo(appState, otherUser);
  const isMyDay = getOwnerName(appState.currentOwner) === selectedUser;

  const myTardeDone = getUserSlotDoneToday(appState, selectedUser, SLOTS.TARDE);
  const myNocheDone = getUserSlotDoneToday(appState, selectedUser, SLOTS.NOCHE);
  const myManaDone = getUserSlotDoneToday(appState, selectedUser, SLOTS.MANANA);

  const myPunishment = appState.punishments?.[selectedUser] || 0;
  const otherPunishment = appState.punishments?.[otherUser] || 0;

  const handleAction = (slot, action) => {
    if (action === 'no-pude') {
      setPendingAction({ slot });
      setShowReasonModal(true);
    } else {
      const newState = processAction(appState, selectedUser, slot, 'lavé');
      syncState(newState);
    }
  };

  const submitReason = () => {
    const newState = processAction(appState, selectedUser, pendingAction.slot, 'no-pude', reason);
    syncState(newState);
    setShowReasonModal(false);
    setReason('');
    setPendingAction(null);
  };

  const handleForgive = (forgive) => {
    const newState = JSON.parse(JSON.stringify(appState));
    const todayKey = new Date().toISOString().slice(0, 10);
    if (forgive) {
      newState.punishments[otherUser] = 0;
    }
    newState.entries.unshift({
      id: `${todayKey}-${forgive ? 'perdon' : 'mantiene'}-${Date.now()}`,
      date: todayKey,
      slot: 'Decisión',
      owner: selectedUser,
      action: forgive ? `Perdonó a ${otherUser}` : `Mantuvo castigo a ${otherUser}`,
      reason: forgive ? 'Perdonado' : 'Castigo mantenido',
      status: forgive ? 'cumplido' : 'no-pude'
    });
    syncState(newState);
  };

  return (
    <div className="center-content" style={{ gap: 20 }}>

      {/* My card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="glass-panel"
        style={{ textAlign: 'center', padding: '32px 24px' }}
      >
        <p className="eyebrow" style={{ marginBottom: 6 }}>{isMyDay ? 'Hoy es tu día' : 'Hoy le toca al otro'}</p>
        <h2 style={{ marginBottom: 24 }}>{selectedUser}</h2>

        {/* Slot progress */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
          <SlotStatus label="Tarde" done={myTardeDone} />
          <SlotStatus label="Noche" done={myNocheDone} />
          <SlotStatus label="Mañana" done={myManaDone} />
        </div>

        {/* Action area */}
        {myInfo.available && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem', marginBottom: 4 }}>
              {myInfo.message}
            </p>
            <button
              className="btn btn-primary"
              style={{ padding: '18px', fontSize: '1.1rem' }}
              onClick={() => handleAction(myInfo.slot, 'lavé')}
            >
              Lavé — {getSlotLabel(myInfo.slot)}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => handleAction(myInfo.slot, 'no-pude')}
            >
              No pude
            </button>
          </div>
        )}

        {!myInfo.available && myInfo.done && (
          <motion.p
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ color: 'var(--accent-2)', fontWeight: 700, fontSize: '1.05rem' }}
          >
            {myInfo.message}
          </motion.p>
        )}

        {!myInfo.available && myInfo.waiting && (
          <p style={{ color: 'var(--muted)', fontSize: '1rem' }}>{myInfo.message}</p>
        )}

        {myInfo.expired && (
          <p style={{ color: 'var(--danger)', fontWeight: 700 }}>{myInfo.message}</p>
        )}
      </motion.div>

      {/* Other user summary */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass-panel"
        style={{ padding: '20px 24px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <strong style={{ fontSize: '1.1rem' }}>{otherUser}</strong>
          <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            {otherInfo.done ? 'Completado' : (otherInfo.waiting ? 'Esperando tarde' : 'Pendiente')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <SlotStatus label="Tarde" done={getUserSlotDoneToday(appState, otherUser, SLOTS.TARDE)} />
          <SlotStatus label="Noche" done={getUserSlotDoneToday(appState, otherUser, SLOTS.NOCHE)} />
          <SlotStatus label="Mañana" done={getUserSlotDoneToday(appState, otherUser, SLOTS.MANANA)} />
        </div>
      </motion.div>

      {/* My punishment */}
      <AnimatePresence>
        {myPunishment > 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="glass-panel"
            style={{ background: 'rgba(244,63,94,0.08)', borderColor: 'rgba(244,63,94,0.2)', textAlign: 'center' }}
          >
            <strong style={{ color: 'var(--danger)' }}>
              Tienes {myPunishment} día{myPunishment === 1 ? '' : 's'} de castigo pendiente.
            </strong>
            <p style={{ color: 'var(--danger)', opacity: 0.7, fontSize: '0.9rem', marginTop: 8 }}>
              Cada vez que lavés en un turno se descuenta uno.
            </p>
          </motion.div>
        )}

        {/* Other user punishment + forgive */}
        {otherPunishment > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="glass-panel"
            style={{ textAlign: 'center' }}
          >
            <strong>
              {otherUser} tiene {otherPunishment} día{otherPunishment === 1 ? '' : 's'} de castigo.
            </strong>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: '10px 0 20px' }}>
              ¿Decidís perdonarlo?
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleForgive(true)}>Perdonar</button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleForgive(false)}>Mantener</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reason modal */}
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
              <h3 style={{ marginBottom: 16 }}>¿Por qué no pudiste?</h3>
              <textarea
                className="input-field"
                placeholder="Escribe un motivo..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                maxLength={120}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
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
