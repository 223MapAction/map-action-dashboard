import React, { useState } from 'react';
import { MesInterventionsModalContext } from './mesInterventionsModalContexte';

const FERMEE = { open: false, incident: null };

/**
 * État des trois fenêtres de la page. Leur animation de sortie est gérée par
 * Dialogue : ici, une fenêtre est seulement ouverte ou fermée.
 */
export const MesInterventionsModalProvider = ({ children }) => {
  const [assignModal, setAssignModal] = useState(FERMEE);
  const [agentsModal, setAgentsModal] = useState(FERMEE);
  const [reportsModal, setReportsModal] = useState(FERMEE);
  const [mutateIncidents, setMutateIncidents] = useState(null);
  const [toast, setToast] = useState(null);

  return (
    <MesInterventionsModalContext.Provider
      value={{
        assignModal,
        openAssignModal: (incident) => setAssignModal({ open: true, incident }),
        closeAssignModal: () => setAssignModal(FERMEE),
        agentsModal,
        openAgentsModal: (incident) => setAgentsModal({ open: true, incident }),
        closeAgentsModal: () => setAgentsModal(FERMEE),
        reportsModal,
        openReportsModal: (incident) => setReportsModal({ open: true, incident }),
        closeReportsModal: () => setReportsModal(FERMEE),
        mutateIncidents,
        setMutateIncidents,
        toast,
        afficherToast: (texte) => setToast({ texte, n: Date.now() }),
      }}
    >
      {children}
    </MesInterventionsModalContext.Provider>
  );
};
