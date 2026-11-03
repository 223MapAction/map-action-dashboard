import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { User, Trash, LogoutCurve, ArrowDown2, Notification, Danger, People, InfoCircle } from 'iconsax-react';
import { authService } from '../../pages/auth/services/authService';
import { useNotifications, getRelativeTime, formatNotificationMessage, cibleNotification } from './useNotifications';
import { BlurryImage } from '../atoms/BlurryImage';
import './header.css';
import { HeaderSearch } from './HeaderSearch';

// Pictogrammes au trait de la maquette (18 px, trait 1,8).
const IconeTrait = ({ children }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const IconeCloche = () => (
  <IconeTrait><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10.3 21a2 2 0 0 0 3.4 0" /></IconeTrait>
);
const IconeProfil = () => (
  <IconeTrait><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></IconeTrait>
);
const IconeCorbeille = () => (
  <IconeTrait><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></IconeTrait>
);
const IconeSortie = () => (
  <IconeTrait><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></IconeTrait>
);

const initialesUtilisateur = (u) => {
  const prenom = (u?.first_name || '').trim();
  const nom = (u?.last_name || '').trim();
  const lettres = (prenom[0] || '') + (nom[0] || '');
  return (lettres || prenom.slice(0, 2) || 'U').toUpperCase();
};

export const Header = ({ onMenuToggle, onToggleCollapse, actionsContainer = null, user }) => {
  const navigate = useNavigate();
  const currentUser = user || authService.getCurrentUser();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const {
    notifications,
    isLoadingNotifications,
    nextNotificationsUrl,
    isLoadingMoreNotifications,
    handleLoadMoreNotifications,
    unreadCount,
    marquerLue,
    handleMarkAllRead,
  } = useNotifications();

  // Marquer une notification comme lue et naviguer
  const handleNotificationClick = async (notification) => {
    const targetUrl = cibleNotification(notification);
    if (targetUrl) {
      navigate(targetUrl);
      setShowNotifications(false);
    }
    await marquerLue(notification);
  };

  // Fonction pour obtenir l'icône selon le type de notification
  const getNotificationIcon = (type) => {
    const iconProps = { size: 20, variant: "Bold" };
    switch (type) {
      case 'collaboration':
      case 'leader':
      case 'co-leader':
      case 'collaborator':
        return <People {...iconProps} color="var(--color-primary-text)" />;
      case 'danger':
      case 'alert':
      case 'incident':
        return <Danger {...iconProps} color="var(--color-danger-text)" />;
      default:
        return <InfoCircle {...iconProps} color="var(--color-warning-text)" />;
    }
  };

  // Cloche et avatar. Le dashboard peut les déplacer en haut du panneau
  // d'activité (`actionsContainer`), qui monte alors jusqu'en haut de l'écran.
  const blocDroite = (
      <div className="header-right">


        <div className="notification-dropdown">
          <button
            className="btn btn-icon notification-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notifications"
          >
            <IconeCloche />
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount}</span>
            )}
          </button>

          {showNotifications && (
            <div className="notification-menu">
              <div className="notification-menu-header">
                <h3>Notifications</h3>
                {unreadCount > 0 ? (
                  <button type="button" className="notification-read-all" onClick={handleMarkAllRead}>
                    Tout marquer comme lu
                  </button>
                ) : (
                  <span className="notification-count">Tout est lu</span>
                )}
              </div>

              <div className="notification-menu-divider"></div>

              <div className="notification-list">
                {isLoadingNotifications ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    Chargement...
                  </div>
                ) : notifications.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    Aucune notification
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`notification-item ${!notification.read ? 'unread' : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="notification-icon">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="notification-content">
                        <div className="notification-title">{notification.title || 'Notification'}</div>
                        <div className="notification-message">
                          {formatNotificationMessage(notification.message)}
                          {notification.incident_title && (
                            <span className="notification-incident-tag" style={{ display: 'block', fontSize: 'var(--font-size-micro)', color: 'var(--color-text-secondary)', marginTop: '2px', fontStyle: 'italic' }}>
                              Incident : {notification.incident_title}
                            </span>
                          )}
                        </div>
                        <div className="notification-time">{getRelativeTime(notification.created_at)}</div>
                      </div>
                      {!notification.read && <div className="notification-dot"></div>}
                    </div>
                  ))
                )}
              </div>

              {nextNotificationsUrl && (
                <>
                  <div className="notification-menu-divider"></div>
                  <button
                    className="notification-menu-footer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadMoreNotifications();
                    }}
                    disabled={isLoadingMoreNotifications}
                    style={{ width: '100%' }}
                  >
                    {isLoadingMoreNotifications ? 'Chargement...' : 'Charger plus'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {currentUser && (
          <div className="profile-dropdown">
            <button
              className="header-profile"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              aria-label="Menu profil"
            >
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt="Logo"
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <>
                  <div style={{ color: "var(--color-surface)", fontWeight: "bold" }}>
                    {initialesUtilisateur(currentUser)}
                  </div>

                  <div className="header-profile-fallback" >
                    <User size={18} variant="Bold" style={{ fill: "var(--color-surface)" }} />
                  </div>
                </>
              )}
            </button>

            {showProfileMenu && (
              <div className="profile-menu">
                <div className="profile-menu-header">
                  <div className="profile-name">{currentUser?.first_name || 'Utilisateur'}</div>
                  <div className="profile-email">{currentUser?.email}</div>
                  {currentUser?.organisation_name && (
                    <div className="profile-org" style={{ fontSize: 'var(--font-size-body-small)', color: 'var(--color-primary-text)', marginTop: '4px', fontWeight: '500' }}>
                      {currentUser.organisation_name}
                    </div>
                  )}
                </div>

                <div className="profile-menu-items">
                  <button
                    className="profile-menu-item"
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate('/profile');
                    }}
                  >
                    <IconeProfil />
                    <span>Mon profil</span>
                  </button>

                  <button
                    className="profile-menu-item"
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate('/trash');
                    }}
                  >
                    <IconeCorbeille />
                    <span>Corbeille</span>
                  </button>



                  <button
                    className="profile-menu-item logout"
                    onClick={() => {
                      setShowProfileMenu(false);
                      authService.logout();
                      navigate('/login');
                    }}
                  >
                    <IconeSortie />
                    <span>Se déconnecter</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
  );

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          className={`menu-toggle btn btn-icon ${onToggleCollapse ? 'menu-toggle-desktop' : ''}`}
          onClick={() => {
            // Sur desktop, le bouton réduit la navigation ; sur mobile il l'ouvre.
            if (onToggleCollapse && window.innerWidth >= 1024) onToggleCollapse();
            else onMenuToggle?.();
          }}
          aria-label="Afficher ou réduire la navigation"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 12h18M3 6h18M3 18h18" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <HeaderSearch />
      </div>

      {actionsContainer ? createPortal(blocDroite, actionsContainer) : blocDroite}
    </header>
  );
};

export default Header;
