import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import notifSound from '../../assets/notif.mp3';
import { authService } from '../../pages/auth/services/authService';
import { getNotifications, markNotificationAsRead } from './service/notification_service';
import { API_URL_BASE } from '../../config/api_url_base';
import { logger } from '../../utils/logger';

// Formater le temps relatif
export const getRelativeTime = (dateString) => {
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

export const formatNotificationMessage = (msg) => {
  if (!msg) return '';
  return msg.replace(/L'organisation None/gi, "Une organisation");
};

// Adresse vers laquelle mène une notification, si elle en a une
export const cibleNotification = (notification) => {
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
  return targetUrl;
};

/**
 * Notifications de l'utilisateur : cache SWR partagé, écoute temps réel,
 * pagination et marquage. Utilisé par l'en-tête et par l'écran mobile.
 */
export const useNotifications = () => {
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

  const marquerLue = async (notification) => {
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
    e?.stopPropagation();
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

  return {
    notifications,
    isLoadingNotifications,
    nextNotificationsUrl,
    isLoadingMoreNotifications,
    handleLoadMoreNotifications,
    unreadCount,
    marquerLue,
    handleMarkAllRead,
  };
};

export default useNotifications;
