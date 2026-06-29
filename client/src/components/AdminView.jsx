import React, { useState } from 'react';
import { useAppState } from '../context/AppStateContext';
import { processPunishment } from '../utils/logic';
import { motion } from 'framer-motion';

const AdminView = () => {
  const { appState, syncState, resetState } = useAppState();
  const [user, setUser] = useState('Goti');
  const [days, setDays] = useState(1);
  const [reason, setReason] = useState('');

  const handleAddPunishment = () => {
    if (!reason.trim()) {
      alert('Debes ingresar un motivo');
      return;
    }
    const newState = processPunishment(appState, user, reason, parseInt(days));
    syncState(newState);
    setReason('');
    setDays(1);
    alert(`Castigo de ${days} días aplicado a ${user}`);
  };

  const handleReset = () => {
    if (confirm('¿Estás seguro de reiniciar TODOS los datos de la app? Esto no se puede deshacer.')) {
      resetState();
      alert('Aplicación reiniciada');
      window.location.reload();
    }
  };

  return (
    <div className="scroll-area" style={{display: 'flex', flexDirection: 'column', gap: 24, padding: '20px 0', height: '100%'}}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-panel"
      >
        <h2 style={{textAlign: 'center', marginBottom: 32}}>Panel de Administración</h2>
        
        <div style={{display: 'flex', flexDirection: 'column', gap: 20}}>
          <div>
            <label className="eyebrow" style={{marginBottom: 8, display: 'block'}}>Usuario a castigar</label>
            <select 
              className="input-field" 
              value={user} 
              onChange={e => setUser(e.target.value)}
            >
              <option value="Goti">Goti</option>
              <option value="Vale">Vale</option>
            </select>
          </div>

          <div>
            <label className="eyebrow" style={{marginBottom: 8, display: 'block'}}>Días de castigo</label>
            <input 
              type="number" 
              className="input-field" 
              min="1" 
              value={days} 
              onChange={e => setDays(e.target.value)}
            />
          </div>

          <div>
            <label className="eyebrow" style={{marginBottom: 8, display: 'block'}}>Motivo del castigo</label>
            <textarea 
              className="input-field" 
              placeholder="Ej. Tráfico de influencias, trampas..." 
              value={reason} 
              onChange={e => setReason(e.target.value)}
            />
          </div>

          <button className="btn btn-primary" style={{marginTop: 16}} onClick={handleAddPunishment}>
            Aplicar Castigo
          </button>
        </div>

        <hr style={{border: 0, borderTop: '1px solid rgba(0,0,0,0.1)', margin: '40px 0'}} />

        <div style={{textAlign: 'center'}}>
          <p style={{color: 'var(--muted)', fontSize: '0.9rem', marginBottom: 20}}>
            Esta acción borrará todos los historiales, rachas y medallas de ambos usuarios. Úsalo con precaución.
          </p>
          <button className="btn btn-danger" onClick={handleReset}>
            Reiniciar Aplicación Completa
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminView;
