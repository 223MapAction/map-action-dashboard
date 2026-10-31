import { useEstTelephone } from '../incident/mobile/useEstTelephone';
import { BoutonRegles, ReglesCollaboration } from '../collaboration/mobile/FeuilleBasse';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FiltersBar } from '../../components/molecules/FiltersBar';
import { useRechercheDebouncee } from '../../hooks/useRechercheDebouncee';
import useSWR from 'swr';
import { useSidebarState } from '../../hooks/useSidebarState';
import {
  SearchNormal1,
  Clock,
  TickCircle,
  CloseCircle,
  CloseSquare,
  Building,
  Crown1,
  People,
  Eye,
  Send2,
  Import,
  InfoCircle,
  Location,
  ArrowRight2,
  MessageText1,
  Calendar
} from 'iconsax-react';
import { Header, Sidebar } from '../../components/layout';
import { ShimmerThumbnail, ShimmerTitle, ShimmerText } from 'react-shimmer-effects';
import {
  getMyReceivedSuggestionsService,
  getMySentSuggestionsService,
  acceptPartnerSuggestionService,
  rejectPartnerSuggestionService
} from './service/suggest_service';
import { RequestIncidentDetailModal } from '../../components/collaboration/RequestIncidentDetailModal';
import { RequestDecisionModal } from '../../components/collaboration/RequestDecisionModal';
import { authService } from '../auth/services/authService';
import { API_URL_BASE } from '../../config/api_url_base';
import '../../styles/collaboration-requests.css';
import { logger } from '../../utils/logger';

/* ──────────────────── Constants ──────────────────── */

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
  contributor: { label: 'Contributeur', icon: People, color: 'var(--color-primary-text)' },
  observateur: { label: 'Observateur', icon: Eye, color: 'var(--color-text-secondary)' },
  observer: { label: 'Observateur', icon: Eye, color: 'var(--color-text-secondary)' }
};

const TYPE_FILTERS = [
  { key: 'all', label: 'Tout' },
  { key: 'suggestions', label: 'Suggestions', icon: MessageText1 },
  { key: 'invitations', label: 'Invitations', icon: Import }
];

const STATUS_FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'pending', label: 'En attente', icon: Clock },
  { key: 'declined', label: 'Refusées', icon: CloseCircle }
];

/* ──────────────────── Helpers ──────────────────── */

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

const getInitials = (name = '') =>
  name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() || '')
    .join('');

const getRoleMeta = (role) => {
  const key = (role || '').toLowerCase();
  return ROLE_META[key] || ROLE_META.contributor;
};

/* ──────────────────── Skeleton ──────────────────── */

