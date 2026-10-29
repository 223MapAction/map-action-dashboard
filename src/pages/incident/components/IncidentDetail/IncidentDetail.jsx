import React, { useState, useRef, useEffect } from 'react';
import { IS_MAPBOX } from '../../../../config/mapEngine';
import { MapDetailViewMapLibre } from './MapDetailViewMapLibre';
import { MapDetailViewMapbox } from './MapDetailViewMapbox';
import { activerGestesCooperatifs } from '../../../../utils/gestesCarte';
import { OSM_STYLE, MAPBOX_SATELLITE_STYLE, HAS_SATELLITE_STYLE as HAS_MAPBOX_SATELLITE } from '../../../../config/mapStyles';
import useSWR from 'swr';
import {
  ShimmerThumbnail,
  ShimmerTitle,
  ShimmerText,
  ShimmerCircularImage,
  ShimmerButton
} from 'react-shimmer-effects';
import { takeInChargeIncidentService, getIncidentService, getIncidentPredictionService } from '../../service/incident_service';
import { requestCollaborationService, getCollaborationsService } from '../../service/collaboration_service';
import { getIncidentChatHistoryService, sendIncidentChatMessageService } from '../../service/chat_service';
import { authService } from '../../../auth/services/authService';
import { suggestCollaborationPartnerService } from '../../../collaboration-detail/service/collab_detail_service';
import {
  ArrowLeft2,
  Location,
  Calendar,
  Category2,
  TickCircle,
  Briefcase,
  VideoSquare,
  Map as MapIcon,
  UserAdd,
  CloseCircle,
  Crown1,
  People,
  Eye,
  EyeSlash,
  Add,
  SearchNormal1,
  Buildings2,
  MagicStar,
  Play,
  Pause,
  VolumeHigh,
  Danger,
  SearchStatus,
  ClipboardTick,
  ShieldTick,
  Camera,
  Warning2,
  Ruler,
  Message,
  Send2,
  InfoCircle
} from 'iconsax-react';
import './incident-detail.css';
import { IncidentDetailSkeleton } from './SqueletteDetail';
import { ROLE_OPTIONS, ORG_ROLE_OPTIONS } from './roles';
import { useLecteurAudio } from './useLecteurAudio';
import {
  getStatusBadge, getModeBadge, getUserRoleBadge,
  getRoleLabel, getStatusLabel,
} from './badges';
import './dark-dashboard.css';
import { getOrganisationsService, formatOrganisation } from '../../../organisations/service/organisation_service';
import { IncidentDetailContext } from './IncidentDetailContext';
import { VueDetail } from './VueDetail';
import { InviteOrgModal } from './modal/InviteOrgModal';
import { NotFound } from '../../../not-found';
import { BlurryImage } from '../../../../components/atoms/BlurryImage';


import { ImageViewer } from '../../../../components/molecules/ImageViewer';
import { BadgeGravite } from '../../../../components/atoms/BadgeGravite';
import { logger } from '../../../../utils/logger';
const formatMessageTime = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

// Étapes du statut d'un incident (selon l'API)
const INCIDENT_STATUS_STEPS = [
  { id: 'declared', label: 'Déclaré', icon: Danger },
  { id: 'taken_into_account', label: 'Pris en compte', icon: ClipboardTick },
  { id: 'resolved', label: 'Résolu', icon: ShieldTick }
];




