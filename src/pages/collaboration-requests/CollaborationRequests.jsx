import { useEstTelephone } from '../incident/mobile/useEstTelephone';
import { FeuilleBasse, BoutonRegles, ReglesCollaboration } from '../collaboration/mobile/FeuilleBasse';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FiltersBar } from '../../components/molecules/FiltersBar';
import { useRechercheDebouncee } from '../../hooks/useRechercheDebouncee';
import useSWR, { mutate } from 'swr';
import Pagination from '../../components/molecules/Pagination';
import { useSidebarState } from '../../hooks/useSidebarState';
import {
  SearchNormal1,
  Clock,
  TickCircle,
  CloseCircle,
  Briefcase,
  Calendar,
  MessageText1,
  ArrowRight2,
  CloseSquare,
  Building,
  Crown1,
  People,
  Eye,
  UserAdd,
  Send2,
  Import,
  Export,
  InfoCircle,
  Location
} from 'iconsax-react';
import { Header, Sidebar } from '../../components/layout';
import { ShimmerThumbnail, ShimmerTitle, ShimmerText } from 'react-shimmer-effects';
import {
  getMyPendingReceivedSuggestionsService,
  acceptPartnerSuggestionService,
  rejectPartnerSuggestionService,
  listDemandeDeCollaborationsService,
  getCollaborationDashboardService,
  acceptCollaborationService,
  rejectCollaborationService
} from './service/partner_service';
import { RequestIncidentDetailModal } from '../../components/collaboration/RequestIncidentDetailModal';
import { RequestDecisionModal } from '../../components/collaboration/RequestDecisionModal';
import { authService } from '../auth/services/authService';
import '../../styles/collaboration-requests.css';
import { logger } from '../../utils/logger';
import { useSocketCollaborations } from '../../hooks/useSocketCollaborations';

const STATUS_META = {
  pending: {
    label: 'En attente',
    icon: Clock,
    color: 'var(--color-warning-text)',
    className: 'status-pending'
  },
 
 
  declined: {
    label: 'Refusée',
    icon: CloseCircle,
    color: 'var(--color-danger-text)',
    className: 'status-rejected'
  }
};

const ROLE_META = {
  leader: { label: 'Leader', icon: Crown1, color: 'var(--color-warning-text)' },
  contributeur: { label: 'Contributeur', icon: People, color: 'var(--color-primary-text)' },
  observateur: { label: 'Observateur', icon: Eye, color: 'var(--color-text-secondary)' },
  contributor: { label: 'Contributeur', icon: People, color: 'var(--color-primary-text)' },
  observer: { label: 'Observateur', icon: Eye, color: 'var(--color-text-secondary)' }
};


const getInitials = (name = '') =>
  name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || '')
    .join('');

const RequestCardSkeleton = () => (
  <div className="incident-centric-list" style={{ marginTop: '8px' }}>
    {[...Array(3)].map((_, idx) => (
      <section key={idx} className="incident-group-card" style={{ pointerEvents: 'none', border: '1px solid var(--color-border)' }}>
        <header className="incident-group-header" style={{ display: 'flex', gap: '16px', padding: '16px 20px', alignItems: 'center' }}>
          <ShimmerThumbnail height={110} width={140} rounded style={{ margin: 0 }} />
          <div className="incident-group-title-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShimmerText line={1} width={80} style={{ margin: 0 }} />
              <span style={{ color: 'var(--color-text-muted)' }}>•</span>
              <ShimmerText line={1} width={100} style={{ margin: 0 }} />
            </div>
            <ShimmerTitle line={1} gap={4} width={200} style={{ margin: 0 }} />
            <ShimmerText line={2} style={{ margin: 0 }} />
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              <ShimmerThumbnail height={20} width={100} rounded style={{ margin: 0 }} />
              <ShimmerThumbnail height={20} width={120} rounded style={{ margin: 0 }} />
            </div>
          </div>
          <div className="incident-group-summary-side" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ShimmerThumbnail height={30} width={30} rounded style={{ margin: 0 }} />
          </div>
        </header>
      </section>
    ))}
  </div>
);

// Sur téléphone, le détail d'un groupe s'ouvre dans une feuille au lieu de se déplier.
const EnveloppeApercu = ({ estTelephone, incident, onClose, children }) => (estTelephone ? (
  <FeuilleBasse ariaLabel={incident.projectTitle} onClose={onClose}>
    <div className="vlm-apercu">
      <div className="vlm-apercu-tete">
        <span style={incident.projectImage ? { backgroundImage: `url("${incident.projectImage}")` } : undefined} />
        <b>{incident.projectTitle}</b>
      </div>
      {children}
    </div>
  </FeuilleBasse>
) : children);