const CardSkeleton = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
    {[...Array(4)].map((_, i) => (
      <div
        key={i}
        className="incident-group-card"
        style={{ pointerEvents: 'none', border: '1px solid var(--color-border)' }}
      >
        <div style={{ display: 'flex', gap: '16px', padding: '16px 20px', alignItems: 'center' }}>
          <ShimmerThumbnail height={80} width={100} rounded style={{ margin: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <ShimmerText line={1} width={120} style={{ margin: 0 }} />
            <ShimmerTitle line={1} width={220} style={{ margin: 0 }} />
            <ShimmerText line={1} width={180} style={{ margin: 0 }} />
            <div style={{ display: 'flex', gap: '6px' }}>
              <ShimmerThumbnail height={20} width={90} rounded style={{ margin: 0 }} />
              <ShimmerThumbnail height={20} width={110} rounded style={{ margin: 0 }} />
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

/* ──────────────────── Main Component ──────────────────── */

export const SuggestRequests = ({ embedded = false }) => {
  const {
    isOpen: sidebarOpen,
    setOpen: setSidebarOpen,
    isCollapsed: sidebarCollapsed,
    setCollapsed: setSidebarCollapsed
  } = useSidebarState();

  /* ── State ── */
  const {
    saisie: searchInput,
    setSaisie: setSearchInput,
    recherche: search,
    reinitialiser: reinitialiserRecherche,
  } = useRechercheDebouncee();
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const estTelephone = useEstTelephone();
  const [reglesOuvertes, setReglesOuvertes] = useState(false);
  const [showInfoBanner, setShowInfoBanner] = useState(true);

  // Modals
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [decisionRequest, setDecisionRequest] = useState(null);
  const [decisionAction, setDecisionAction] = useState(null);
  const [decisionError, setDecisionError] = useState(null);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  // WebSocket
  const [wsRequests, setWsRequests] = useState([]);
  const [statusOverrides, setStatusOverrides] = useState({});

  // Image URL cache (évite les re-render à chaque revalidation SWR avec URL signées)
  const imageCacheRef = useRef({});

  const getStableImageUrl = (key, rawUrl) => {
    if (!rawUrl) return '';
    const basePath = (() => {
      try { return new URL(rawUrl).origin + new URL(rawUrl).pathname; }
      catch { return rawUrl; }
    })();
    const cached = imageCacheRef.current[key];
    if (cached && (() => { try { return new URL(cached.url).origin + new URL(cached.url).pathname; } catch { return cached.url; } })() === basePath) {
      if (Date.now() - cached.timestamp < 600000 || rawUrl === cached.url) return cached.url;
      imageCacheRef.current[key] = { url: rawUrl, timestamp: Date.now() };
      return rawUrl;
    }
    imageCacheRef.current[key] = { url: rawUrl, timestamp: Date.now() };
    return rawUrl;
  };

  /* ── SWR : Suggestions + Invitations reçues (l'API /my-suggestions/received/ retourne maintenant les deux) ── */
  const {
    data: receivedSuggestions,
    error: errorSuggestions,
    mutate: mutateSuggestions,
    isLoading: loadingSuggestions
  } = useSWR(
    ['my-received-suggestions', statusFilter],
    () => getMyReceivedSuggestionsService(),
    { revalidateOnFocus: false, refreshInterval: 5000, refreshWhenHidden: false }
  );

  /* ── SWR : Suggestions envoyées (j'ai créé ces suggestions) ── */
  const {
    data: sentSuggestions,
    error: errorSentSuggestions,
    mutate: mutateSentSuggestions,
    isLoading: loadingSentSuggestions
  } = useSWR(
    typeFilter === 'suggestions' || typeFilter === 'all' ? ['my-sent-suggestions', statusFilter] : null,
    () => getMySentSuggestionsService(),
    { revalidateOnFocus: false, refreshInterval: 5000, refreshWhenHidden: false }
  );

  const hasError = errorSuggestions || errorSentSuggestions;
  const isLoading =
    (loadingSuggestions && !receivedSuggestions) ||
    ((typeFilter === 'suggestions' || typeFilter === 'all') && loadingSentSuggestions && !sentSuggestions);

  /* ── WebSocket ── */
  useEffect(() => {
    const wsBaseUrl = (window.location.protocol === 'https:' || API_URL_BASE.startsWith('https'))
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
      socket = new WebSocket(`${wsBaseUrl}/ws/collaborations/${query}`);

      socket.onopen = () => {
        delay = 3000;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data) return;

          const reqId = data.id;
          const newStatus = data.status || 'pending';

          if (reqId) {
            setStatusOverrides((prev) => ({ ...prev, [reqId]: newStatus }));
          }

          setWsRequests((prev) => {
            if (prev.some((r) => r.apiId === reqId)) {
              return prev.map((r) => (r.apiId === reqId ? { ...r, status: newStatus } : r));
            }

            const orgName = data.sender_organisation || 'Organisation';
            const currUser = authService.getCurrentUser();
            const myOrgId = currUser?.organisation_member || currUser?.organisation_id || '';
            const senderOrgId = data.sender_organisation_id;

            let direction = 'received';
            if (senderOrgId && myOrgId && String(senderOrgId).toLowerCase() === String(myOrgId).toLowerCase()) {
              direction = 'sent';
            }

            return [{
              id: `ws_${reqId}`,
              type: 'invitation',
              direction,
              projectTitle: data.incident_title || `Incident #${data.incident}`,
              projectImage: '',
              organisation: orgName,
              organisationInitials: getInitials(orgName),
              organisationColor: 'var(--color-warning)',
              role: data.role === 'leader' ? 'Leader' : data.role === 'observer' ? 'Observateur' : 'Contributeur',
              motif: data.justification || data.motivation || '',
              status: newStatus,
              submittedAt: data.created_at || new Date().toISOString(),
              incidentId: data.incident,
              apiId: reqId,
              incidentDetails: { id: data.incident, title: data.incident_title },
              userFullName: data.sender_name,
              organisationName: orgName
            }, ...prev];
          });

          // Revalider SWR en arrière-plan
          mutateSuggestions();
          mutateSentSuggestions();
        } catch (e) {
          logger.error('[WS] Erreur parsing:', e);
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
      socket?.close(1000, 'Page unloading');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    connect();

    return () => {
      isCleanedUp = true;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      socket?.close(1000, 'Component unmounting');
    };
  }, [mutateSuggestions, mutateSentSuggestions]);

  /* ── Compile flat requests ── */
  const compiledRequests = useMemo(() => {

    // Suggestions + Invitations reçues (l'API /my-suggestions/received/ retourne maintenant les deux)
    // Une invitation est détectée par l'absence de suggested_partner_name (ou présence de is_invitation)
    const received = (receivedSuggestions || []).map((item) => {
      const details = item.incident_details;
      const isInvitation = !item.suggested_partner_name || item.is_invitation || item.type === 'invitation';
      const partnerName = isInvitation
        ? (item.suggested_by_organisation || item.sender_organisation || 'Organisation')
        : (item.suggested_partner_name || 'Partenaire');
      const direction = item.direction || (item.is_sender ? 'sent' : 'received');
      const canRespond = item.can_respond || false;

      if (isInvitation) {
        return {
          id: `inv_received_${item.id}`,
          type: 'invitation',
          direction,
          projectTitle: item.incident_title || details?.title || 'Incident sans titre',
          projectImage: details?.thumbnail || details?.photo || item.incident_photo || item.incident_thumbnail || '',
          organisation: partnerName,
          organisationInitials: getInitials(partnerName),
          organisationColor: 'var(--color-warning)',
          applicantName: item.suggested_by_name || item.sender_name || 'Membre',
          applicantOrg: item.suggested_by_organisation || 'Organisation',
          role: (item.suggested_role === 'observer' || item.suggested_role === 'observateur') ? 'Observateur'
            : (item.suggested_role === 'leader') ? 'Leader' : 'Contributeur',
          motif: item.justification || item.motivation || 'Invitation en attente.',
          status: item.status || 'pending',
          submittedAt: item.created_at || new Date().toISOString(),
          respondedAt: item.updated_at || null,
          incidentId: item.incident,
          apiId: item.id,
          incidentDetails: details,
          incidentZone: item.incident_zone || details?.zone,
          incidentDescription: item.incident_description || details?.description,
          canRespond,
          organisationName: item.suggested_by_organisation || partnerName,
          userId: item.suggested_by || null
        };
      }

      return {
        id: `sug_received_${item.id}`,
        type: 'suggestion',
        direction,
        projectTitle: item.incident_title || details?.title || 'Incident sans titre',
        projectImage: details?.thumbnail || details?.photo || item.incident_photo || '',
        organisation: partnerName,
        organisationInitials: getInitials(partnerName),
        organisationColor: 'var(--color-primary)',
        suggestedBy: item.suggested_by_name || 'Leader',
        suggestedByOrg: item.suggested_by_organisation || 'Organisation',
        suggestionMessage: item.justification || 'Pas de message.',
        role: (item.suggested_role === 'observer' || item.suggested_role === 'observateur') ? 'Observateur' : 'Contributeur',
        status: item.status || 'pending',
        submittedAt: item.created_at || new Date().toISOString(),
        respondedAt: item.updated_at || null,
        incidentId: item.incident,
        apiId: item.id,
        incidentDetails: details,
        incidentZone: item.incident_zone || details?.zone,
        incidentDescription: item.incident_description || details?.description,
        canRespond,
        organisationName: item.suggested_partner_organisation || partnerName,
        userId: item.suggested_partner || null
      };
    });

    // Suggestions envoyées (j'ai créé ces suggestions → pas de boutons Accepter/Refuser)
    const sent = (sentSuggestions || []).map((item) => {
      const partnerName = item.suggested_partner_name || 'Partenaire';
      const details = item.incident_details;
      return {
        id: `sug_sent_${item.id}`,
        type: 'suggestion',
        direction: 'sent',
        projectTitle: item.incident_title || details?.title || 'Incident sans titre',
        projectImage: details?.thumbnail || details?.photo || item.incident_photo || '',
        organisation: partnerName,
        organisationInitials: getInitials(partnerName),
        organisationColor: 'var(--color-primary)',
        suggestedBy: item.suggested_by_name || 'Vous',
        suggestedByOrg: item.suggested_by_organisation || 'Mon Organisation',
        suggestionMessage: item.justification || 'Pas de message.',
        role: (item.suggested_role === 'observer' || item.suggested_role === 'observateur') ? 'Observateur' : 'Contributeur',
        status: item.status || 'pending',
        submittedAt: item.created_at || new Date().toISOString(),
        respondedAt: item.updated_at || null,
        incidentId: item.incident,
        apiId: item.id,
        incidentDetails: details,
        incidentZone: item.incident_zone || details?.zone,
        incidentDescription: item.incident_description || details?.description,
        canRespond: false,
        organisationName: item.suggested_partner_organisation || partnerName,
        userId: item.suggested_partner || null
      };
    });

    return [...received, ...sent]
      .map((r) => {
        if (r.apiId && statusOverrides[r.apiId]) {
          return { ...r, status: statusOverrides[r.apiId] };
        }
        return r;
      })
      .filter((r) => r.status !== 'accepted');
  }, [receivedSuggestions, sentSuggestions, statusOverrides]);

  // Merge WS (priorité aux données SWR quand elles existent)
  const swrApiIds = new Set(compiledRequests.map((r) => r.apiId).filter(Boolean));
  const allRequests = [
    ...wsRequests.filter((r) => !swrApiIds.has(r.apiId)),
    ...compiledRequests
  ];

  /* ── Filtrage ── */
  const q = search.trim().toLowerCase();
  const filtered = allRequests.filter((r) => {
    // Type filter
    if (typeFilter === 'suggestions' && r.type !== 'suggestion') return false;
    if (typeFilter === 'invitations' && r.type !== 'invitation') return false;

    // Status filter
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;

    // Recherche textuelle
    if (q) {
      return (
        (r.projectTitle || '').toLowerCase().includes(q) ||
        (r.organisation || '').toLowerCase().includes(q) ||
        (r.role || '').toLowerCase().includes(q) ||
        (r.applicantName || '').toLowerCase().includes(q) ||
        (r.applicantOrg || '').toLowerCase().includes(q) ||
        (r.suggestedByOrg || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  /* ── Decision handlers (suggestions uniquement) ── */
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

  const handleConfirmDecision = async (action) => {
    if (!decisionRequest || !action) return;
    setIsSubmittingDecision(true);
    setDecisionError(null);

    try {
      const suggestionId = decisionRequest.apiId;
      const incidentId = decisionRequest.incidentId;

      if (action === 'accept') {
        await acceptPartnerSuggestionService(incidentId, suggestionId);
      } else {
        await rejectPartnerSuggestionService(incidentId, suggestionId);
      }

      mutateSuggestions();
      mutateSentSuggestions();
      closeDecision();
    } catch (err) {
      logger.error('[Decision] Erreur:', err);
      setDecisionError(
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Une erreur est survenue."
      );
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  /* ── Render helpers ── */
  const canActOnRequest = (req) => {
    if (req.canRespond) return true;
    return false;
  };


  const renderRoleBadge = (role) => {
    const meta = getRoleMeta(role);
    const Icon = meta.icon;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '3px 8px', borderRadius: '4px',
        fontSize: 'var(--font-size-micro)', fontWeight: 600,
        color: meta.color,
        backgroundColor: `color-mix(in srgb, ${meta.color} 10%, transparent)`
      }}>
        <Icon size={13} variant="Bold" color="currentColor" style={{ color: meta.color }} />
        {meta.label}
      </span>
    );
  };

  /* ──────────────────── Render ──────────────────── */

  const content = hasError ? (
    <div className="collab-empty body-large text-center" style={{ padding: '40px 20px' }}>
      <p>Erreur lors du chargement des demandes.</p>
      <button
        className="btn btn-primary"
        onClick={() => { mutateSuggestions(); mutateSentSuggestions(); }}
      >
        Réessayer
      </button>
    </div>
  ) : (
    <>
      {/* Header */}
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
        onEffacer={() => { reinitialiserRecherche(); setStatusFilter('all'); setTypeFilter('all'); }}
        actifSupplementaire={statusFilter !== 'all' || typeFilter !== 'all'}
        resultats={filtered.length}
        nomResultat="suggestion"
      >
        {/* Filtre par type */}
        <div className="requests-filters">
          {TYPE_FILTERS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className={`requests-filter-pill ${typeFilter === key ? 'is-active' : ''}`}
              onClick={() => setTypeFilter(key)}
            >
              {Icon && <Icon size={14} variant="Bold" color="currentColor" style={{ color: 'currentColor' }} />}
              {label}
            </button>
          ))}
        </div>
        {/* Filtre par statut */}
        <div className="requests-filters">
          {STATUS_FILTERS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className={`requests-filter-pill ${statusFilter === key ? 'is-active' : ''}`}
              onClick={() => setStatusFilter(key)}
            >
              {Icon && <Icon size={14} variant="Bold" color="currentColor" style={{ color: 'currentColor' }} />}
              {label}
            </button>
          ))}
        </div>
      </FiltersBar>
      </div>


      {/* Info banner */}
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
                <strong>2. Prise en charge par un Leader :</strong> Dès qu'une organisation prend en charge le signalement en tant que <strong>Leader</strong>, toutes les contributions existantes repassent en statut <strong>« En attente »</strong> pour validation manuelle. Les observateurs restent actifs.
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

      {/* List */}
      {isLoading ? (
        <CardSkeleton />
      ) : filtered.length === 0 ? (
        <div className="requests-empty">
          <p className="body-large" style={{ color: 'var(--color-text-primary)' }}>
            Aucune demande ne correspond à vos critères.
          </p>
        </div>
      ) : (
        <div className="incident-centric-list">
          {filtered.map((req) => {
            const meta = STATUS_META[req.status];
            const isSuggestion = req.type === 'suggestion';
            const showActions = canActOnRequest(req) && req.status === 'pending';
            const imgUrl = req.projectImage ? getStableImageUrl(req.apiId || req.id, req.projectImage) : '';

            return (
              <section key={req.id} className="incident-group-card">
                <header className="incident-group-header" onClick={estTelephone ? () => setSelectedIncident(req) : undefined}>
                  {/* Thumbnail */}
                  <div
                    className="incident-group-thumb"
                    style={imgUrl ? { backgroundImage: `url("${imgUrl}")` } : {}}
                  >
                    {meta && (
                      <span style={{
                        position: 'absolute', top: '8px', left: '8px',
                        padding: '3px 8px', borderRadius: '4px',
                        fontSize: 'var(--font-size-micro)', fontWeight: 'bold', textTransform: 'uppercase',
                        color: 'var(--color-surface)', backgroundColor: meta.color,
                        boxShadow: '0 2px 6px rgba(var(--rgb-ombre),0.15)'
                      }}>
                        {meta.label}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="incident-group-title-section">
                    {/* Type + date */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: 'var(--font-size-caption)' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '2px 8px', borderRadius: '4px',
                        fontSize: 'var(--font-size-micro)', fontWeight: 600,
                        color: isSuggestion ? 'var(--color-primary)' : 'var(--color-warning)',
                        backgroundColor: isSuggestion ? 'rgba(var(--rgb-primary),0.1)' : 'rgba(var(--rgb-warning),0.1)'
                      }}>
                        {isSuggestion
                          ? <><MessageText1 size={12} variant="Bold" color="currentColor" style={{ color: 'var(--color-primary-text)' }} /> Suggestion</>
                          : <><Import size={12} variant="Bold" color="currentColor" style={{ color: 'var(--color-warning-text)' }} /> Invitation</>
                        }
                      </span>
                      <span style={{ color: 'var(--color-text-muted)' }}>•</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-secondary)' }}>
                        <Calendar size={12} variant="Bold" color="currentColor" style={{ color: 'var(--color-text-secondary)' }} />
                        {formatDate(req.submittedAt)}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="incident-group-title" style={{ margin: 0, fontSize: 'var(--font-size-body-large)', fontWeight: 700 }}>
                      {req.projectTitle}
                    </h3>

                    {/* Description line */}
                    <p style={{
                      margin: 0, fontSize: 'var(--font-size-body-small)', color: 'var(--color-text-secondary)',
                      lineHeight: 1.5, display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                    }}>
                      {isSuggestion
                        ? (req.direction === 'sent'
                          ? <>Vous avez suggéré <strong>{req.organisation}</strong> — « {req.suggestionMessage} »</>
                          : <><strong>{req.suggestedByOrg}</strong> vous suggère d'intervenir — « {req.suggestionMessage} »</>
                        )
                        : <>{req.direction === 'sent'
                          ? <>Vous avez envoyé une demande à <strong>{req.organisation}</strong></>
                          : <><strong>{req.applicantOrg || req.organisation}</strong> souhaite collaborer</>
                        }</>
                      }
                    </p>

                    {/* Badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                      {renderRoleBadge(req.role)}

                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '3px 8px', borderRadius: '4px',
                        fontSize: 'var(--font-size-micro)', fontWeight: 600,
                        color: 'var(--color-text-secondary)',
                        backgroundColor: 'rgba(var(--rgb-text-secondary),0.08)'
                      }}>
                        <Building size={13} variant="Bold" color="currentColor" style={{ color: 'var(--color-text-secondary)' }} />
                        {req.organisationName || req.organisation}
                      </span>

                      {req.incidentDetails?.zone && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '3px 8px', borderRadius: '4px',
                          fontSize: 'var(--font-size-micro)', fontWeight: 600,
                          color: 'var(--color-text-secondary)',
                          backgroundColor: 'rgba(var(--rgb-text-secondary),0.08)'
                        }}>
                          <Location size={12} variant="Bold" color="currentColor" style={{ color: 'var(--color-text-secondary)' }} />
                          {req.incidentDetails.zone}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="incident-group-summary-side" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {showActions && (
                      <>
                        <button
                          type="button"
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 12px', borderRadius: '6px',
                            backgroundColor: 'var(--color-success)', color: 'var(--color-surface)',
                            border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 'var(--font-size-caption)'
                          }}
                          onClick={(e) => { e.stopPropagation(); openDecision(req, 'accept'); }}
                        >
                          <TickCircle size={14} variant="Bold" color="currentColor" style={{ color: 'var(--color-surface)' }} />
                          Accepter
                        </button>
                        <button
                          type="button"
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 12px', borderRadius: '6px',
                            backgroundColor: 'var(--color-danger)', color: 'var(--color-surface)',
                            border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: 'var(--font-size-caption)'
                          }}
                          onClick={(e) => { e.stopPropagation(); openDecision(req, 'reject'); }}
                        >
                          <CloseSquare size={14} variant="Bold" color="currentColor" style={{ color: 'var(--color-surface)' }} />
                          Refuser
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      className="incident-group-toggle"
                      onClick={() => setSelectedIncident(req)}
                      aria-label="Voir détails"
                      title="Voir l'incident"
                    >
                      <ArrowRight2 size={18} variant="Linear" color="var(--color-text-secondary)" />
                    </button>
                  </div>
                </header>
              </section>
            );
          })}
        </div>
      )}

      {/* Decision Modal */}
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
      {selectedIncident && (
        <RequestIncidentDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
        />
      )}
    </>
  );

  if (embedded) return content;

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

export default SuggestRequests;