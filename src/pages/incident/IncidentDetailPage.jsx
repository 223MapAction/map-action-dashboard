import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSidebarState } from '../../hooks/useSidebarState';
import { Header, Sidebar } from '../../components/layout';
import { IncidentDetail } from './components/IncidentDetail/IncidentDetail';
import { useEstTelephone } from './mobile/useEstTelephone';
import './incident.css';

export const IncidentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const incidentFromState = location.state?.incident;
  const estTelephone = useEstTelephone();
  const {
    isOpen: sidebarOpen,
    setOpen: setSidebarOpen,
    isCollapsed: sidebarCollapsed,
    setCollapsed: setSidebarCollapsed,
  } = useSidebarState();

  const handleBack = () => {
    const fromTab = location.state?.from;
    if (fromTab) {
      navigate(fromTab);
    } else {
      navigate('/signalements');
    }
  };

  return (
    <div className="incident-page">
      {/* Sur téléphone, l'écran est poussé : ni en-tête ni barre d'onglets. */}
      {!estTelephone && (
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
      )}

      <div className={`incident-page-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {!estTelephone && (
          <Header
            onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
            sidebarCollapsed={sidebarCollapsed}
          />
        )}

        <div className="incident-workspace">
          {/* On rend le composant détail existant. Il gère déjà useSWR pour charger ses données. */}
          <IncidentDetail
            incident={incidentFromState || { id: id }}
            onBack={handleBack}
            isLoading={false}
          />
        </div>
      </div>
    </div>
  );
};
