import React, { useState, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { Add, Edit2, Trash, SearchNormal1, ArrowDown2, Profile2User, Call } from 'iconsax-react';
import { ShimmerThumbnail, ShimmerText } from 'react-shimmer-effects';
import { useSidebarState } from '../../hooks/useSidebarState';
import { useRechercheDebouncee } from '../../hooks/useRechercheDebouncee';
import { useReinitialisationSurChangement } from '../../hooks/useReinitialisationSurChangement';
import { Header, Sidebar } from '../../components/layout';
import Pagination from '../../components/molecules/Pagination';
import { TableActionsMenu } from '../../components/molecules/TableActionsMenu';
import { BandeauErreur } from '../../components/molecules/BandeauErreur';
import { getOrganisationsService } from '../organisations/service/organisation_service';
import { getTousLesAgentsService, getAgentsStatsService } from './service/members_service';
import AgentsContext from './modale/AgentsModalContext';
import { AgentFormModal, AgentDeleteModal } from './modale';
import { ROLES, roleDepuisApi } from './roles';
import { AvatarAgent, RoleAgent } from './components/AgentIdentity';
import { formatTelephone, telLien, formatDateLongue } from './format';
import { authService } from '../auth/services/authService';
import { AVATAR_COLORS, AVATAR_COULEUR_DEFAUT } from '../../utils/couleursAvatar';
import { logger } from '../../utils/logger';
import './agents-liste.css';

const EMPTY_ARRAY = [];
const TAILLE_PAGE = 20;

const STATUTS = [
  { valeur: 'active', libelle: 'Actif' },
  { valeur: 'inactive', libelle: 'Inactif' },
];

const nombreFr = (n) => (n ?? 0).toLocaleString('fr-FR');

/** Couleur stable d'un agent, tirée de son identifiant. */
const couleurDepuisId = (id) => {
  if (!id) return AVATAR_COULEUR_DEFAUT;
  let hash = 0;
  for (let i = 0; i < String(id).length; i++) {
    hash = String(id).charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] || AVATAR_COULEUR_DEFAUT;
};

const versAgent = (m) => ({
  id: m.id,
  firstName: m.first_name || '',
  lastName: m.last_name || '',
  fullName: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email,
  email: m.email,
  phone: m.phone || '',
  agentCode: m.agent_code || '',
  address: m.address || '',
  role: roleDepuisApi(m.org_role),
  organisationId: m.organisation_member || m.organisation || '',
  organisationName: m.organisation_name || '',
  avatar: m.avatar || '',
  status: m.is_active ? 'active' : 'inactive',
  avatarColor: couleurDepuisId(m.id),
  joinedAt: m.date_joined || null,
});

const fetcher = async ([, search, role, status]) => {
  try {
    const membres = await getTousLesAgentsService(search, role, status);
    // Les plus récents d'abord.
    return membres.map(versAgent).sort((a, b) => new Date(b.joinedAt || 0) - new Date(a.joinedAt || 0));
  } catch (err) {
    logger.error('[Agents] Erreur lors de la récupération des agents:', err);
    throw err;
  }
};

export const Agents = () => {
  const currentUser = authService.getCurrentUser();
  const estSuperAdmin = currentUser?.web_role === 'super_admin';
  const {
    isOpen: sidebarOpen,
    setOpen: setSidebarOpen,
    isCollapsed: sidebarCollapsed,
    setCollapsed: setSidebarCollapsed,
  } = useSidebarState();

  const { saisie: searchInput, setSaisie: setSearchInput, recherche: search } = useRechercheDebouncee();
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  // Sur mobile, la liste s'allonge au lieu de changer de page.
  const [nbVisibles, setNbVisibles] = useState(TAILLE_PAGE);

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767.98px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767.98px)');
    const maj = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);

  // L'en-tête de la page reste collé sous celui de l'application au
  // défilement ; une ombre légère n'apparaît qu'une fois collé.
  const repereRef = useRef(null);
  const [colle, setColle] = useState(false);
  const surDefilement = (e) => {
    const repere = repereRef.current;
    if (repere) setColle(e.currentTarget.scrollTop > repere.offsetTop - 60);
  };

  // Retour au début de la liste dès qu'un filtre change.
  useReinitialisationSurChangement([search, roleFilter, statusFilter], () => {
    setPage(1);
    setNbVisibles(TAILLE_PAGE);
  });

  // Les organisations ne servent qu'au formulaire de création du
  // super-administrateur : la liste des agents ne les attend pas.
  const { data: rawOrgs } = useSWR(estSuperAdmin ? 'organisations_formulaire_agent' : null, () => getOrganisationsService());
  const organisationsList = useMemo(() => rawOrgs?.results || (Array.isArray(rawOrgs) ? rawOrgs : EMPTY_ARRAY), [rawOrgs]);

  const { data: statsData, mutate: mutateStats } = useSWR('agents_stats', getAgentsStatsService);

  const {
    data: fetchedAgents,
    error: erreurAgents,
    isLoading,
    mutate: mutateAgents,
  } = useSWR(['agents_list', search, roleFilter, statusFilter], fetcher, { keepPreviousData: true });

  const agents = fetchedAgents || EMPTY_ARRAY;
  const total = agents.length;

  const compteurs = {
    '': statsData?.total,
    terrain: statsData?.field_agents,
    bureau: statsData?.bureau_agents,
    admin: statsData?.admins,
  };
  const onglets = [{ id: '', onglet: 'Tous' }, ...ROLES];

  // ── Droits ───────────────────────────────────────────────────
  // Un agent de bureau ne peut ni modifier ni supprimer un administrateur.
  //
  // Les trois orthographes testées ci-dessous sont conservées telles quelles :
  // seule la valeur `super_admin` a été observée en réponse réelle de l'API, et
  // normaliser sans avoir vu un compte `bureau_agent` reviendrait à parier sur
  // les droits en production.
  const estAgentDeBureau = currentUser?.web_role === 'bureau_agent'
    || currentUser?.web_role === 'bureau'
    || currentUser?.web_role === 'agent_de_bureau';

  const peutModifier = (agent) => !(estAgentDeBureau && agent?.role === 'admin');
  const peutSupprimer = (agent) => !estAgentDeBureau || agent?.role === 'terrain';

  // ── Fenêtres ─────────────────────────────────────────────────
  const [formModal, setFormModal] = useState({ open: false, mode: 'create', agent: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, agent: null });

  const [toast, setToast] = useState(null);
  const afficherToast = (texte) => setToast({ texte, n: Date.now() });

  const openCreate = () => setFormModal({ open: true, mode: 'create', agent: null });
  const openEdit = (agent) => { if (peutModifier(agent)) setFormModal({ open: true, mode: 'edit', agent }); };
  const closeFormModal = () => setFormModal({ open: false, mode: 'create', agent: null });
  const openDelete = (agent) => { if (peutSupprimer(agent)) setDeleteModal({ open: true, agent }); };
  const closeDeleteModal = () => setDeleteModal({ open: false, agent: null });

  const contextValue = {
    formModal,
    closeFormModal,
    deleteModal,
    closeDeleteModal,
    afficherToast,
    mutateAgents: () => {
      mutateAgents();
      mutateStats();
    },
    organisationsList,
  };

  const actionsDe = (agent) => {
    const actions = [
      peutModifier(agent) && { id: 'edit', label: 'Modifier', icon: Edit2, onSelect: () => openEdit(agent) },
      peutSupprimer(agent) && { id: 'delete', label: 'Retirer de l’équipe', icon: Trash, tone: 'danger', onSelect: () => openDelete(agent) },
    ].filter(Boolean);
    return actions.length > 0
      ? <TableActionsMenu ariaLabel={`Actions sur ${agent.fullName}`} actions={actions} />
      : null;
  };

  const filtreActif = Boolean(search || statusFilter);
  const annonce = isLoading && !fetchedAgents
    ? 'Chargement…'
    : filtreActif
      ? `${nombreFr(total)} résultat${total > 1 ? 's' : ''}`
      : statsData && !roleFilter
        ? `${nombreFr(statsData.total)} agent${statsData.total > 1 ? 's' : ''} · ${nombreFr(statsData.active)} actif${statsData.active > 1 ? 's' : ''}`
        : `${nombreFr(total)} agent${total > 1 ? 's' : ''}`;

  const pageAgents = isMobile
    ? agents.slice(0, nbVisibles)
    : agents.slice((page - 1) * TAILLE_PAGE, page * TAILLE_PAGE);
  const chargementInitial = isLoading && !fetchedAgents;
  const vide = !chargementInitial && agents.length === 0;
  const nbColonnes = estSuperAdmin ? 7 : 6;

  return (
    <AgentsContext.Provider value={contextValue}>
      <div className="agents-layout">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />

        <div className={`agents-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} sidebarCollapsed={sidebarCollapsed} />

          <main className="ag" onScroll={surDefilement}>
            <BandeauErreur
              erreur={erreurAgents}
              onReessayer={mutateAgents}
              message="Impossible de charger les agents. La liste affichée peut ne plus être à jour."
            />

            {/* L'en-tête de la page — titre, onglets, recherche et filtre — reste
                fixe au défilement : seul le tableau passe dessous. */}
            <div ref={repereRef} aria-hidden="true" className="ag-repere" />
            <div className={`ag-entete ${colle ? 'is-colle' : ''}`}>
              <div className="ag-tete">
                <div>
                  <h1>Agents</h1>
                  <p>Les personnes qui ont accès à Map Action, sur le terrain et au bureau.</p>
                </div>
                <button type="button" className="ag-btn-p" onClick={openCreate} aria-label={isMobile ? 'Nouvel agent' : undefined}>
                  <Add size={18} color="currentColor" />
                  {!isMobile && 'Nouvel agent'}
                </button>
              </div>

              <div className={isMobile ? 'ag-roles-pastilles' : 'ag-roles'} role="tablist" aria-label="Rôle">
                {onglets.map((r) => {
                  const actif = roleFilter === r.id;
                  const n = compteurs[r.id];
                  return (
                    <button key={r.id || 'tous'} type="button" role="tab" aria-selected={actif} className={actif ? 'is-on' : ''} onClick={() => setRoleFilter(r.id)}>
                      {r.onglet}
                      {n !== undefined && (isMobile ? ` ${nombreFr(n)}` : <span className="ag-n">{nombreFr(n)}</span>)}
                    </button>
                  );
                })}
              </div>

              <div className="ag-outils">
                <label className="ag-recherche">
                  <SearchNormal1 size={16} color="currentColor" aria-hidden="true" />
                  <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Nom ou e-mail" aria-label="Rechercher un agent" />
                </label>
                {!isMobile && (
                  <label className={`ag-filtre ${statusFilter ? 'is-on' : ''}`}>
                    <span aria-hidden="true">Statut : {STATUTS.find((s) => s.valeur === statusFilter)?.libelle.toLowerCase() || 'tous'}</span>
                    <ArrowDown2 size={14} color="currentColor" aria-hidden="true" />
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrer par statut">
                      <option value="">Statut : tous</option>
                      {STATUTS.map((s) => <option key={s.valeur} value={s.valeur}>{s.libelle}</option>)}
                    </select>
                  </label>
                )}
                {!isMobile && <span className="ag-annonce" role="status">{annonce}</span>}
              </div>
            </div>

            {vide ? (
              <div className="ag-boite ag-vide">
                <span className="ag-vide-ic"><Profile2User size={22} color="currentColor" /></span>
                <b>Aucun agent</b>
                <p>{filtreActif || roleFilter ? 'Aucun résultat avec ces critères. Modifiez la recherche ou le filtre.' : 'Ajoutez le premier agent de l’équipe : il recevra un code pour se connecter.'}</p>
                {!filtreActif && !roleFilter && <button type="button" className="ag-btn-p" onClick={openCreate}><Add size={18} color="currentColor" />Nouvel agent</button>}
              </div>
            ) : isMobile ? (
              <div className="ag-cartes">
                {chargementInitial ? [0, 1, 2].map((n) => <div key={n} className="ag-carte"><ShimmerText line={3} gap={8} /></div>) : pageAgents.map((a) => (
                  <article key={a.id} className={`ag-carte ${a.status === 'inactive' ? 'is-inactif' : ''}`}>
                    <div className="ag-carte-tete">
                      <AvatarAgent agent={a} taille={42} />
                      <span className="ag-carte-t">
                        <b>{a.fullName}</b>
                        <span>{`${a.role ? ROLES.find((r) => r.id === a.role)?.label : ''} · ${a.status === 'active' ? 'Actif' : 'Inactif'}`}</span>
                      </span>
                      {actionsDe(a)}
                    </div>
                    {a.phone && (
                      <div className="ag-carte-pied">
                        <a className="ag-appeler" href={telLien(a.phone)}>
                          <Call size={15} color="currentColor" aria-hidden="true" />
                          Appeler le {formatTelephone(a.phone)}
                        </a>
                      </div>
                    )}
                  </article>
                ))}
                {nbVisibles < total && (
                  <button type="button" className="ag-plus" onClick={() => setNbVisibles((n) => n + TAILLE_PAGE)}>Afficher plus</button>
                )}
              </div>
            ) : (
              <div className="ag-boite ag-tableau-boite">
                <table className="ag-tableau">
                  <thead>
                    <tr>
                      <th scope="col">Agent</th>
                      <th scope="col">Rôle</th>
                      <th scope="col">Téléphone</th>
                      {estSuperAdmin && <th scope="col">Organisation</th>}
                      <th scope="col">Dans l'équipe depuis</th>
                      <th scope="col">Statut</th>
                      <th scope="col"><span className="ag-masque">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {chargementInitial ? [0, 1, 2, 3, 4].map((n) => (
                      <tr key={n}><td colSpan={nbColonnes}><div className="ag-squelette"><ShimmerThumbnail height={38} width={38} rounded className="m-0" /><div style={{ flex: 1 }}><ShimmerText line={2} gap={8} /></div></div></td></tr>
                    )) : pageAgents.map((a) => (
                      <tr key={a.id} className={`ag-ligne ${a.status === 'inactive' ? 'is-inactif' : ''}`}>
                        <td>
                          <div className="ag-agent">
                            <AvatarAgent agent={a} />
                            <div>
                              <b>{a.fullName}</b>
                              <span>{a.email}</span>
                            </div>
                          </div>
                        </td>
                        <td><RoleAgent role={a.role} /></td>
                        <td>{a.phone ? <a className="ag-tel" href={telLien(a.phone)}>{formatTelephone(a.phone)}</a> : <span className="ag-absent">—</span>}</td>
                        {estSuperAdmin && <td className="ag-doux">{a.organisationName || '—'}</td>}
                        <td className="ag-doux ag-date">{formatDateLongue(a.joinedAt) || '—'}</td>
                        <td><span className={`ag-statut is-${a.status}`}><i aria-hidden="true" />{a.status === 'active' ? 'Actif' : 'Inactif'}</span></td>
                        <td className="ag-actions">{actionsDe(a)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!vide && !isMobile && total > TAILLE_PAGE && (
              <div className="ag-pied">
                <span>{`${(page - 1) * TAILLE_PAGE + 1}–${Math.min(page * TAILLE_PAGE, total)} sur ${nombreFr(total)}`}</span>
                <Pagination page={page} pageSize={TAILLE_PAGE} count={total} onChange={setPage} />
              </div>
            )}
          </main>
        </div>

        <AgentFormModal />
        <AgentDeleteModal />
        {toast && <div key={toast.n} className="ag-toast" role="status">{toast.texte}</div>}
      </div>
    </AgentsContext.Provider>
  );
};

export default Agents;