export const IncidentDetail = ({ incident, onBack, isLoading = false }) => {
  // Voir utils/gestesCarte : sur ecran tactile, un doigt fait defiler la fiche
  // et deux doigts pilotent la carte. On passe par la reference et non par
  // `onLoad`, qui ne se declenche pas de facon fiable avec react-map-gl v8.
  const carteDetailRef = useRef(null);
  useEffect(() => {
    let annule = false;
    const essayer = () => {
      if (annule) return;
      const carte = carteDetailRef.current?.getMap?.();
      if (carte) { activerGestesCooperatifs(carte); return; }
      setTimeout(essayer, 300);
    };
    essayer();
    return () => { annule = true; };
  }, []);

  // Utiliser useSWR pour rafraîchir les données automatiquement
  const { data: swrIncident, mutate, isLoading: isSwrLoading, error: swrError } = useSWR(
    incident?.id ? `/incidents/${incident.id}` : null,
    () => getIncidentService(incident.id),
    {
      fallbackData: incident,
    }
  );

  const { data: collaborations, mutate: mutateCollaborations } = useSWR(
    'collaborations',
    () => getCollaborationsService(),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false
    }
  );

  const isCurrentlyLoading = isLoading || isSwrLoading || (incident?.id && !swrIncident?.title);

  // Récupérer la prédiction de l'incident
  const { data: prediction, isLoading: isLoadingPrediction, error: predictionError } = useSWR(
    incident?.id ? `/Incidentprediction/${incident.id}` : null,
    () => getIncidentPredictionService(incident.id),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      onError: (err) => {
        // Un 404 est normal : la prédiction n'est pas encore calculée.
        logger.error('[IncidentDetail] Erreur chargement prédiction:', err);
      },
      // Ne pas retry indéfiniment en cas d'erreur
      shouldRetryOnError: false,
      // Considérer l'erreur 404 comme une réponse valide (pas de prédiction)
      dedupingInterval: 100
    }
  );

  const pred = (Array.isArray(prediction) && prediction.length > 0) ? prediction[0] : (prediction || null);

  // Utiliser les données de SWR fusionnées avec les props initiales pour conserver les champs déjà mappés (ex: organisation_name)
  const currentIncident = swrIncident ? { ...incident, ...swrIncident } : incident;

  // Récupérer l'ID de l'utilisateur connecté
  const currentUserId = sessionStorage.getItem('user_id');

  const {
    audioRef, isPlaying, setIsPlaying, currentTime, duration,
    togglePlay, onAudioTimeUpdate, onAudioLoaded, onAudioEnded,
    seekAudio, seekAudioClavier,
  } = useLecteurAudio(incident?.id);

  // Valeurs par défaut pour les champs manquants
  const safeIncident = currentIncident ? {
    title: currentIncident.title || 'Incident sans titre',
    badges: currentIncident.badges || [{ label: 'EN COURS', variant: 'in-progress' }],
    image: currentIncident?.image || currentIncident?.photo,
    description: currentIncident.description || 'Aucune description disponible',
    fullDescription: currentIncident.fullDescription || currentIncident.description || 'Aucune description disponible',
    type: currentIncident.type || currentIncident.zone || 'Non spécifié',
    location: currentIncident.location || currentIncident.zone || 'Localisation non spécifiée',
    coordinates: currentIncident.coordinates || (() => {
      const lat = parseFloat(currentIncident.lattitude);
      const lng = parseFloat(currentIncident.longitude);
      // Vérifier que les coordonnées sont des nombres valides
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        return { lat, lng };
      }
      return null;
    })(),
    video: currentIncident.video || null,
    startDate: currentIncident.startDate || currentIncident.created_at ? new Date(currentIncident.created_at).toLocaleDateString('fr-FR') : 'Non spécifié',
    endDate: currentIncident.endDate || 'En cours',
    participantsCount: currentIncident.participantsCount || 0,
    etat: currentIncident.etat || 'declared',
    aiAnalysis: currentIncident.aiAnalysis || {
      text: "Analyse en cours...",
      audio: currentIncident.audio || null
    },
    participants: currentIncident.participants || [],
    extraParticipants: currentIncident.extraParticipants || 0,
    // Déterminer si l'utilisateur connecté est propriétaire de l'incident
    isOwner: currentUserId ? (
      currentIncident.taken_by
        ? (typeof currentIncident.taken_by === 'object'
          ? parseInt(currentIncident.taken_by.id) === parseInt(currentUserId)
          : parseInt(currentIncident.taken_by) === parseInt(currentUserId))
        : false
    ) : false,
    ...currentIncident
  } : null;

  const [joinOpen, setJoinOpen] = useState(false);
  const [joinClosing, setJoinClosing] = useState(false);
  const [joinShowing, setJoinShowing] = useState(false);
  const [motif, setMotif] = useState('');
  const [invitedOrgs, setInvitedOrgs] = useState([]);
  const [orgSearch, setOrgSearch] = useState('');
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [selfRole, setSelfRole] = useState('contributeur');
  const [isInvolvePrivate, setIsInvolvePrivate] = useState(false);
  const [workMode, setWorkMode] = useState('collaboration');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertType, setAlertType] = useState('success');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatError, setChatError] = useState(null);
  const [detailMapStyle, setDetailMapStyle] = useState('streets'); // 'satellite' | 'streets'
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [toast, setToast] = useState(null);
  // Fermeture animée du panneau de chat : on joue l'animation de sortie avant
  // de démonter.
  const [chatClosing, setChatClosing] = useState(false);
  const fermerChat = () => {
    setChatClosing(true);
    setTimeout(() => {
      setChatOpen(false);
      setChatClosing(false);
    }, 220);
  };
  const basculerChat = () => (chatOpen ? fermerChat() : setChatOpen(true));
  const afficherToast = (texte) => setToast({ texte, n: Date.now() });
  const chatMessagesEndRef = useRef(null);

  const [messages, setMessages] = useState([
    { id: 1, sender: 'bot', text: 'Bonjour ! Je suis l\'assistant IA Vision. Comment puis-je vous aider avec cet incident ?' }
  ]);

  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const shouldScrollToBottomRef = useRef(true);

  // SWR pour charger l'historique du chatbot
  const { data: chatHistory, mutate: mutateChatHistory } = useSWR(
    chatOpen && safeIncident?.id ? `chat-history-${safeIncident.id}-initial` : null,
    () => getIncidentChatHistoryService(safeIncident.id, 4),
    { revalidateOnFocus: false }
  );

  // Synchroniser l'historique de chat avec le state messages
  useEffect(() => {
    if (chatHistory?.history) {
      const formattedHistory = chatHistory.history.map((msg, index) => ({
        id: msg.id || msg.created_at || index,
        sender: msg.role === 'assistant' ? 'bot' : 'user',
        text: msg.content,
        time: formatMessageTime(msg.created_at)
      }));
      setHasMore(chatHistory.has_more || false);
      if (formattedHistory.length > 0) {
        setMessages(formattedHistory);
        shouldScrollToBottomRef.current = true;
      } else {
        setMessages([
          { id: 1, sender: 'bot', text: 'Bonjour ! Je suis l\'assistant IA Vision. Comment puis-je vous aider avec cet incident ?' }
        ]);
      }
    }
  }, [chatHistory]);

  const loadMoreMessages = async () => {
    if (!hasMore || isLoadingMore || !safeIncident?.id || messages.length === 0) return;

    setIsLoadingMore(true);
    try {
      const oldestMessageId = messages[0]?.id;
      if (!oldestMessageId) return;

      const data = await getIncidentChatHistoryService(safeIncident.id, 12, oldestMessageId);

      if (data?.history && data.history.length > 0) {
        const formattedOlder = data.history.map((msg, index) => ({
          id: msg.id || msg.created_at || `old-${index}`,
          sender: msg.role === 'assistant' ? 'bot' : 'user',
          text: msg.content,
          time: formatMessageTime(msg.created_at)
        }));

        setMessages((prev) => [...formattedOlder, ...prev]);
        setHasMore(data.has_more || false);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      logger.error('[Chat] Erreur chargement messages anciens:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleScroll = (e) => {
    const container = e.currentTarget;
    if (container.scrollTop === 0 && hasMore && !isLoadingMore) {
      loadMoreMessages();
    }
  };

  // Bloquer le scroll du body quand le chatbot est ouvert
  useEffect(() => {
    if (chatOpen) {
      document.body.style.overflow = 'hidden';
      shouldScrollToBottomRef.current = true;
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [chatOpen]);

  // Défilement automatique vers le bas lors de la réception d'un nouveau message
  useEffect(() => {
    if (chatOpen && shouldScrollToBottomRef.current) {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      shouldScrollToBottomRef.current = false;
    }
  }, [messages, chatOpen, isTyping]);

  useEffect(() => {
    if (isTyping) {
      shouldScrollToBottomRef.current = true;
    }
  }, [isTyping]);

  // Récupérer les organisations avec useSWR uniquement quand le modal est ouvert
  const { data: rawOrganisations, isLoading: isLoadingOrgs } = useSWR(
    joinOpen ? 'organisations' : null,
    getOrganisationsService,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false
    }
  );




  // Formater les organisations pour l'affichage
  const availableOrgs = rawOrganisations ? rawOrganisations?.map(formatOrganisation) : [];


  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const timeoutRef = useRef(null);

  // Gérer le timeout de 1min30
  useEffect(() => {
    if (isCurrentlyLoading && incident) {
      // Démarrer le timer de 90 secondes
      timeoutRef.current = setTimeout(() => {
        setLoadingTimeout(true);
      }, 90000); // 90 secondes
    } else {
      // Réinitialiser le timeout si le chargement est terminé
      setLoadingTimeout(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isCurrentlyLoading, incident]);

  // Fonction pour recharger les données
  const handleRefresh = () => {
    setLoadingTimeout(false);
    mutate();
  };

  const handleSendMessage = async (e, texteImpose) => {
    e?.preventDefault?.();
    const brut = typeof texteImpose === 'string' ? texteImpose : chatMessage;
    if (!brut.trim()) return;
    if (!safeIncident?.id) return;

    const userText = brut.trim();
    setChatMessage('');
    setChatError(null);

    // Ajouter le message utilisateur localement pour la réactivité
    const tempUserId = Date.now();
    setMessages(prev => [...prev, { id: tempUserId, sender: 'user', text: userText, time: formatMessageTime(new Date().toISOString()) }]);
    shouldScrollToBottomRef.current = true;
    setIsTyping(true);

    try {
      const response = await sendIncidentChatMessageService(safeIncident.id, userText);

      // Mettre à jour l'historique avec la réponse de l'API
      if (response?.history) {
        const formattedHistory = response.history.map((msg, index) => ({
          id: msg.id || msg.created_at || index,
          sender: msg.role === 'assistant' ? 'bot' : 'user',
          text: msg.content,
          time: formatMessageTime(msg.created_at)
        }));
        setMessages(formattedHistory);
        setHasMore(response.has_more || false);
        shouldScrollToBottomRef.current = true;
      } else if (response?.message) {
        setMessages(prev => [...prev, { id: Date.now(), sender: 'bot', text: response.message, time: formatMessageTime(new Date().toISOString()) }]);
        shouldScrollToBottomRef.current = true;
      }
      mutateChatHistory();
    } catch (err) {
      logger.error('[Chat] Erreur envoi message:', err);
      const status = err?.response?.status;
      let msg = "Une erreur est survenue lors de l'envoi de votre message.";
      if (status === 400) {
        msg = "La prédiction de l'incident doit être terminée (avec des résultats) pour pouvoir interagir avec l'assistant.";
      } else if (status === 404) {
        msg = "L'incident n'a pas été trouvé.";
      } else if (status === 502) {
        msg = "Le service d'intelligence artificielle est temporairement indisponible, mais votre message a bien été enregistré.";
      } else if (err?.response?.data?.detail) {
        msg = err.response.data.detail;
      } else if (err?.response?.data?.message) {
        msg = err.response.data.message;
      }
      setChatError(msg);
    } finally {
      setIsTyping(false);
    }
  };



  // Bloquer le scroll du body quand le modal est ouvert
  useEffect(() => {
    if (joinOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [joinOpen]);

  // `mode` vient du menu « Agir » : 'interne' (prendre en charge seul) ou
  // 'collaboration' (lancer une collaboration en tant que leader).
  const openJoinModal = (mode) => {
    setJoinClosing(false);
    setJoinOpen(true);
    const isInternal = safeIncident?.take_in_charge_mode === 'internal' || safeIncident?.take_in_charge_mode === 'interne';
    if (safeIncident?.etat === 'declared' && !isInternal && mode === 'interne') {
      setSelfRole('leader');
      setWorkMode('interne');
      setIsInvolvePrivate(true);
    } else if (safeIncident?.etat === 'declared' && !isInternal) {
      setSelfRole('leader');
      setWorkMode('collaboration');
      setIsInvolvePrivate(false);
    } else {
      setSelfRole('contributeur');
      setWorkMode('collaboration');
    }
    setTimeout(() => {
      setJoinShowing(true);
    }, 10);
  };

  const closeJoinModal = () => {
    setJoinShowing(false);
    setJoinClosing(true);
    setTimeout(() => {
      setJoinOpen(false);
      setJoinClosing(false);
      setMotif('');
      setInvitedOrgs([]);
      setOrgSearch('');
      setShowOrgDropdown(false);
      setSelfRole('contributeur');
      setIsInvolvePrivate(false);
      setWorkMode('collaboration');
    }, 300);
  };

  const addInvitedOrg = (org) => {
    if (invitedOrgs.find((o) => o.id === org.id)) return;
    setInvitedOrgs((prev) => [...prev, { ...org, role: 'contributeur' }]);
    setOrgSearch('');
    setShowOrgDropdown(false);
  };

  const removeInvitedOrg = (orgId) => {
    setInvitedOrgs((prev) => prev.filter((o) => o.id !== orgId));
  };

  const updateOrgRole = (orgId, role) => {
    setInvitedOrgs((prev) =>
      prev.map((o) => (o.id === orgId ? { ...o, role } : o))
    );
  };

  const updateOrgComment = (orgId, comment) => {
    setInvitedOrgs((prev) =>
      prev.map((o) => (o.id === orgId ? { ...o, comment } : o))
    );
  };

  const filteredOrgs = availableOrgs.filter(
    (org) =>
      !invitedOrgs.find((o) => o.id === org.id) &&
      org.name.toLowerCase().includes(orgSearch.toLowerCase())
  );


  const handleJoinSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;
    setIsSubmitting(true);
    setAlertMessage(null);

    try {
      // Si l'utilisateur est propriétaire ou a un rôle accepté de contributeur, envoyer les invitations
      if (safeIncident.isOwner || hasAcceptedRole) {
        if (invitedOrgs.length === 0) {
          setAlertType('warning');
          setAlertMessage('Veuillez sélectionner au moins une organisation à inviter.');
          setIsSubmitting(false);
          return;
        }

        let successCount = 0;
        let errorCount = 0;
        let errorMessages = [];

        for (const org of invitedOrgs) {
          try {
            const roleStr = org.role === 'observateur' ? 'observer' : 'contributor';
            const commentStr = org.comment || `Invitation à rejoindre l'incident en tant que ${org.role}`;
            await suggestCollaborationPartnerService(safeIncident.id, {
              incident: safeIncident.id,
              suggested_organisation: org.id,
              suggested_role: roleStr,
              justification: commentStr
            
            });
            successCount++;
          } catch (err) {
            logger.error('Erreur envoi suggestion:', err);
            errorCount++;

            // Récupérer le message d'erreur explicite
            let errorMsg = 'Erreur inconnue';
            const data = err.response?.data;
            if (data) {
              if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
                const msg = data.non_field_errors[0];
                errorMsg = msg.includes('unique set')
                  ? 'Cette organisation a déjà été invitée ou suggérée pour cet incident.'
                  : msg;
              } else if (data.detail) {
                errorMsg = data.detail;
              } else if (data.message) {
                errorMsg = data.message;
              } else if (data.error) {
                errorMsg = data.error;
              } else {
                const keys = Object.keys(data);
                if (keys.length > 0) {
                  const val = data[keys[0]];
                  const msg = Array.isArray(val) ? val[0] : String(val);
                  errorMsg = msg.includes('unique set')
                    ? 'Cette organisation a déjà été invitée ou suggérée pour cet incident.'
                    : msg;
                } else {
                  errorMsg = err.message || 'Erreur inconnue';
                }
              }
            } else {
              errorMsg = err.message || 'Erreur inconnue';
            }

            errorMessages.push(errorMsg);
            logger.error('Message d\'erreur:', errorMsg);
          }
        }

        if (successCount > 0) {
          setAlertType('success');
          setAlertMessage(`${successCount} invitation${successCount > 1 ? 's' : ''} envoyée${successCount > 1 ? 's' : ''} avec succès !`);

          // Réinitialiser la liste des organisations invitées
          setInvitedOrgs([]);

          // Rafraîchir les données
          await mutate();

          // Fermer le modal après 2 secondes si tout s'est bien passé
          if (errorCount === 0) {
            setTimeout(() => {
              closeJoinModal();
            }, 2000);
          }
        }

        if (errorCount > 0) {
          setAlertType(successCount > 0 ? 'warning' : 'danger');

          // Afficher le message d'erreur explicite
          const errorDetail = errorMessages.length > 0 ? errorMessages[0] : 'Erreur inconnue';

          setAlertMessage(
            successCount > 0
              ? `${successCount} invitation${successCount > 1 ? 's' : ''} envoyée${successCount > 1 ? 's' : ''}, mais ${errorCount} erreur${errorCount > 1 ? 's' : ''}: ${errorDetail}`
              : `Erreur lors de l'envoi des invitations: ${errorDetail}`
          );
        }

        // Réactiver le bouton
        setIsSubmitting(false);
        return;
      }

      // Vérifier si l'incident est déjà pris en charge
      const incidentEtat = safeIncident?.etat;
      const isNotTakenInCharge = incidentEtat === 'declared';

      if (isNotTakenInCharge && selfRole === 'leader') {
        // Si l'incident n'est pas pris en charge et que le rôle choisi est leader, prendre en charge (devenir leader)
        const result = await takeInChargeIncidentService(safeIncident.id, {
          mode: workMode === 'interne' ? 'internal' : 'collaborative',
          role: 'leader'
        });
        if (result.status == "success") {
          // En collaboration, les organisations choisies dans la même fenêtre
          // reçoivent leur invitation juste après la prise en charge.
          let invitations = 0;
          if (workMode !== 'interne' && invitedOrgs.length > 0) {
            for (const org of invitedOrgs) {
              try {
                await suggestCollaborationPartnerService(safeIncident.id, {
                  incident: safeIncident.id,
                  suggested_organisation: org.id,
                  suggested_role: org.role === 'observateur' ? 'observer' : 'contributor',
                  justification: org.comment || motif || `Invitation à rejoindre l'incident en tant que ${org.role}`,
                });
                invitations += 1;
              } catch (err) {
                logger.error('Erreur envoi invitation après prise en charge:', err);
              }
            }
          }
          setAlertType('success');
          setAlertMessage(
            invitations > 0
              ? `Vous êtes maintenant le leader de cet incident. ${invitations} invitation${invitations > 1 ? 's envoyées' : ' envoyée'}.`
              : 'Vous êtes maintenant le leader de cet incident !'
          );

          // Rafraîchir les données avec useSWR
          await mutate();
        } else {
          setAlertType('danger');
          setAlertMessage('Erreur lors de la prise en charge de l\'incident');
        }

        // Fermer le modal après 1.2 secondes
        setTimeout(() => {
          closeJoinModal();
          setIsSubmitting(false);
        }, 1200);
      } else {
        // Si l'incident est déjà pris en charge, OU s'il n'est pas pris en charge mais que l'utilisateur choisit d'être contributeur ou observateur
        const collaborationData = {
          incident: safeIncident.id,
          role: selfRole === 'contributeur' ? 'contributor' : selfRole === 'leader' ? 'leader' : 'observer',
          motivation: motif,
          user: currentUserId ? parseInt(currentUserId) : null
        };

        await requestCollaborationService(collaborationData);
        await mutate();
        mutateCollaborations();
        setAlertType('success');
        setAlertMessage(
          isNotTakenInCharge
            ? 'Votre demande de collaboration a été envoyée !'
            : 'Votre demande a été envoyée au leader de l\'incident !'
        );

        // Fermer le modal après 1.2 secondes
        setTimeout(() => {
          closeJoinModal();
          setIsSubmitting(false);
        }, 1200);
      }
    } catch (error) {
      logger.error('Erreur lors de la soumission:', error);

      // Gérer les erreurs spécifiques
      setAlertType('danger');
      if (error.response?.status === 400) {
        setAlertMessage(error.response?.data?.message || 'Erreur : Incident déjà pris en charge ou données invalides');
      } else if (error.response?.status === 403) {
        setAlertMessage('Vous n\'avez pas la permission d\'effectuer cette action');
      } else if (error.response?.status === 404) {
        setAlertMessage('Incident non trouvé');
      } else {
        setAlertMessage('Une erreur est survenue. Veuillez réessayer.');
      }
      setIsSubmitting(false);
    }
  };

  if (isCurrentlyLoading) {
    // Si le timeout est atteint, afficher le bouton de rechargement
    if (loadingTimeout) {
      return (
        <section className="project-detail empty">
          <div className="project-detail-empty">
            <Danger size={48} variant="Bold" color="var(--color-warning)" />
            <h3 style={{ marginTop: 'var(--spacing-4)', marginBottom: 'var(--spacing-2)', color: 'var(--color-text-primary)' }}>
              Chargement trop long
            </h3>
            <p style={{ marginBottom: 'var(--spacing-5)', color: 'var(--color-text-secondary)' }}>
              Les données prennent plus de temps que prévu à se charger.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={handleRefresh}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-2)',
                padding: 'var(--spacing-3) var(--spacing-5)',
                fontSize: 'var(--font-size-body)',
                fontWeight: 'var(--font-weight-medium)',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-surface)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <SearchStatus size={20} variant="Bold" />
              Actualiser la demande
            </button>
          </div>
        </section>
      );
    }
    return <IncidentDetailSkeleton />;
  }

  if (swrError?.response?.status === 404) {
    return (
      <NotFound
        message="Désolé, l'incident demandé n'existe pas, a été supprimé ou vous n'avez pas l'autorisation d'y accéder."
      />
    );
  }

  if (!incident) {
    return (
      <section className="project-detail empty">
        <div className="project-detail-empty">
          <Briefcase size={48} variant="Linear" color="var(--color-text-muted)" />
          <p>Sélectionnez un signalement dans la liste pour voir ses détails</p>
        </div>
      </section>
    );
  }


  const currentStatus = getStatusBadge(safeIncident);
  const modeBadge = getModeBadge(safeIncident);


  const userRoleBadge = getUserRoleBadge(safeIncident);
  const userRoleVal = safeIncident?.role || safeIncident?.userRole;
  const hasParticipantRole = userRoleVal && (
    userRoleVal.toLowerCase() === 'observer' ||
    userRoleVal.toLowerCase() === 'observateur' ||
    userRoleVal.toLowerCase() === 'contributor' ||
    userRoleVal.toLowerCase() === 'contributeur'
  );

  const userObj = authService.getCurrentUser();
  const myOrgId = userObj?.organisation_member;
  const myOrgName = userObj?.organisation_name || 'Mon Organisation';

  const getTakingOrg = (inc) => {
    if (!inc?.taken_by_organisation && !inc?.taken_by) return null;

    let isMe = false;
    let name = '';

    const takenOrgId = inc?.taken_by_organisation?.id;
    const takenOrgName = inc?.taken_by_organisation?.name;

    if (myOrgId && takenOrgId && String(takenOrgId) === String(myOrgId)) {
      isMe = true;
    }

    if (isMe) {
      name = myOrgName;
    } else {
      name = takenOrgName || inc?.taken_by_name || '';
    }

    return { isMe, name };
  };

  const takingOrg = getTakingOrg(safeIncident);

  const isCollaborativeMode = safeIncident?.take_in_charge_mode === 'collaborative' || safeIncident?.take_in_charge_mode === 'collaboratif';

  const collabList = Array.isArray(collaborations)
    ? collaborations
    : Array.isArray(collaborations?.results)
      ? collaborations.results
      : [];
  const collabRequest = collabList.find(c => c.incident === safeIncident?.id);
  const hasPendingRequest = collabRequest && collabRequest.status?.toLowerCase() === 'pending';

  // Vérifier si l'utilisateur a une demande de collaboration acceptée
  const hasAcceptedRole = collabRequest && (collabRequest.status?.toLowerCase() === 'accepted' || collabRequest.status?.toLowerCase() === 'in-progress');

  const showInvolvementButton = (
    safeIncident?.etat !== 'resolved' && (
      !safeIncident?.take_in_charge_mode ||
      safeIncident?.etat === 'declared' ||
      (takingOrg && !takingOrg.isMe && !hasParticipantRole) ||
      (isCollaborativeMode && takingOrg?.isMe) ||
      (hasAcceptedRole && isCollaborativeMode)
    )
  );


  const contextValue = {
    joinOpen,
    joinClosing,
    joinShowing,
    closeJoinModal,
    safeIncident,
    handleJoinSubmit,
    alertMessage,
    alertType,
    setAlertMessage,
    motif,
    setMotif,
    selfRole,
    setSelfRole,
    orgSearch,
    setOrgSearch,
    showOrgDropdown,
    setShowOrgDropdown,
    isLoadingOrgs,
    filteredOrgs,
    availableOrgs,
    addInvitedOrg,
    invitedOrgs,
    removeInvitedOrg,
    updateOrgRole,
    updateOrgComment,
    isSubmitting,
    ROLE_OPTIONS,
    ORG_ROLE_OPTIONS,
    isInvolvePrivate,
    setIsInvolvePrivate,
    workMode,
    setWorkMode,
    takingOrg,
    hasAcceptedRole
  };

  return (
    <IncidentDetailContext.Provider value={contextValue}>
      <section className="project-detail" style={{ backgroundColor: 'var(--color-background)', minHeight: '100vh', padding: '0' }}>
        <VueDetail
          safeIncident={safeIncident}
          pred={pred}
          isLoadingPrediction={isLoadingPrediction}
          predictionError={predictionError}
          etapes={INCIDENT_STATUS_STEPS}
          currentStatus={currentStatus}
          modeBadge={modeBadge}
          userRoleBadge={userRoleBadge}
          collabRequest={collabRequest}
          getRoleLabel={getRoleLabel}
          getStatusLabel={getStatusLabel}
          showInvolvementButton={showInvolvementButton}
          hasPendingRequest={hasPendingRequest}
          hasAcceptedRole={hasAcceptedRole}
          openJoinModal={openJoinModal}
          onBack={onBack}
          takingOrg={takingOrg}
          audioRef={audioRef}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          currentTime={currentTime}
          duration={duration}
          togglePlay={togglePlay}
          onAudioTimeUpdate={onAudioTimeUpdate}
          onAudioLoaded={onAudioLoaded}
          onAudioEnded={onAudioEnded}
          seekAudio={seekAudio}
          seekAudioClavier={seekAudioClavier}
          carteDetailRef={carteDetailRef}
          detailMapStyle={detailMapStyle}
          setDetailMapStyle={setDetailMapStyle}
          ouvrirImage={() => setIsImageModalOpen(true)}
          onToast={afficherToast}
        />
        {toast && <div key={toast.n} className="vd-toast" role="status">{toast.texte}</div>}

        {/* Assistant IA : bouton flottant + panneau */}
        <button
          type="button"
          className={`vd-fab ${chatOpen && !chatClosing ? 'is-open' : ''}`}
          onClick={basculerChat}
          aria-label={chatOpen ? "Fermer l'assistant IA" : "Ouvrir l'assistant IA"}
          aria-expanded={chatOpen && !chatClosing}
        >
          <span className="vd-fab-ic vd-fab-msg"><Message size={26} variant="Bold" color="currentColor" /></span>
          <span className="vd-fab-ic vd-fab-x"><CloseCircle size={26} variant="Bold" color="currentColor" /></span>
          {pred && !chatOpen && <span className="vd-fab-dot" aria-hidden="true" />}
        </button>

        {chatOpen && (
          <section className={`vd-chat ${chatClosing ? 'is-closing' : ''}`} aria-label="Assistant IA Map Action">
            <header className="vd-chat-head">
              <span className="vd-chat-ai"><MagicStar size={18} variant="Bold" color="currentColor" /></span>
              <div>
                <b>Assistant IA Map Action</b>
                <small>Répond à partir de l'analyse de ce signalement</small>
              </div>
              <button type="button" className="vd-chat-x" onClick={fermerChat} aria-label="Fermer l'assistant">
                <CloseCircle size={20} variant="Linear" color="currentColor" />
              </button>
            </header>

            {isLoadingPrediction ? (
              <div className="vd-chat-state">
                <div className="vd-chat-typing" aria-label="Chargement"><span /><span /><span /></div>
                <p>Chargement de l'analyse…</p>
              </div>
            ) : !pred ? (
              <div className="vd-chat-state">
                <span className="vd-chat-state-ic"><Warning2 size={28} variant="Bold" color="currentColor" /></span>
                <b>Assistant indisponible</b>
                <p>L'analyse IA de ce signalement n'est pas encore prête. L'assistant s'activera dès qu'elle sera terminée.</p>
              </div>
            ) : (
              <>
                <div className="vd-chat-ctx">
                  <InfoCircle size={15} color="currentColor" />
                  <span>
                    Contexte : {safeIncident.zone || 'signalement'}
                    {pred.global_impact_score != null && ` · score ${String(pred.global_impact_score).replace('.', ',')}`}
                    {pred.total_population_exposed != null && ` · ${pred.total_population_exposed} personnes exposées`}
                  </span>
                </div>

                <div className="vd-chat-msgs" onScroll={handleScroll}>
                  {isLoadingMore && (
                    <div className="vd-chat-more"><div className="vd-chat-typing"><span /><span /><span /></div></div>
                  )}
                  {messages.map((msg, idx) => (
                    <div key={msg.id || idx} className={`vd-bub vd-bub-${msg.sender === 'user' ? 'me' : 'bot'}`}>
                      {msg.text}
                      {msg.time && <time>{msg.time}</time>}
                    </div>
                  ))}
                  {isTyping && (
                    <div className="vd-bub vd-bub-bot vd-bub-typing" aria-label="L'assistant écrit">
                      <div className="vd-chat-typing"><span /><span /><span /></div>
                    </div>
                  )}
                  <div ref={chatMessagesEndRef} />
                </div>

                {chatError && (
                  <div className="vd-chat-err" role="alert">
                    <CloseCircle size={16} variant="Bold" color="currentColor" />
                    <span>{chatError}</span>
                  </div>
                )}

                {messages.filter((m) => m.sender === 'user').length === 0 && !isTyping && (
                  <div className="vd-chat-sugg">
                    {['Que faire en priorité ?', 'Quels risques pour les enfants ?', 'Quels partenaires inviter ?'].map((q) => (
                      <button key={q} type="button" onClick={(e) => handleSendMessage(e, q)}>{q}</button>
                    ))}
                  </div>
                )}

                <form className="vd-chat-in" onSubmit={handleSendMessage}>
                  <textarea
                    placeholder="Posez votre question…"
                    aria-label="Votre question"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    disabled={isTyping}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                      if (e.key === 'Escape') fermerChat();
                    }}
                    rows={1}
                  />
                  <button type="submit" disabled={isTyping || !chatMessage.trim()} aria-label="Envoyer">
                    {isTyping ? <span className="vd-chat-spin" /> : <Send2 size={18} variant="Bold" color="currentColor" />}
                  </button>
                </form>
              </>
            )}
          </section>
        )}

        {/* Modal Rejoindre l'action / Inviter des organisations */}
        <InviteOrgModal key={"InviteOrgModalIncident"} />
        {/* Modal pour afficher l'image en grand */}
        {isImageModalOpen && safeIncident.image && (
          <ImageViewer
            src={safeIncident.image}
            alt={safeIncident.title || 'Photo du signalement'}
            onClose={() => setIsImageModalOpen(false)}
          />
        )}

      </section>
    </IncidentDetailContext.Provider>
  );
};

export default IncidentDetail;
