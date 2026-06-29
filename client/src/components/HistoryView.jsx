import React, { useState } from 'react';
import { useAppState } from '../context/AppStateContext';
import { motion, AnimatePresence } from 'framer-motion';

const HistoryView = () => {
  const { appState } = useAppState();
  const [selectedReason, setSelectedReason] = useState(null);

  if (appState.entries.length === 0) {
    return (
      <div className="glass-panel" style={{textAlign: 'center', padding: '40px 24px'}}>
        <h2>Historial</h2>
        <p style={{color: 'var(--muted)', marginTop: 20, fontSize: '1.1rem'}}>Aún no hay registros. Tu primer registro aparecerá aquí.</p>
      </div>
    );
  }

  return (
    <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
      <h2 style={{textAlign: 'center', marginBottom: 20, flexShrink: 0}}>Historial</h2>
      
      <div className="scroll-area" style={{display: 'flex', flexDirection: 'column', gap: 16, flex: 1, paddingBottom: 20}}>
        {appState.entries.map((entry, index) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            key={entry.id} 
            className="glass-panel" 
            style={{padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0}}
          >
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
              <div>
                <strong style={{fontSize: '1.2rem'}}>{entry.date}</strong>
                <div style={{color: 'var(--muted)', fontSize: '0.95rem', marginTop: 6, fontWeight: 500}}>
                  {entry.owner} <span style={{opacity: 0.5}}>•</span> {entry.slot}
                </div>
              </div>
              
              <div style={{
                fontWeight: 800, 
                fontSize: '1.05rem',
                color: entry.status === 'cumplido' ? 'var(--accent)' : 
                       entry.status === 'no-pude' ? 'var(--danger)' : 
                       entry.status === 'castigo' ? 'var(--danger)' : 'var(--text)',
                textAlign: 'right'
              }}>
                {entry.action}
              </div>
            </div>
            
            {entry.reason && (
              <button 
                className="btn btn-ghost" 
                style={{padding: '10px 16px', fontSize: '0.9rem', alignSelf: 'flex-start'}}
                onClick={() => setSelectedReason(entry.reason)}
              >
                Ver motivo
              </button>
            )}
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedReason && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="overlay" 
            onClick={() => setSelectedReason(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="glass-panel modal" 
              onClick={e => e.stopPropagation()}
            >
              <h3 style={{marginBottom: 16}}>Motivo</h3>
              <p style={{color: 'var(--muted)', fontSize: '1.1rem', lineHeight: 1.6}}>{selectedReason}</p>
              <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: 32}}>
                <button className="btn btn-primary" onClick={() => setSelectedReason(null)}>Cerrar</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HistoryView;
