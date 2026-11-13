import React, { useState, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { Add, Edit2, Trash, SearchNormal1, ArrowDown2, Profile2User, Call, Filter } from 'iconsax-react';
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
import { useEstTelephone } from '../incident/mobile/useEstTelephone';
import { FeuilleBasse } from '../collaboration/mobile/FeuilleBasse';
import { ChargerPlus } from '../incident/mobile/ChargerPlus';
import './agents-liste.css';
import '../organisations/mobile/annuaire-mobile.css';

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
  const estTelephone = useEstTelephone();
  const [fiche, setFiche] = useState(null);
  const [codeVisible, setCodeVisible] = useState(false);
  const [filtresOuverts, setFiltresOuverts] = useState(false);
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
    openEdit,
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

  // Téléphone : rôle et statut vivent tous deux dans la feuille Filtres.
  const nbFiltresTelephone = (roleFilter ? 1 : 0) + (statusFilter ? 1 : 0);
  const effacerFiltres = () => { setRoleFilter(''); setStatusFilter(''); };
  const libelleRoleFiltre = roleFilter === 'admin' ? 'Admins' : ROLES.find((r) => r.id === roleFilter)?.onglet;
  const libelleStatutFiltre = statusFilter === 'active' ? 'Actifs' : statusFilter === 'inactive' ? 'Inactifs' : '';
  const totalTelephone = isLoading && !fetchedAgents
    ? 'Chargement…'
    : nbFiltresTelephone || search
      ? `${nombreFr(total)} agent${total > 1 ? 's' : ''}`
      : statsData
        ? `${nombreFr(statsData.total)} agent${statsData.total > 1 ? 's' : ''} · ${nombreFr(statsData.active)} actif${statsData.active > 1 ? 's' : ''}`
        : `${nombreFr(total)} agent${total > 1 ? 's' : ''}`;
  const ouvrirFiche = (a) => { setCodeVisible(false); setFiche(a); };

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
          {!estTelephone && <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} sidebarCollapsed={sidebarCollapsed} />}

          <main className="ag" onScroll={surDefilement}>
            {/* Sur téléphone, l'erreur descend du haut de l'écran en alerte flottante. */}
            {estTelephone ? erreurAgents && (
              <div className="sgm-erreur">
                <BandeauErreur erreur={erreurAgents} onReessayer={mutateAgents} message="Impossible de charger les agents. La liste affichée peut ne plus être à jour." />
              </div>
            ) : (
              <BandeauErreur
                erreur={erreurAgents}
                onReessayer={mutateAgents}
                message="Impossible de charger les agents. La liste affichée peut ne plus être à jour."
              />
            )}

            {/* L'en-tête de la page — titre, onglets, recherche et filtre — reste
                fixe au défilement : seul le tableau passe dessous. */}
            <div ref={repereRef} aria-hidden="true" className="ag-repere" />
            <div className={`ag-entete ${colle ? 'is-colle' : ''}`}>
              <div className="ag-tete">
                <div>
                  <h1>Agents</h1>
                  {estTelephone
                    ? <p className="anm-total">{totalTelephone}</p>
                    : <p>Les personnes qui ont accès à Map Action, sur le terrain et au bureau.</p>}
                </div>
                <button type="button" className="ag-btn-p" onClick={openCreate} aria-label={isMobile ? 'Nouvel agent' : undefined}>
                  <Add size={18} color="currentColor" />
                  {!isMobile && 'Nouvel agent'}
                </button>
              </div>

              {!estTelephone && <div className={isMobile ? 'ag-roles-pastilles' : 'ag-roles'} role="tablist" aria-label="Rôle">
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
              </div>}

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
                {estTelephone && (
                  <button type="button" className={`vlm-filtre ${nbFiltresTelephone ? 'is-on' : ''}`} onClick={() => setFiltresOuverts(true)} aria-label={`Filtres${nbFiltresTelephone ? `, ${nbFiltresTelephone} actif${nbFiltresTelephone > 1 ? 's' : ''}` : ''}`}>
                    <Filter size={18} color="currentColor" aria-hidden="true" />
                    {nbFiltresTelephone > 0 && <span className="vlm-filtre-n" aria-hidden="true">{nbFiltresTelephone}</span>}
                  </button>
                )}
                {!isMobile && <span className="ag-annonce" role="status">{annonce}</span>}
              </div>

              {estTelephone && nbFiltresTelephone > 0 && (
                <div className="sgm-resume vlm-resume anm-resume">
                  {roleFilter && (
                    <button type="button" className="sgm-puce" onClick={() => setRoleFilter('')} aria-label={`Retirer le filtre ${libelleRoleFiltre}`}>
                      {libelleRoleFiltre}<i aria-hidden="true">×</i>
                    </button>
                  )}
                  {statusFilter && (
                    <button type="button" className="sgm-puce" onClick={() => setStatusFilter('')} aria-label={`Retirer le filtre ${libelleStatutFiltre}`}>
                      {libelleStatutFiltre}<i aria-hidden="true">×</i>
                    </button>
                  )}
                </div>
              )}
              {estTelephone && <p className="ag-annonce anm-annonce" role="status">{annonce}</p>}
            </div>

            {vide ? (
              <div className="ag-boite ag-vide">
                <span className="ag-vide-ic"><Profile2User size={22} color="currentColor" /></span>
                <b>Aucun agent</b>
                <p>{filtreActif || roleFilter ? 'Aucun résultat avec ces critères. Modifiez la recherche ou le filtre.' : 'Ajoutez le premier agent de l’équipe : il recevra un code pour se connecter.'}</p>
                {!filtreActif && !roleFilter && <button type="button" className="ag-btn-p" onClick={openCreate}><Add size={18} color="currentColor" />Nouvel agent</button>}
                {estTelephone && nbFiltresTelephone > 0 && <button type="button" className="sgm-vide-effacer" onClick={effacerFiltres}>Effacer les filtres</button>}
              </div>
            ) : estTelephone ? (
              <>
                <ul className="anm-liste">
                  {chargementInitial ? [0, 1, 2, 3].map((n) => (
                    <li key={n} className="anm-squelette anm-squelette-ligne" aria-hidden="true"><i /><span><span /><span /></span></li>
                  )) : pageAgents.map((a) => (
                    <li key={a.id} className="anm-rang">
                      <button type="button" className="anm-ligne" onClick={() => ouvrirFiche(a)}>
                        <AvatarAgent agent={a} taille={44} />
                        <span className="anm-t">
                          <b>{a.fullName}</b>
                          <span>{ROLES.find((r) => r.id === a.role)?.label}{a.phone ? '' : ' · pas de numéro'}</span>
                          {a.status === 'inactive' && <span className="anm-inactif">Inactif</span>}
                        </span>
                        {!a.phone && <span className="anm-chevron" aria-hidden="true">›</span>}
                      </button>
                      {/* Appeler est le geste le plus fréquent : un toucher depuis la ligne. */}
                      {a.phone && (
                        <a className="anm-appeler" href={telLien(a.phone)} aria-label={`Appeler ${a.fullName} au ${formatTelephone(a.phone)}`}>
                          <Call size={18} variant="Bold" color="currentColor" aria-hidden="true" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
                {nbVisibles < total && (
                  <ChargerPlus chargement={false} onPlus={() => setNbVisibles((n) => n + TAILLE_PAGE)} reste={Math.min(TAILLE_PAGE, total - nbVisibles)} nom="agents" />
                )}
              </>
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

        {fiche && (
          <FeuilleBasse ariaLabel={fiche.fullName} onClose={() => setFiche(null)}>
            <div className="anm-fiche">
              <div className="anm-fiche-tete">
                <AvatarAgent agent={fiche} taille={52} />
                <div>
                  <h2>{fiche.fullName}</h2>
                  <span>{ROLES.find((r) => r.id === fiche.role)?.label} · {fiche.status === 'active' ? 'Actif' : 'Inactif'}</span>
                </div>
              </div>
              {fiche.phone && <a className="vlm-btn anm-appel" href={telLien(fiche.phone)}>Appeler le {formatTelephone(fiche.phone)}</a>}
              <div className="anm-bloc">
                {fiche.email && (
                  <div className="anm-kv"><span>E-mail</span><a href={`mailto:${fiche.email}`}>{fiche.email}</a></div>
                )}
                {/* Le code de connexion reste masqué tant qu'on ne le demande pas. */}
                {fiche.agentCode && (
                  <div className="anm-kv">
                    <span>Code d’accès</span>
                    <span className="anm-code">
                      <b>{codeVisible ? fiche.agentCode : '••••••'}</b>
                      <button type="button" onClick={() => setCodeVisible((v) => !v)} aria-pressed={codeVisible}>{codeVisible ? 'Masquer' : 'Afficher'}</button>
                    </span>
                  </div>
                )}
                {[['Adresse', fiche.address], ['Organisation', fiche.organisationName], ['Dans l’équipe depuis', formatDateLongue(fiche.joinedAt)]]
                  .filter(([, v]) => v)
                  .map(([k, v]) => <div key={k} className="anm-kv"><span>{k}</span><b>{v}</b></div>)}
              </div>
              {(peutModifier(fiche) || peutSupprimer(fiche)) && (
                <div className="anm-duo">
                  {peutModifier(fiche) && <button type="button" className="vlm-btn vlm-btn-g" onClick={() => { const a = fiche; setFiche(null); openEdit(a); }}>Modifier</button>}
                  {peutSupprimer(fiche) && <button type="button" className="vlm-btn vlm-btn-g anm-danger" onClick={() => { const a = fiche; setFiche(null); openDelete(a); }}>Retirer de l’équipe</button>}
                </div>
              )}
            </div>
          </FeuilleBasse>
        )}

        {filtresOuverts && (
          <FeuilleBasse ariaLabel="Filtres" onClose={() => setFiltresOuverts(false)}>
            <header className="sgm-filtres-tete">
              <button type="button" className="sgm-lien" onClick={effacerFiltres}>Tout effacer</button>
              <h2>Filtres</h2>
              <button type="button" className="sgm-fermer" onClick={() => setFiltresOuverts(false)} aria-label="Fermer les filtres">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </header>
            <div className="sgm-filtres-corps vlm-filtres-corps">
              <div>
                <h3 id="anm-titre-role">Rôle</h3>
                <div className="sgm-segs" role="radiogroup" aria-labelledby="anm-titre-role">
                  {onglets.map((r) => (
                    <button key={r.id || 'tous'} type="button" role="radio" aria-checked={roleFilter === r.id} onClick={() => setRoleFilter(r.id)}>
                      {r.id === 'admin' ? 'Admins' : r.onglet}
                      {compteurs[r.id] !== undefined && <small className="anm-seg-n">{nombreFr(compteurs[r.id])}</small>}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <h3 id="anm-titre-statut">Statut</h3>
                <div className="sgm-segs sgm-segs-3" role="radiogroup" aria-labelledby="anm-titre-statut">
                  {[['', 'Tous'], ['active', 'Actifs'], ['inactive', 'Inactifs']].map(([v, l]) => (
                    <button key={v || 'tous'} type="button" role="radio" aria-checked={statusFilter === v} onClick={() => setStatusFilter(v)}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <footer className="sgm-filtres-pied">
              <button type="button" className="sgm-voir" onClick={() => setFiltresOuverts(false)}>
                {isLoading ? 'Voir les agents' : `Voir ${nombreFr(total)} agent${total > 1 ? 's' : ''}`}
              </button>
            </footer>
          </FeuilleBasse>
        )}

        <AgentFormModal />
        <AgentDeleteModal />
        {toast && <div key={toast.n} className="ag-toast" role="status">{toast.texte}</div>}
      </div>
    </AgentsContext.Provider>
  );
};

export default Agents;
