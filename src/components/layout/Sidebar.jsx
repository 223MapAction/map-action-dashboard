import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../../pages/auth/services/authService';
import { getAccessibleNavIds } from '../../utils/permissions';
import {
  Element4,
  Briefcase, Award, Trash, Buildings2, Profile2User, Lock1
} from 'iconsax-react';
import logoMapActionMin from '../../assets/logo-min.webp';
import './sidebar.css';
import useSWR from 'swr';
import { People as IconsaxPeople } from 'iconsax-react';
import { getDashboardStatsService } from '../../pages/dashboard/service/dashboard_service';

export const Sidebar = ({ isOpen, onClose, isCollapsed: controlledCollapsed, onCollapsedChange, onToggleCollapse, hideToggle = false }) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const navigate = useNavigate();
  const location = useLocation();

  const handleToggleCollapsed = () => {
    const newCollapsedState = !isCollapsed;
    if (onCollapsedChange) {
      onCollapsedChange(newCollapsedState);
    } else if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed(newCollapsedState);
    }
  };
  // Trois groupes : le travail du jour, le réseau de partenaires, les
  // résultats. Le profil vit dans le menu de l'avatar ; la corbeille, utilitaire,
  // descend en bas de la barre.
  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: Element4, path: '/dashboard', group: 'Opérations' },
    { id: 'incidents', label: 'Signalements', icon: Briefcase, path: '/signalements', group: 'Opérations', badge: 'aTraiter' },
    { id: 'mes-interventions', label: 'Mes interventions', icon: Lock1, path: '/mes-interventions', group: 'Opérations' },
    { id: 'collaboration', label: 'Collaborations', icon: IconsaxPeople, path: '/collaboration', group: 'Réseau' },
    { id: 'organisations', label: 'Organisations', icon: Buildings2, path: '/organisations', group: 'Réseau' },
    { id: 'agents', label: 'Agents', icon: Profile2User, path: '/agents', group: 'Réseau' },
    { id: 'impact', label: 'Impact', icon: Award, path: '/impact', group: 'Résultats' },
    { id: 'trash', label: 'Corbeille', icon: Trash, path: '/trash', group: 'bas' },
  ];

  // Compteur « à traiter » : même clé SWR que le dashboard, donc aucun appel en double.
  // La barre latérale est remontée à chaque page : sans délai de déduplication,
  // chaque navigation relançait ces statistiques. Une minute suffit pour un badge.
  const { data: statsData } = useSWR('/MapApi/incidents/dashboard-stats/', () => getDashboardStatsService(), {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });
  const badges = {
    aTraiter: Math.max(
      (statsData?.total_alerts ?? 0) - (statsData?.resolved_incidents ?? 0) - (statsData?.active_responses ?? 0),
      0
    ),
  };

  const user = authService.getCurrentUser();

  // Dépendance sur `user?.web_role` et non sur `user` : getCurrentUser() fait un
  // JSON.parse à chaque rendu et renvoie donc un objet neuf à chaque fois, ce
  // qui invaliderait le mémo en permanence.
  const filteredNavItems = useMemo(() => {
    const allowedIds = getAccessibleNavIds(user);
    return navItems.filter(item => allowedIds.includes(item.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.web_role]);

  const handleItemClick = (path) => {
    navigate(path);
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  const isActive = (path) => {
    const fromTab = location.state?.from;
    if (fromTab) {
      return path === fromTab;
    }
    if (location.pathname === path) return true;
    if (path !== '/' && location.pathname.startsWith(path + '/')) return true;
    if (path === '/collaboration' && location.pathname.startsWith('/collaboration-detail')) return true;
    // Garder mes-interventions actif si on vient de cette page vers collaboration-detail
    if (path === '/mes-interventions' && location.pathname.startsWith('/collaboration-detail') && fromTab === '/mes-interventions') return true;
    return false;
  };

  return (
    <>
      {/* Overlay pour mobile */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`app-sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
        {/* Bouton Toggle Flottant - Au-dessus de tout */}
        {!hideToggle && (
        <button
          className="sidebar-toggle-btn"
          onClick={() => {
            // Sur mobile: fermer l'overlay
            if (window.innerWidth < 1024) {
              onClose();
            } else {
              // Sur desktop: toggle collapsed state
              handleToggleCollapsed();
            }
          }}
          aria-label={isCollapsed ? "Étendre la sidebar" : "Réduire la sidebar"}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            {isCollapsed ? (
              <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M10 4L6 8l4 4" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </button>
        )}

        {/* Logo Section */}
        <div className="sidebar-header">
          <div className="sidebar-logo sidebar-logo-maquette">
            <span className="sidebar-logo-tuile">
              <img src={logoMapActionMin} alt="" aria-hidden="true" />
            </span>
            <span className="sidebar-logo-texte">Map Action</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav" role="navigation">
          {['Opérations', 'Réseau', 'Résultats', 'bas'].map((groupe) => {
            const items = filteredNavItems.filter((item) => item.group === groupe);
            if (items.length === 0) return null;
            return (
              <div key={groupe} className={`sidebar-group ${groupe === 'bas' ? 'sidebar-group-bottom' : ''}`}>
                {groupe !== 'bas' && <h6 className="sidebar-group-title">{groupe}</h6>}
                {items.map((item) => {
                  const compte = item.badge ? badges[item.badge] : 0;
                  return (
                    <button
                      key={item.id}
                      className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
                      onClick={() => handleItemClick(item.path)}
                      aria-current={isActive(item.path) ? 'page' : undefined}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <span className="sidebar-icon">
                        <item.icon size={20} variant={isActive(item.path) ? 'Bold' : 'Linear'} color="currentColor" />
                      </span>
                      <span className="sidebar-label">{item.label}</span>
                      {compte > 0 && (
                        <span className="sidebar-badge" aria-label={`${compte} à traiter`}>
                          {compte > 99 ? '99+' : compte}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>



      </aside>
    </>
  );
};

export default Sidebar;