export const CollaborationRequests = ({
  embedded = false
}) => {
  const {
    isOpen: sidebarOpen,
    setOpen: setSidebarOpen,
    isCollapsed: sidebarCollapsed,
    setCollapsed: setSidebarCollapsed,
  } = useSidebarState();

  const [localRequests, setLocalRequests] = useState([]);



  // Détermine si le bouton Accepter/Refuser doit s'afficher pour une requête
  // Logique : l'utilisateur connecté est-il le leader de l'incident ?
  // Et la demande ne vient-elle pas de lui-même ?
  const shouldShowAcceptForReq = (req, userCollab) => {
    if (!req) return false;
    const currUser = authService.getCurrentUser();
    if (!currUser) return false;

    const myId = currUser.id ? String(currUser.id).toLowerCase() : '';
    
    // Vérifier que l'utilisateur est leader de l'incident
    const isLeader = userCollab && userCollab.role?.toLowerCase() === 'leader' && userCollab.status === 'accepted';
    
    // Ou vérifier si l'utilisateur est le propriétaire initial (taken_by)
    const takenBy = req.incidentDetails?.taken_by ? String(req.incidentDetails.taken_by).toLowerCase() : '';
    const isOwner = takenBy && takenBy === myId;

    if (!isLeader && !isOwner) {
      return false;
    }

    // Vérifier que la demande ne vient pas de moi-même
    const reqUserId = req.userId ? String(req.userId).toLowerCase() : '';
    if (reqUserId && reqUserId === myId) {
      return false;
    }

    return true;
  };
  const estTelephone = useEstTelephone();
  const [reglesOuvertes, setReglesOuvertes] = useState(false);
  const [showInfoBanner, setShowInfoBanner] = useState(true);
  const {
    saisie: searchInput,
    setSaisie: setSearchInput,
    recherche: search,
    reinitialiser: reinitialiserRecherche,
  } = useRechercheDebouncee();
  const [statusFilter, setStatusFilter] = useState('all');
  const typeFilter = 'all';
  const [page, setPage] = useState(1);
  const pageSize = 20;
  
  // Réinitialiser la page à 1 lors du changement de filtre
  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, search]);
  
  const [expandedIncident, setExpandedIncident] = useState(null);
  const [selectedIncidentForModal, setSelectedIncidentForModal] = useState(null);

  // Modal de décision
  const [decisionRequest, setDecisionRequest] = useState(null);
  const [decisionAction, setDecisionAction] = useState(null); // 'accept' | 'reject' | null
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [decisionError, setDecisionError] = useState(null);


  // Demandes de collaborations reçues en temps réel par WebSocket
  const [wsRequests, setWsRequests] = useState([]);
  const [statusOverrides, setStatusOverrides] = useState({});

  // SWR Calls
  const { data: pendingSuggestions, error: errorSuggestions, mutate: mutatePendingSuggestions, isLoading: loadingSuggestions } = useSWR(
    typeFilter === 'sug-received' || typeFilter === 'all' ? 'my-pending-received-suggestions' : null,
    getMyPendingReceivedSuggestionsService,
    { revalidateOnFocus: false }
  );

  const { data: activeCollabs, error: errorCollabs, mutate: mutateActiveCollabs, isLoading: loadingCollabs } = useSWR(
    typeFilter === 'app-sent' || typeFilter === 'all' ? ['my-active-collaborations', page, statusFilter, search] : null,
    () => {
      const params = { page, page_size: pageSize };
      // Filtre de statut pour les demandes
      if (statusFilter === 'pending') {
        params.status = 'pending';
      } else if (statusFilter === 'declined') {
        params.status = 'declined';
      } else if (statusFilter === 'all') {
        params.status = 'all';
      }
      // Filtre de recherche
      if (search.trim()) {
        params.search = search.trim();
      }
      // console.log('[CollaborationRequests] Paramètres API getCollaborationDashboardService:', params);
      return getCollaborationDashboardService(params);
    },
    { revalidateOnFocus: false }
  );

  const { data: pendingInvitations, error: errorInvitations, mutate: mutatePendingInvitations, isLoading: loadingInvitations } = useSWR(
    typeFilter === 'app-received' || typeFilter === 'all' ? ['my-pending-contributor-invitations', { status: 'pending', role: 'contributor' }] : null,
    ([, params]) => listDemandeDeCollaborationsService(params),
    { revalidateOnFocus: false }
  );

  const hasDataError = errorSuggestions || errorCollabs || errorInvitations;

  const isDataLoading =
    ((typeFilter === 'sug-received' || typeFilter === 'all') && loadingSuggestions && !pendingSuggestions) ||
    ((typeFilter === 'app-sent' || typeFilter === 'all') && loadingCollabs && !activeCollabs) ||
    ((typeFilter === 'app-received' || typeFilter === 'all') && loadingInvitations && !pendingInvitations);

  useEffect(() => {
    if (typeFilter === 'all') {
      mutatePendingSuggestions();
      mutateActiveCollabs();
      mutatePendingInvitations();
    } else if (typeFilter === 'app-sent') {
      mutateActiveCollabs();
    } else if (typeFilter === 'app-received') {
      mutatePendingInvitations();
    } else if (typeFilter === 'sug-received') {
      mutatePendingSuggestions();
    }
  }, [typeFilter, mutatePendingSuggestions, mutateActiveCollabs, mutatePendingInvitations]);

  // Reception en direct des demandes de collaboration. La logique de connexion
  // et de reconnexion vit dans le hook, partagee avec la page « Mes
  // collaborations » qui ecoute le meme canal.
  const surMessageCollaboration = useCallback((data) => {
    if (!data) return;
    const reqId = data.id;
    const newStatus = data.status || 'pending';

    // Mettre à jour l'override de statut pour synchronisation instantanée avec SWR
    if (reqId) {
      setStatusOverrides((prev) => ({ ...prev, [reqId]: newStatus }));
    }

    setWsRequests((prev) => {
      const exists = prev.some((r) => r.apiId === reqId);
      if (exists) {
        return prev.map((r) => r.apiId === reqId ? { ...r, status: newStatus } : r);
      }

      const orgName = data.sender_organisation || 'Organisation';
      const isLeader = data.role === 'leader';
      const displayRole = isLeader ? 'Leader' : (data.role === 'observer' ? 'Observateur' : 'Contributeur');

      const currUser = authService.getCurrentUser();
      const myOrgId = currUser?.organisation_member || currUser?.organisation_id || '';
      const senderOrgId = data.sender_organisation_id;

      let calculatedDirection = 'received';
      if (senderOrgId && myOrgId && String(senderOrgId).toLowerCase() === String(myOrgId).toLowerCase()) {
        calculatedDirection = 'sent';
      } else if (data.sender_name && currUser?.first_name && data.sender_name.toLowerCase().includes(currUser.first_name.toLowerCase())) {
        calculatedDirection = 'sent';
      }

      const newReq = {
        id: `collab_ws_${reqId}`,
        type: 'invitation',
        direction: calculatedDirection,
        projectTitle: data.incident_title || `Incident #${data.incident}`,
        projectImage: '',
        organisation: orgName,
        organisationInitials: getInitials(orgName),
        organisationColor: 'var(--color-warning)',
        role: displayRole,
        motif: data.justification || data.motivation || `${orgName} a demandé à collaborer sur «${data.incident_title || 'cet incident'}»`,
        status: newStatus,
        submittedAt: data.created_at || new Date().toISOString(),
        respondedAt: null,
        response: null,
        incidentId: data.incident,
        apiId: reqId,
        incidentDetails: {
          id: data.incident,
          title: data.incident_title
        },
        userFullName: data.sender_name,
        organisationName: orgName
      };

      return [newReq, ...prev];
    });

    // Revalidation globale en arrière-plan
    mutatePendingSuggestions();
    mutateActiveCollabs();
    mutatePendingInvitations();
  }, [mutatePendingSuggestions, mutateActiveCollabs, mutatePendingInvitations]);

  useSocketCollaborations(surMessageCollaboration);

  const openDecision = (request, action = null) => {
    setDecisionRequest(request);
    setDecisionAction(action);
    setDecisionError(null);
  };

  const closeDecision = () => {
    setDecisionRequest(null);
    setDecisionAction(null);
    setDecisionError(null);
  };

  const handleConfirmDecision = async (action, text) => {
    if (!decisionRequest || !action) return;
    setIsSubmittingDecision(true);
    setDecisionError(null);

    const newStatus = action === 'accept' ? 'accepted' : 'rejected';

    try {
      if (typeof decisionRequest.id === 'string' && decisionRequest.id.startsWith('sug_received_')) {
        const suggestionId = decisionRequest.apiId;
        const incidentId = decisionRequest.incidentId;

        if (action === 'accept') {
          await acceptPartnerSuggestionService(incidentId, suggestionId);
        } else {
          await rejectPartnerSuggestionService(incidentId, suggestionId);
        }
        mutatePendingSuggestions();
        mutateActiveCollabs();
        mutatePendingInvitations();
      } else if (typeof decisionRequest.id === 'string' && decisionRequest.id.startsWith('invitation_pending_')) {
        const collaborationId = decisionRequest.apiId;

        if (action === 'accept') {
          await acceptCollaborationService(collaborationId);
        } else {
          await rejectCollaborationService(collaborationId);
        }
        mutatePendingSuggestions();
        mutateActiveCollabs();
        mutatePendingInvitations();
      } else {
        setLocalRequests((prev) =>
          prev.map((r) =>
            r.id === decisionRequest.id
              ? {
                ...r,
                status: newStatus,
                respondedAt: new Date().toISOString(),
                response: text.trim() || null
              }
              : r
          )
        );
        mutatePendingSuggestions();
        mutateActiveCollabs();
        mutatePendingInvitations();
      }
      closeDecision();
    } catch (err) {
      logger.error('[Decision] Erreur lors du traitement:', err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Une erreur est survenue lors de l'enregistrement de votre décision.";
      setDecisionError(msg);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Compile flat requests list
  const compiledSwrRequests = useMemo(() => {
    return [
      ...localRequests,
      ...(pendingSuggestions || []).map((item) => {
        const orgName = item.suggested_partner_name || item.partner_name || 'Partenaire';
        const details = item.incident_details || item.incident_detail;
        const projImg =  item?.incident_thumbnail || '';
        return {
          id: `sug_received_${item.id}`,
          type: 'suggestion',
          direction: 'received',
          projectTitle: details?.title || item.incident_title || (item.incident_id ? `Incident #${item.incident_id}` : 'Incident sans titre'),
          projectImage: projImg,
          organisation: orgName,
          organisationInitials: getInitials(orgName),
          organisationColor: 'var(--color-primary)',
          suggestedBy: item.suggested_by_name || 'Leader',
          suggestedByRole: item.suggested_by_role || 'Leader',
          suggestionMessage: item.justification || item.message || 'Pas de message.',
          role: (item.suggested_role || item.role || 'contributor') === 'leader' ? 'Leader' : ((item.suggested_role || item.role || 'contributor') === 'observer' || (item.suggested_role || item.role || 'contributor') === 'observateur') ? 'Observateur' : 'Contributeur',
          proposedCollaborators: (item.proposed_collaborators || []).map((pc) => ({
            name: pc.partner_name || 'Partenaire',
            initials: getInitials(pc.partner_name || 'PT'),
            color: 'var(--color-success-text)',
            role: pc.role || 'contributeur',
            comment: pc.justification || ''
          })),
          status: item.status || 'pending',
          submittedAt: item.created_at || new Date().toISOString(),
          respondedAt: item.updated_at || null,
          response: item.response_message || null,
          incidentId: item.incident_id || item.incident,
          apiId: item.id,
          incidentDetails: details,
          predictionDetails: item.prediction_details,
          userFullName: item.user_full_name,
          userEmail: item.user_email,
          organisationId: item.organisation_id,
          organisationName: item.organisation_name || orgName,
          userId: item.user || null
        };
      }),
      ...(activeCollabs?.results || []).map((item) => {
        const details = item.incident_details || item.incident_detail;
        const projTitle = details?.title || item.incident_title || (item.incident_id ? `Incident #${item.incident_id}` : 'Incident sans titre');
        const projImg = item?.incident_thumbnail || '';

        const currUser = authService.getCurrentUser();
        const currentUserId = currUser?.id ? String(currUser.id).toLowerCase() : '';
        const senderId = item.sender?.id ? String(item.sender.id).toLowerCase() : (item.sender ? String(item.sender).toLowerCase() : '');
        const receiverId = item.receiver?.id ? String(item.receiver.id).toLowerCase() : (item.receiver ? String(item.receiver).toLowerCase() : '');

        let calculatedDirection = 'sent';
        if (currentUserId && senderId === currentUserId) {
          calculatedDirection = 'sent';
        } else if (currentUserId && receiverId === currentUserId) {
          calculatedDirection = 'received';
        }

        const myOrgId = currUser?.organisation_member || currUser?.organisation_id || '';
        const senderOrgId = item.sender?.organisation_id || '';
        const receiverOrgId = item.receiver?.organisation_id || '';

        let senderOrgName = '';
        if (senderOrgId && myOrgId && String(senderOrgId).toLowerCase() === String(myOrgId).toLowerCase()) {
          senderOrgName = currUser?.organisation_name || item.sender?.organisation_name || 'Mon Organisation';
        } else {
          senderOrgName = item.sender?.organisation_name || item.organisation_name || 'Partenaire';
        }

        let receiverOrgName = '';
        if (receiverOrgId && myOrgId && String(receiverOrgId).toLowerCase() === String(myOrgId).toLowerCase()) {
          receiverOrgName = currUser?.organisation_name || item.receiver?.organisation_name || 'Mon Organisation';
        } else {
          receiverOrgName = item.receiver?.organisation_name || item.organisation_name || 'Partenaire';
        }

        const displayOrgName = (calculatedDirection === 'sent') ? receiverOrgName : senderOrgName;

        return {
          id: `collab_active_${item.id}`,
          direction: calculatedDirection,
          projectTitle: projTitle,
          projectImage: projImg,
          organisation: displayOrgName,
          organisationInitials: getInitials(displayOrgName),
          organisationColor: 'var(--color-success)',
          role: item.role === 'leader' ? 'Leader' : (item.role === 'contributor' || item.role === 'contributeur') ? 'Contributeur' : 'Observateur',
          motif: item.justification || item.motivation || 'Collaboration acceptée en cours.',
          status: item.status || 'accepted',
          submittedAt: item.created_at || new Date().toISOString(),
          respondedAt: item.updated_at || null,
          response: null,
          incidentId: details?.id || item.incident_id || item.incident,
          apiId: item.id,
          incidentDetails: details,
          predictionDetails: item.prediction_details,
          userFullName: item.user_full_name || item.sender?.name,
          userEmail: item.user_email || item.sender?.email,
          organisationId: item.organisation_id,
          organisationName: displayOrgName,
          userId: item.user || null
        };
      }),
      ...(pendingInvitations || []).map((item) => {
        const details = item.incident_details || item.incident_detail;
        const projTitle = details?.title || item.incident_title || (item.incident_id ? `Incident #${item.incident_id}` : 'Incident sans titre');
        const projImg = item?.incident_thumbnail || '';

        const currUser = authService.getCurrentUser();
        const currentUserId = currUser?.id ? String(currUser.id).toLowerCase() : '';
        const senderId = item.sender?.id ? String(item.sender.id).toLowerCase() : (item.sender ? String(item.sender).toLowerCase() : '');
        const receiverId = item.receiver?.id ? String(item.receiver.id).toLowerCase() : (item.receiver ? String(item.receiver).toLowerCase() : '');

        let calculatedDirection = 'received';
        if (currentUserId && senderId === currentUserId) {
          calculatedDirection = 'sent';
        } else if (currentUserId && receiverId === currentUserId) {
          calculatedDirection = 'received';
        }

        const myOrgId = currUser?.organisation_member || currUser?.organisation_id || '';
        const senderOrgId = item.sender?.organisation_id || '';
        const receiverOrgId = item.receiver?.organisation_id || '';

        let senderOrgName = '';
        if (senderOrgId && myOrgId && String(senderOrgId).toLowerCase() === String(myOrgId).toLowerCase()) {
          senderOrgName = currUser?.organisation_name || item.sender?.organisation_name || 'Mon Organisation';
        } else {
          senderOrgName = item.sender?.organisation_name || item.organisation_name || 'Partenaire';
        }

        let receiverOrgName = '';
        if (receiverOrgId && myOrgId && String(receiverOrgId).toLowerCase() === String(myOrgId).toLowerCase()) {
          receiverOrgName = currUser?.organisation_name || item.receiver?.organisation_name || 'Mon Organisation';
        } else {
          receiverOrgName = item.receiver?.organisation_name || item.organisation_name || 'Partenaire';
        }

        const displayOrgName = (calculatedDirection === 'sent') ? receiverOrgName : senderOrgName;

        return {
          id: `invitation_pending_${item.id}`,
          direction: calculatedDirection,
          applicantName: item.user_full_name || item.invited_member_name || item.sender?.name || 'Membre',
          applicantOrg: senderOrgName,
          projectTitle: projTitle,
          projectImage: projImg,
          organisation: displayOrgName,
          organisationInitials: getInitials(displayOrgName),
          organisationColor: 'var(--color-warning)',
          role: item.role === 'leader' ? 'Leader' : (item.role === 'contributor' || item.role === 'contributeur') ? 'Contributeur' : 'Observateur',
          motif: item.justification || item.motivation || 'Invitation en attente de réponse.',
          status: item.status || 'pending',
          submittedAt: item.created_at || new Date().toISOString(),
          respondedAt: null,
          response: null,
          incidentId: details?.id || item.incident_id || item.incident,
          apiId: item.id,
          incidentDetails: details,
          predictionDetails: item.prediction_details,
          userFullName: item.user_full_name || item.sender?.name,
          userEmail: item.user_email || item.sender?.email,
          organisationId: item.organisation_id,
          organisationName: displayOrgName,
          userId: item.user || null
        };
      })
    ].map(r => {
      if (r.apiId && statusOverrides[r.apiId]) {
        return { ...r, status: statusOverrides[r.apiId] };
      }
      return r;
    }).filter(r => r.status !== 'accepted');
  }, [localRequests, pendingSuggestions, activeCollabs, pendingInvitations, statusOverrides]);

  const swrApiIds = new Set(compiledSwrRequests.map(r => r.apiId).filter(Boolean));
  const filteredWsRequests = wsRequests.filter(r => !swrApiIds.has(r.apiId));

  const requests = [
    ...filteredWsRequests,
    ...compiledSwrRequests
  ];

  const q = search.trim().toLowerCase();
  const filtered = requests.filter((r) => {
    const isSuggestion = r.type === 'suggestion';
    const isSent = r.direction === 'sent';
    if (typeFilter === 'app-sent' && (isSuggestion || !isSent)) return false;
    if (typeFilter === 'app-received' && (isSuggestion || isSent)) return false;
    if (typeFilter === 'sug-sent' && (!isSuggestion || !isSent)) return false;
    if (typeFilter === 'sug-received' && (!isSuggestion || isSent)) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (!q) return true;
    return (
      r.projectTitle.toLowerCase().includes(q) ||
      r.organisation.toLowerCase().includes(q) ||
      (r.role || r.proposedRole || '').toLowerCase().includes(q) ||
      (r.applicantName || '').toLowerCase().includes(q) ||
      (r.applicantOrg || '').toLowerCase().includes(q)
    );
  });

  // Incident-centric grouping
  const groupedIncidents = [];
  const incidentsMap = {};

  filtered.forEach((r) => {
    const incidentId = r.incidentId || 'unknown';
    if (!incidentsMap[incidentId]) {
      incidentsMap[incidentId] = {
        id: incidentId,
        projectTitle: r.projectTitle || 'Incident sans titre',
        projectImage: r.projectImage || '',
        leader: null,
        userCollab: null,
        otherCollabs: [],
        suggestions: [],
        incidentDetails: r.incidentDetails,
        predictionDetails: r.predictionDetails
      };
      groupedIncidents.push(incidentsMap[incidentId]);
    }

    const group = incidentsMap[incidentId];
    if (r.projectImage && !group.projectImage) {
      group.projectImage = r.projectImage;
    }
    if (r.incidentDetails && !group.incidentDetails) {
      group.incidentDetails = r.incidentDetails;
    }
    if (r.predictionDetails && !group.predictionDetails) {
      group.predictionDetails = r.predictionDetails;
    }

    if (r.type === 'suggestion') {
      group.suggestions.push(r);
    } else {
      if (r.role?.toLowerCase() === 'leader' && r.status === 'accepted') {
        group.leader = {
          name: r.applicantName || r.organisation || 'Leader',
          org: r.applicantOrg || r.organisation,
          color: r.organisationColor || 'var(--color-warning)'
        };
      }
      const isForCurrentUser = r.direction === 'sent' || (r.direction === 'received' && !r.applicantName);
      if (isForCurrentUser) {
        group.userCollab = r;
      } else {
        group.otherCollabs.push(r);
      }
    }
  });

  // Resolve leader presence
  groupedIncidents.forEach((group) => {
    if (group.userCollab && group.userCollab.role?.toLowerCase() === 'leader') {
      group.leader = {
        name: 'Vous',
        isMe: true,
        color: 'var(--color-warning-text)'
      };
    }
    if (!group.leader) {
      const activeLeader = group.otherCollabs.find(oc => oc.role?.toLowerCase() === 'leader' && oc.status === 'accepted');
      if (activeLeader) {
        group.leader = {
          name: activeLeader.applicantName || activeLeader.organisation || 'Leader',
          org: activeLeader.applicantOrg || activeLeader.organisation,
          color: activeLeader.organisationColor || 'var(--color-warning)'
        };
      }
    }
    if (!group.leader) {
      const takenByOrg = group.incidentDetails?.taken_by_organisation;
      if (takenByOrg) {
        const currUser = authService.getCurrentUser();
        const myOrgId = currUser?.organisation_member || currUser?.organisation_id || '';
        const isMe = myOrgId && String(takenByOrg.id).toLowerCase() === String(myOrgId).toLowerCase();
        group.leader = {
          name: isMe ? 'Vous' : (group.incidentDetails?.taken_by_name || takenByOrg.name || 'Leader'),
          org: takenByOrg.name,
          isMe,
          color: 'var(--color-warning-text)'
        };
      }
    }
  });
 

  const content = hasDataError ? (
    <div className="collab-empty body-large text-center" style={{ padding: '40px 20px' }}>
 
              
                  <div className="collab-empty body-large text-center" >
                    <p>Erreur lors du chargement des demandes de collaboration.</p>
                    <button
                      onClick={() => mutate()}
                      className='btn btn-primary'
                    >
                      Réessayer
                    </button>
                  </div>
               
    </div>
  ) : (
    <>
      {!embedded && (
        <div className="requests-page-header">
          <div>
            <h1 className="requests-title">Demandes de collaboration</h1>
            <p className="requests-subtitle">
              Gérez vos demandes de participation et suivez les rôles associés aux incidents.
            </p>
          </div>
        </div>
      )}


      {/* Toolbar — fixe au defilement : voir .requests-filtres-fixes. */}
      <div className="requests-filtres-fixes">
      <FiltersBar
        recherche={searchInput}
        onRecherche={setSearchInput}
        placeholder="Rechercher un signalement, un rôle, une organisation…"
        onEffacer={() => { reinitialiserRecherche(); setStatusFilter('all'); }}
        actifSupplementaire={statusFilter !== 'all'}
        resultats={filtered.length}
        nomResultat="demande"
      >
        <div className="requests-filters">
          <button
            type="button"
            className={`requests-filter-pill ${statusFilter === 'all' ? 'is-active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            Toutes

          </button>
          <button
            type="button"
            className={`requests-filter-pill ${statusFilter === 'pending' ? 'is-active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            <Clock size={14} variant="Bold" color="currentColor" style={{ color: 'currentColor' }} />
            En attente

          </button>
          <button
            type="button"
            className={`requests-filter-pill ${statusFilter === 'declined' ? 'is-active' : ''}`}
            onClick={() => setStatusFilter('declined')}
          >
            <CloseCircle size={14} variant="Bold" color="currentColor" style={{ color: 'currentColor' }} />
            Refusées

          </button>

        </div>
      </FiltersBar>
      </div>


      {/* Collapsible Info Banner (Scenarios 2 & 3 Explanation) */}
      {estTelephone && <BoutonRegles onClick={() => setReglesOuvertes(true)} />}
      {estTelephone && reglesOuvertes && <ReglesCollaboration onClose={() => setReglesOuvertes(false)} />}
      {!estTelephone && showInfoBanner && (
        <div className="collaboration-info-banner">
          <div className="info-banner-content">
            <InfoCircle size={24} variant="Bold" className="info-banner-icon" style={{ color: 'var(--color-primary-text)' }} />
            <div className="info-banner-text">
              <h4>Règles de collaboration sur les Signalements</h4>
              <p>
                <strong>1. Sans Leader :</strong> Si aucun leader n'a encore pris le signalement en charge, toute demande d'observation ou de contribution est <strong>automatiquement acceptée</strong>.
              </p>
              <p>
                <strong>2. Prise en charge par un Leader :</strong> Dès qu'une organisation prend en charge le signalement en tant que <strong>Leader</strong>, toutes les contributions existantes repassent en status <strong>"En attente"</strong> pour lui permettre de les valider manuellement. Les observateurs restent actifs.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="info-banner-close"
            onClick={() => setShowInfoBanner(false)}
            aria-label="Fermer"
          >
            <CloseCircle size={20} variant="Linear" style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>
      )}

      {/* Grouped Incident List */}
      {isDataLoading ? (
        <RequestCardSkeleton />
      ) : groupedIncidents.length === 0 ? (
        <div className="requests-empty">
          <p className='body-large' style={{ color: "var(--color-text-primary)" }}>Aucune collaboration ne correspond à vos critères.</p>
        </div>
      ) : (
        <div className="incident-centric-list">
          {groupedIncidents.map((incident) => {
            const isExpanded = expandedIncident === incident.id;
            const hasLeader = !!incident.leader;
            // Déterminer si l'utilisateur connecté est le propriétaire de l'incident
            const currUser = authService.getCurrentUser();
            const takenBy = incident.incidentDetails?.taken_by;
            const isUserLeader = incident.leader?.isMe ||
              (currUser && takenBy && String(takenBy).toLowerCase() === String(currUser.id).toLowerCase());

            // Status details for user's own participation
            const myCollab = incident.userCollab;
            const meta = myCollab ? STATUS_META[myCollab.status] : null;
            const myRoleKey = myCollab?.role?.toLowerCase() === 'leader' ? 'leader' :
              (myCollab?.role?.toLowerCase() === 'contributeur' || myCollab?.role?.toLowerCase() === 'contributor') ? 'contributor' : 'observer';
            const myRoleMeta = myCollab ? ROLE_META[myRoleKey] : null;

            const pendingOthers = incident.otherCollabs.filter(c => c.status === 'pending');

            const targetReq = incident.otherCollabs.find(oc => oc.status === 'pending' && shouldShowAcceptForReq(oc, myCollab))
              || incident.suggestions.find(s => s.status === 'pending' && shouldShowAcceptForReq(s, myCollab));

            const pendingReqToAction = targetReq || (myCollab?.status === 'pending' && shouldShowAcceptForReq(myCollab, myCollab) ? myCollab : null);
            const showAcceptReject = !!pendingReqToAction;

            return (
              <section
                key={incident.id}
                className={`incident-group-card ${isExpanded ? 'is-expanded' : ''} ${hasLeader ? 'has-leader' : 'no-leader'}`}
              >
                {/* Incident Group Header */}
                <header
                  className="incident-group-header"
                  onClick={() => setExpandedIncident(isExpanded ? null : incident.id)}
                >
                  <div
                    className="incident-group-thumb"
                    style={incident.projectImage ? { backgroundImage: `url("${incident.projectImage}")` } : {}}
                  >
                    {myCollab && meta && (
                      <span className={`request-status-badge ${meta.className}`} style={{
                        position: 'absolute',
                        top: '8px',
                        left: '8px',
                        padding: '3px 8px',
                        color: 'var(--color-surface)',
                        borderRadius: '4px',
                        fontSize: 'var(--font-size-micro)',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        backgroundColor: meta.color,
                        boxShadow: '0 2px 6px rgba(var(--rgb-ombre),0.15)'
                      }}>
                        {meta.label}
                      </span>
                    )}
                  </div>

                  <div className="incident-group-title-section">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: 'var(--font-size-caption)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: 'var(--font-size-body-small)' }}>
                        {incident.userCollab?.direction === 'sent' ? (
                          <>
                            Vous avez envoyé une demande de collaboration à <strong style={{ fontWeight: 800 }}>{incident.leader?.org || incident.organisation}</strong>
                          </>
                        ) : (
                          <>
                            <strong style={{ fontWeight: 800 }}>{pendingReqToAction?.organisation || 'Une organisation'}</strong> a demandé à collaborer sur <strong style={{ fontWeight: 800 }}>«{incident.projectTitle}»</strong>
                          </>
                        )}
                      </span>
                      <span style={{ color: 'var(--color-text-muted)' }}>•</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)' }}>
                        <Location size={12} variant="Bold" color="currentColor" style={{ color: 'var(--color-text-secondary)' }} />
                        {incident.incidentDetails?.zone || incident.incidentDetails?.location || 'Localisation non spécifiée'}
                      </span>
                    </div>

                    <h3 className="incident-group-title" style={{ margin: 0, fontSize: 'var(--font-size-body-large)', fontWeight: 700 }}>
                      {incident.projectTitle}
                    </h3>

                    <p style={{
                      margin: 0,
                      fontSize: 'var(--font-size-body-small)',
                      color: 'var(--color-text-secondary)',
                      lineHeight: '1.5',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      lineClamp: 2,
                      overflow: 'hidden'
                    }}>
                      {incident.incidentDetails?.description || 'Aucune description disponible.'}
                    </p>

                    <div className="incident-group-status-badges" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                      {/* User's own role badge if participating and NOT leader */}
                      {!isUserLeader && myCollab && myRoleMeta && (
                        <span className="my-participation-badge" style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: 'var(--font-size-micro)',
                          fontWeight: '600',
                          color: myRoleMeta.color,
                          borderColor: 'transparent',
                          backgroundColor: `${myRoleMeta.color}15`
                        }}>
                          <People size={13} variant="Bold" color="currentColor" style={{ color: myRoleMeta.color }} />
                          {myCollab.direction === 'sent'
                            ? `Souhait : ${myCollab.role}`
                            : `Rôle : ${myCollab.role}`
                          }
                        </span>
                      )}

                      {/* Display leader badge, but only if I am NOT the leader of this incident */}
                      {!isUserLeader && incident.leader && (
                        <span className="leader-badge" style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: 'var(--font-size-micro)',
                          fontWeight: '600',
                          color: 'var(--color-warning-text)',
                          backgroundColor: 'rgba(var(--rgb-warning), 0.12)',
                          border: 'none'
                        }}>
                          <Crown1 size={13} variant="Bold" color="currentColor" style={{ color: 'var(--color-warning-text)' }} />
                          Leader : {incident.leader.org || incident.leader.name}
                        </span>
                      )}

                      {(() => {
                        // Si shouldShowAcceptForReq est vrai pour une demande de cet incident,
                        // on affiche l'organisation du demandeur (l'utilisateur) au lieu de celle de l'incident.
                        const targetReq = incident.otherCollabs.find(oc => oc.status === 'pending' && shouldShowAcceptForReq(oc, myCollab))
                          || incident.suggestions.find(s => s.status === 'pending' && shouldShowAcceptForReq(s, myCollab));

                        const orgToShow = targetReq
                          ? (targetReq.organisationName || targetReq.organisation)
                          : (myCollab?.organisationName || myCollab?.organisation);

                        if (!orgToShow) return null;

                        return (
                          <span className="my-participation-badge" style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: 'var(--font-size-micro)',
                            fontWeight: '600',
                            color: 'var(--color-text-secondary)',
                            borderColor: 'transparent',
                            backgroundColor: 'rgba(var(--rgb-text-secondary), 0.08)'
                          }}>
                            <Building size={13} variant="Bold" color="currentColor" style={{ color: 'var(--color-text-secondary)' }} />
                            {orgToShow}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="incident-group-summary-side" onClick={(e) => e.stopPropagation()}>
                    {/* Accept/Reject buttons */}
                    {showAcceptReject && pendingReqToAction && (
                      <div className="header-action-buttons" style={{ display: 'flex', gap: '8px', marginRight: '8px' }}>
                        <button
                          type="button"
                          className="btn-card-accept"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--color-success)',
                            color: 'var(--color-surface)',
                            border: 'none',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: 'var(--font-size-caption)'
                          }}
                          onClick={() => openDecision(pendingReqToAction, 'accept')}
                        >
                          <TickCircle size={14} variant="Bold" color="currentColor" style={{ color: 'var(--color-surface)' }} />
                          Accepter
                        </button>
                        <button
                          type="button"
                          className="btn-card-reject"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--color-danger)',
                            color: 'var(--color-surface)',
                            border: 'none',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: 'var(--font-size-caption)'
                          }}
                          onClick={() => openDecision(pendingReqToAction, 'reject')}
                        >
                          <CloseSquare size={14} variant="Bold" color="currentColor" style={{ color: 'var(--color-surface)' }} />
                          Refuser
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      className={`incident-group-toggle ${isExpanded ? 'is-open' : ''}`}
                      onClick={() => setExpandedIncident(isExpanded ? null : incident.id)}
                      aria-label={isExpanded ? 'Réduire' : 'Développer'}
                    >
                      <ArrowRight2 size={18} variant="Linear" color="var(--color-text-secondary)" />

                    </button>
                  </div>
                </header>

                {/* Expanded content */}
                {isExpanded && (
                  <EnveloppeApercu estTelephone={estTelephone} incident={incident} onClose={() => setExpandedIncident(null)}>
                  <div className="incident-group-body">
                    <div className="incident-details-grid">
                      {/* Left: Your collaboration state details */}
                      <div className="grid-column my-collab-details">
                        <h4 className="detail-section-title">Votre participation</h4>
                        {myCollab ? (
                          <div className="my-collab-info-box">
                            <p className="my-collab-motif">
                              <strong>Votre motif :</strong> "{myCollab.motif || myCollab.suggestionMessage || 'Aucun motif renseigné'}"
                            </p>

                            {/* Contextual pending/accepted help text depending on Leader presence (Scenarios 2 & 3) */}
                            <div className="scenario-explanation-box">
                              {myCollab.status === 'pending' ? (
                                <p className="status-note status-pending">
                                  <Clock size={16} variant="Bold" color="currentColor" style={{ color: 'var(--color-warning-text)' }} />
                                  {myCollab.incidentDetails?.etat === "taken_into_account" ? (
                                    <>
                                      En attente de validation par le leader {incident.leader?.org && (<strong>({incident.leader.org})</strong>)}
                                    </>
                                  ) : (
                                    <>
                                      En attente. En l'absence de leader, votre demande sera acceptée automatiquement.
                                    </>
                                  )}
                                </p>
                              ) : myCollab.status === 'accepted' ? (
                                <p className="status-note status-accepted">
                                  {myCollab.role?.toLowerCase() === 'observer' || myCollab.role?.toLowerCase() === 'observateur' ? (
                                    <>Participation active en tant qu'observateur (Toujours approuvée).</>
                                  ) : hasLeader ? (
                                    <>Approuvée par le leader (<strong>{incident.leader?.org || incident.leader?.name}</strong>).</>
                                  ) : (
                                    <>Active (Auto-acceptée car aucun leader n'est désigné sur le signalement).</>
                                  )}
                                </p>
                              ) : (
                                <p className="status-note status-rejected">
                                  Collaboration refusée. {myCollab.response && `Motif : "${myCollab.response}"`}
                                </p>
                              )}
                            </div>


                          </div>
                        ) : (
                          <p className="no-participation-text">Vous ne participez pas encore à cet signalement.</p>
                        )}
                        <button
                          type="button"
                          className="btn btn-primary"

                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedIncidentForModal(incident);
                          }}
                        >
                          Voir incident
                        </button>
                      </div>



                      {/* Right: Validation Actions for Leader or Suggestions */}
                      <div className="grid-column actions-section">
                        {/* Scenario validation box for leaders */}
                        {isUserLeader ? (
                          <>
                            <h4 className="detail-section-title text-gold">Demandes à valider ({pendingOthers.length})</h4>
                            {pendingOthers.length === 0 ? (
                              <p className="no-actions-text">Aucune demande en attente de votre décision.</p>
                            ) : (
                              <div className="leader-pending-requests">
                                {pendingOthers.map((pendingReq) => (
                                  <div key={pendingReq.id} className="leader-action-box">
                                    <div className="leader-action-info">
                                      <strong>{pendingReq.applicantName || pendingReq.organisation}</strong>
                                      <span className="request-role-badge contribution-pill">
                                        {pendingReq.role}
                                      </span>
                                    </div>
                                    <p className="leader-action-motif">"{pendingReq.motif}"</p>


                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <h4 className="detail-section-title">Suggestions de partenaires ({incident.suggestions.length})</h4>
                            {incident.suggestions.length === 0 ? (
                              <p className="no-actions-text">Aucune suggestion pour cet signalement.</p>
                            ) : (
                              <div className="incident-suggestions-list">
                                {incident.suggestions.map((sug) => (
                                  <div key={sug.id} className="sug-action-card">
                                    <div className="sug-card-header">
                                      <strong>{sug.organisation}</strong>
                                      <span className="sug-count">Rôle suggéré : {sug.role}</span>
                                    </div>
                                    <p className="sug-justification">"{sug.suggestionMessage}"</p>

                                    {sug.status === 'pending' && shouldShowAcceptForReq(sug) && (
                                      <button
                                        type="button"
                                        className="sug-action-btn"
                                        onClick={() => openDecision(sug)}
                                      >
                                        Traiter la suggestion
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  </EnveloppeApercu>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Decision modal */}
      {decisionRequest && (
        <RequestDecisionModal
          request={decisionRequest}
          onClose={closeDecision}
          onConfirm={handleConfirmDecision}
          isSubmitting={isSubmittingDecision}
          error={decisionError}
          initialAction={decisionAction}
        />
      )}
      {/* Incident Detail Modal */}
      {selectedIncidentForModal && (
        <RequestIncidentDetailModal
          incident={selectedIncidentForModal}
          onClose={() => setSelectedIncidentForModal(null)}
        />
      )}
      
      {/* Pagination */}
      {activeCollabs?.count > pageSize && (
        <Pagination
          page={page}
          pageSize={pageSize}
          count={activeCollabs?.count || 0}
          onChange={setPage}
        />
      )}
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="requests-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      <div className={`requests-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          sidebarCollapsed={sidebarCollapsed}
        />

        <main className="requests-content">
          <div className="requests-page">
            {content}
          </div>
        </main>
      </div>
    </div>
  );
};

export default CollaborationRequests;
