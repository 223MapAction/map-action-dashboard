import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { User, Trash, LogoutCurve, ArrowDown2, Notification, Danger, People, InfoCircle } from 'iconsax-react';
import notifSound from '../../assets/notif.mp3';
import { authService } from '../../pages/auth/services/authService';
import { getNotifications, markNotificationAsRead } from './service/notification_service';
import { BlurryImage } from '../atoms/BlurryImage';
import { API_URL_BASE } from '../../config/api_url_base';
import './header.css';
import { HeaderSearch } from './HeaderSearch';
import { logger } from '../../utils/logger';

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
  const [nextNotificationsUrl, setNextNotificationsUrl] = useState(null);
  const [isLoadingMoreNotifications, setIsLoadingMoreNotifications] = useState(false);
  const { data: notificationsData, isLoading: isLoadingNotifications, mutate: mutateNotifications } = useSWR(
    '/MapApi/notifications/?page_size=15',
    () => getNotifications(15),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    
    }
  );

  const notifications = useMemo(() => {
    return notificationsData?.results || (Array.isArray(notificationsData) ? notificationsData : []);
  }, [notificationsData]);

  useEffect(() => {
  }, [notifications, notificationsData]);

  // Synchroniser nextUrl quand les données SWR changent
  useEffect(() => {
    if (notificationsData && notificationsData.next !== undefined) {
      setNextNotificationsUrl(notificationsData.next);
    }
  }, [notificationsData]);

  // Écoute temps réel des notifications via WebSockets
  useEffect(() => {
    const wsBaseUrl = window.location.protocol === 'https:' || API_URL_BASE.startsWith('https')
      ? API_URL_BASE.replace(/^https/, 'wss')
      : API_URL_BASE.replace(/^http/, 'ws');
    const token = authService.getAccessToken();
    const query = token ? `?token=${token}` : '';

    let socket = null;
    let isCleanedUp = false;
    let delay = 3000;

    const shouldRetry = (code) => ![1000, 4001, 4003, 4004].includes(code);

    const connect = () => {
      if (isCleanedUp) return;
      socket = new WebSocket(`${wsBaseUrl}/ws/notifications/${query}`);

      socket.onopen = () => {
        delay = 3000;
      };
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'notification' || data.message) {
            // Jouer le son de notification
            try {
              const audio = new Audio(notifSound);
              audio.play().catch(() => {});
            } catch {
              // Le son de notification est un confort, pas une fonctionnalite :
              // le navigateur peut le refuser tant que l'utilisateur n'a pas
              // interagi avec la page. Echouer ici ne doit rien interrompre.
            }

            const newNotification = {
              id: data.id || `notif-${Date.now()}`,
              title: data.title,
              type: data.type,
              incident_title: data.incident_title,
              message: data.message,
              read: data.read ?? false,
              link: data.link,
              created_at: data.created_at || new Date().toISOString()
            };

            mutateNotifications(prev => {
              const list = prev?.results || (Array.isArray(prev) ? prev : []);
              if (list.some(n => n.id === newNotification.id)) return prev;
              const sorted = [newNotification, ...list];
              const currentUnreadCount = prev?.unread_count ?? list.filter(n => !n.read).length;
              const newUnreadCount = !newNotification.read ? currentUnreadCount + 1 : currentUnreadCount;
              return Array.isArray(prev) ? sorted : { ...prev, results: sorted, unread_count: newUnreadCount };
            }, { revalidate: false });
          }
        } catch (e) {
          logger.error('[WS-Notifications] Erreur parsing message:', e);
        }
      };
      socket.onerror = () => socket.close();
      socket.onclose = (e) => {
        if (!isCleanedUp && shouldRetry(e.code)) {
          setTimeout(connect, delay);
          delay = Math.min(delay * 2, 30000);
        }
      };
    };

    const handleBeforeUnload = () => {
      isCleanedUp = true;
      if (socket) {
        socket.close(1000, "Page unloading");
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    connect();

    return () => {
      isCleanedUp = true;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (socket) {
        socket.close(1000, "Component unmounting");
      }
    };
  }, [mutateNotifications]);

  const handleLoadMoreNotifications = async () => {
    if (!nextNotificationsUrl || isLoadingMoreNotifications) return;
    try {
      setIsLoadingMoreNotifications(true);
      const data = await getNotifications(nextNotificationsUrl);
      const results = data.results || [];
      
      mutateNotifications(prev => {
        const list = prev?.results || (Array.isArray(prev) ? prev : []);
        const merged = [...list];
        results.forEach(notif => {
          if (!merged.some(m => m.id === notif.id)) {
            merged.push(notif);
          }
        });
        const sorted = merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return Array.isArray(prev) ? sorted : { ...prev, results: sorted, next: data.next || null };
      }, { revalidate: false });

      setNextNotificationsUrl(data.next || null);
    } catch (error) {
      logger.error('[HEADER] Erreur chargement notifications supplémentaires:', error);
    } finally {
      setIsLoadingMoreNotifications(false);
    }
  };

  // Utiliser unread_count de l'API si disponible, sinon calculer localement
  const unreadCount = notificationsData?.unread_count ?? notifications.filter(n => !n.read).length;

  // Formater le temps relatif
  const getRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins}min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    return `Il y a ${diffDays}j`;
  };

  const formatNotificationMessage = (msg) => {
    if (!msg) return '';
    return msg.replace(/L'organisation None/gi, "Une organisation");
  };

  // Marquer une notification comme lue et naviguer
  const handleNotificationClick = async (notification) => {
    let targetUrl = null;
    if (notification.link) {
      if (typeof notification.link === 'object') {
        targetUrl = notification.link.url;
      } else if (typeof notification.link === 'string') {
        try {
          const parsed = JSON.parse(notification.link);
          targetUrl = parsed.url;
        } catch {
          if (notification.link.startsWith('/')) {
            targetUrl = notification.link;
          }
        }
      }
    }

    if (targetUrl) {
      navigate(targetUrl);
      setShowNotifications(false);
    }

    if (!notification.read) {
      try {
        await markNotificationAsRead(notification.id);
        mutateNotifications(prev => {
          const list = prev?.results || (Array.isArray(prev) ? prev : []);
          const updated = list.map(n => n.id === notification.id ? { ...n, read: true } : n);
          const currentUnreadCount = prev?.unread_count ?? list.filter(n => !n.read).length;
          const newUnreadCount = Math.max(0, currentUnreadCount - 1);
          return Array.isArray(prev) ? updated : { ...prev, results: updated, unread_count: newUnreadCount };
        }, { revalidate: false });
      } catch (error) {
        logger.error('[HEADER] Erreur marquage notification:', error);
      }
    }
  };

  // Pas d'endpoint groupé : on marque chaque notification non lue, puis on
  // met le cache à jour d'un coup.
  const handleMarkAllRead = async (e) => {
    e.stopPropagation();
    const nonLues = notifications.filter((n) => !n.read);
    try {
      await Promise.all(nonLues.map((n) => markNotificationAsRead(n.id)));
    } catch (error) {
      logger.error('[HEADER] Erreur marquage de toutes les notifications:', error);
    }
    mutateNotifications((prev) => {
      const list = prev?.results || (Array.isArray(prev) ? prev : []);
      const updated = list.map((n) => ({ ...n, read: true }));
      return Array.isArray(prev) ? updated : { ...prev, results: updated, unread_count: 0 };
    }, { revalidate: false });
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
