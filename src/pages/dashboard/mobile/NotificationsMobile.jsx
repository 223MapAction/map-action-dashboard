import { useNavigate } from 'react-router-dom';
import { useFeuille } from './useFeuille';
import { getRelativeTime, formatNotificationMessage, cibleNotification } from '../../../components/layout/useNotifications';

const IconeNotification = ({ type }) => {
  if (['danger', 'alert', 'incident'].includes(type)) {
    return (
      <span className="dm-notif-icone dm-notif-danger">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3.5 2.5 20h19L12 3.5z" /><path d="M12 10v4M12 17v.5" /></svg>
      </span>
    );
  }
  return (
    <span className="dm-notif-icone">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 0 1 0 7" /></svg>
    </span>
  );
};

/** Écran 7 : les notifications, poussées depuis la carte. */
export const NotificationsMobile = ({ donnees, onRetour }) => {
  const navigate = useNavigate();
  const { fermer, classe } = useFeuille(onRetour);
  const {
    notifications,
    isLoadingNotifications,
    nextNotificationsUrl,
    isLoadingMoreNotifications,
    handleLoadMoreNotifications,
    unreadCount,
    marquerLue,
    handleMarkAllRead,
  } = donnees;

  const ouvrir = (notification) => {
    marquerLue(notification);
    const cible = cibleNotification(notification);
    if (cible) navigate(cible);
  };

  return (
    <div className={`dm-ecran dm-ecran-notifications dm-feuille ${classe}`}>
      <header className="dm-notif-entete">
        <button type="button" className="dm-retour" onClick={fermer}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          Carte
        </button>
        {unreadCount > 0 && <button type="button" className="dm-lire-tout" onClick={handleMarkAllRead}>Tout marquer comme lu</button>}
      </header>
      <h1 className="dm-notif-titre">Notifications</h1>

      <div className="dm-ecran-corps">
        {isLoadingNotifications ? (
          <p className="dm-vide">Chargement…</p>
        ) : notifications.length === 0 ? (
          <p className="dm-vide">Aucune notification</p>
        ) : (
          <ul className="dm-liste">
            {notifications.map((n) => (
              <li key={n.id}>
                <button type="button" className={`dm-notif ${n.read ? '' : 'is-non-lue'}`} onClick={() => ouvrir(n)}>
                  <IconeNotification type={n.type} />
                  <span className="dm-notif-texte">
                    <span className="dm-notif-ligne">
                      <b>{n.title || 'Notification'}</b>
                      <small>{getRelativeTime(n.created_at)}</small>
                    </span>
                    <span>{formatNotificationMessage(n.message)}</span>
                    {n.incident_title && <small>Incident : {n.incident_title}</small>}
                  </span>
                  {!n.read && <i className="dm-notif-point" aria-label="Non lue" />}
                </button>
              </li>
            ))}
          </ul>
        )}
        {nextNotificationsUrl && (
          <button type="button" className="dm-plus" onClick={handleLoadMoreNotifications} disabled={isLoadingMoreNotifications}>
            {isLoadingMoreNotifications ? 'Chargement…' : 'Charger plus'}
          </button>
        )}
      </div>
    </div>
  );
};

export default NotificationsMobile;
