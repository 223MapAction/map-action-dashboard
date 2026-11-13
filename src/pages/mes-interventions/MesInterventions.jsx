import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import useSWRInfinite from 'swr/infinite';
import { SearchNormal1, ArrowDown2, Eye, People, UserAdd, DocumentText, Location, Briefcase, Filter } from 'iconsax-react';
import { ShimmerThumbnail, ShimmerText } from 'react-shimmer-effects';
import { useRechercheDebouncee } from '../../hooks/useRechercheDebouncee';
import { useReinitialisationSurChangement } from '../../hooks/useReinitialisationSurChangement';
import { useSidebarState } from '../../hooks/useSidebarState';
import { Header, Sidebar } from '../../components/layout';
import { BlurryImage } from '../../components/atoms/BlurryImage';
import Pagination from '../../components/molecules/Pagination';
import { TableActionsMenu } from '../../components/molecules/TableActionsMenu';
import { BandeauErreur } from '../../components/molecules/BandeauErreur';
import { AgentReportsModal } from '../collaboration-detail/modal/AgentReportsModal';
import { MesInterventionsModalProvider } from './MesInterventionsModalContext';
import { useMesInterventionsModalContext } from './mesInterventionsModalContexte';
import { MesInterventionsAssignModal } from './modal/MesInterventionsAssignModal';
import { IncidentAgentsListModal } from './modal/IncidentAgentsListModal';
import { getOrgInternalIncidentsService } from './service/mes_interventions_service';
import { versIntervention } from './format';
import '../collaboration-detail/modal/modales.css';
import { useEstTelephone } from '../incident/mobile/useEstTelephone';
import { FeuilleActions } from '../incident/mobile/FeuilleActions';
import { FeuilleBasse } from '../collaboration/mobile/FeuilleBasse';
import { ChargerPlus } from '../incident/mobile/ChargerPlus';
import './mes-interventions-liste.css';
import './mes-interventions-mobile.css';

const TAILLE_PAGE = 20;

// Valeurs `status` attendues par /org-incidents/.
const STATUTS = [
  { valeur: '', libelle: 'Toutes' },
  { valeur: 'taken_into_account', libelle: 'En cours' },
  { valeur: 'resolved', libelle: 'Terminées' },
];

const ORIGINES = [
  { valeur: 'agents_or_internal', libelle: 'agents et internes' },
  { valeur: 'internal', libelle: 'internes' },
  { valeur: 'agents', libelle: 'agents' },
];

const nombreFr = (n) => (n ?? 0).toLocaleString('fr-FR');

/** Pastille d'état d'un signalement. */
const Etat = ({ etat }) => (
  <span className={`mi-statut ${etat.classe}`}><i aria-hidden="true" />{etat.libelle}</span>
);

/** Barre d'avancement et, dessous, la date de résolution s'il y en a une. */
const Avancement = ({ intervention: i }) => (
  <div className="mi-avancement">
    <div className="mi-avancement-ligne">
      <span
        className={`mi-barre ${i.etat.classe}`}
        role="progressbar"
        aria-valuenow={i.avancement}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Avancement"
      >
        <span style={{ width: `${i.avancement}%` }} />
      </span>
      <b>{i.avancement} %</b>
    </div>
    {i.resoluLe
      ? <span className="mi-fin is-resolu">Résolu le {i.resoluLe}</span>
      : <span className="mi-fin">Pas encore résolu</span>}
  </div>
);

const Contenu = () => {
  const navigate = useNavigate();
  const estTelephone = useEstTelephone();
  const [menu, setMenu] = useState(null);
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const {
    isOpen: sidebarOpen,
    setOpen: setSidebarOpen,
    isCollapsed: sidebarCollapsed,
    setCollapsed: setSidebarCollapsed,
  } = useSidebarState();

  const {
    openAssignModal, openAgentsModal, openReportsModal, reportsModal, closeReportsModal,
    setMutateIncidents, toast,
  } = useMesInterventionsModalContext();

  const { saisie: searchInput, setSaisie: setSearchInput, recherche: search } = useRechercheDebouncee();
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('agents_or_internal');
  const [page, setPage] = useState(1);

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

  useReinitialisationSurChangement([search, statusFilter, sourceFilter], () => setPage(1));

  // L'équipe de chaque intervention n'est plus chargée ici : c'était un appel
  // par ligne, vingt de plus à chaque page. Elle l'est à l'ouverture de sa
  // fenêtre.
  // Sur téléphone, la liste s'allonge au lieu de paginer : les lots déjà reçus
  // restent affichés, le suivant est demandé au bas de la liste.
  const {
    data: lots,
    error: erreurLots,
    isLoading: chargementLots,
    size: nbLots,
    setSize: setNbLots,
    mutate: mutateLots,
  } = useSWRInfinite(
    (index, precedent) => {
      if (!estTelephone) return null;
      if (precedent && (precedent.results || []).length < TAILLE_PAGE) return null;
      return ['/MapApi/org-incidents/mobile', sourceFilter, statusFilter, search, index + 1];
    },
    ([, origine, statut, recherche, p]) => getOrgInternalIncidentsService({
      sourceFilter: origine,
      status: statut,
      search: recherche,
      page: p,
      page_size: TAILLE_PAGE,
    }),
    { revalidateFirstPage: false },
  );
  const chargementPlus = Boolean(estTelephone && lots && nbLots > lots.length);
  const chargerPlus = useCallback(() => setNbLots((n) => n + 1), [setNbLots]);

  const { data: donneesPage, error: erreurPage, isLoading: chargementPage, mutate: mutatePage } = useSWR(
    estTelephone ? null : ['/MapApi/org-incidents', sourceFilter, statusFilter, search, page],
    () => getOrgInternalIncidentsService({
      sourceFilter,
      status: statusFilter,
      search,
      page,
      page_size: TAILLE_PAGE,
    }),
    { keepPreviousData: true },
  );

  const data = useMemo(() => (estTelephone
    ? (lots?.length ? { count: lots[0]?.count ?? 0, results: lots.flatMap((l) => l?.results || (Array.isArray(l) ? l : [])) } : undefined)
    : donneesPage), [estTelephone, lots, donneesPage]);
  const error = estTelephone ? erreurLots : erreurPage;
  const isLoading = estTelephone ? chargementLots : chargementPage;
  const mutate = estTelephone ? mutateLots : mutatePage;

  useEffect(() => {
    setMutateIncidents?.(() => mutate);
  }, [mutate, setMutateIncidents]);

  const interventions = useMemo(() => {
    const liste = data?.results || (Array.isArray(data) ? data : []);
    return liste.map(versIntervention);
  }, [data]);

  const total = data?.count ?? interventions.length;
  const chargementInitial = isLoading && !data;
  const vide = !chargementInitial && interventions.length === 0;
  const filtreActif = Boolean(search || sourceFilter !== 'agents_or_internal');

  // Téléphone : statut et origine vivent tous deux dans la feuille Filtres.
  const nbFiltresTelephone = (statusFilter ? 1 : 0) + (sourceFilter !== 'agents_or_internal' ? 1 : 0);
  const effacerFiltres = () => { setStatusFilter(''); setSourceFilter('agents_or_internal'); };
  const libelleStatutFiltre = STATUTS.find((x) => x.valeur === statusFilter)?.libelle;
  const libelleOrigineFiltre = `Origine : ${ORIGINES.find((o) => o.valeur === sourceFilter)?.libelle}`;
  const totalTelephone = chargementInitial
    ? 'Chargement…'
    : `${nombreFr(total)} intervention${total > 1 ? 's' : ''}${statusFilter === 'taken_into_account' ? ' en cours' : statusFilter === 'resolved' ? ` terminée${total > 1 ? 's' : ''}` : ''}`;

  // Une intervention en collaboration s'ouvre sur sa collaboration ; une
  // intervention interne n'en a pas : elle s'ouvre sur son signalement.
  const ouvrir = (i) => {
    const collaboration = i.my_collaboration?.id;
    if (collaboration) {
      navigate(`/collaboration-detail/${collaboration}`, { state: { from: '/mes-interventions' } });
    } else {
      navigate(`/signalements/${i.id}`, { state: { incident: i, from: '/mes-interventions' } });
    }
  };

  const actionsDe = (i) => (
    <TableActionsMenu
      ariaLabel={`Actions sur ${i.title || 'cette intervention'}`}
      actions={[
        { id: 'detail', label: 'Voir le signalement', icon: Eye, onSelect: () => navigate(`/signalements/${i.id}`, { state: { incident: i, from: '/mes-interventions' } }) },
        { id: 'team', label: 'Voir l’équipe', icon: People, onSelect: () => openAgentsModal(i) },
        { id: 'assign', label: 'Assigner un agent', icon: UserAdd, onSelect: () => openAssignModal(i) },
      ]}
    />
  );

  const boutonRapports = (i, large = false) => (
    <button
      type="button"
      className={`mi-rapports ${i.nbRapports ? 'is-on' : ''} ${large ? 'is-large' : ''}`}
      onClick={(e) => { e.stopPropagation(); openReportsModal(i); }}
      disabled={!i.nbRapports}
      aria-label={i.nbRapports ? `Voir les ${i.nbRapports} rapports de terrain` : 'Aucun rapport de terrain'}
    >
      <DocumentText size={15} color="currentColor" aria-hidden="true" />
      {large
        ? (i.nbRapports ? `${i.nbRapports} rapport${i.nbRapports > 1 ? 's' : ''}` : 'Aucun rapport')
        : i.nbRapports}
    </button>
  );

  return (
    <div className="mi-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      <div className={`mi-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {!estTelephone && <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} sidebarCollapsed={sidebarCollapsed} />}

        <main className="mi" onScroll={surDefilement}>
          {/* Sur téléphone, l'erreur descend du haut de l'écran en alerte flottante. */}
          {estTelephone ? error && (
            <div className="sgm-erreur">
              <BandeauErreur erreur={error} onReessayer={mutate} message="Impossible de charger vos interventions. La liste affichée peut ne plus être à jour." />
            </div>
          ) : (
            <BandeauErreur
              erreur={error}
              onReessayer={mutate}
              message="Impossible de charger vos interventions. La liste affichée peut ne plus être à jour."
            />
          )}

          {/* L'en-tête de la page — titre, onglets, recherche et filtre — reste
              fixe au défilement : seul le tableau passe dessous. */}
          <div ref={repereRef} aria-hidden="true" className="mi-repere" />
          <div className={`mi-entete ${colle ? 'is-colle' : ''}`}>
            <div className="mi-tete">
              <div>
                <h1>Mes interventions</h1>
                {estTelephone
                  ? <p className="mim-total">{totalTelephone}</p>
                  : <p>Les signalements que votre organisation a pris en charge, et l’avancement sur le terrain.</p>}
              </div>
            </div>

            {!estTelephone && <div className={isMobile ? 'mi-statuts-pastilles' : 'mi-statuts'} role="tablist" aria-label="Statut">
              {STATUTS.map((s) => {
                const actif = statusFilter === s.valeur;
                // L'API ne donne que le total de la recherche en cours : le
                // compteur n'apparaît donc que sur l'onglet actif.
                const n = actif && !chargementInitial ? total : undefined;
                return (
                  <button key={s.valeur || 'toutes'} type="button" role="tab" aria-selected={actif} className={actif ? 'is-on' : ''} onClick={() => setStatusFilter(s.valeur)}>
                    {s.libelle}
                    {n !== undefined && (isMobile ? ` ${nombreFr(n)}` : <span className="mi-n">{nombreFr(n)}</span>)}
                  </button>
                );
              })}
            </div>}

            <div className="mi-outils">
              <label className="mi-recherche">
                <SearchNormal1 size={16} color="currentColor" aria-hidden="true" />
                <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Titre, description ou lieu" aria-label="Rechercher une intervention" />
              </label>
              {estTelephone && (
                <button type="button" className={`vlm-filtre ${nbFiltresTelephone ? 'is-on' : ''}`} onClick={() => setFiltresOuverts(true)} aria-label={`Filtres${nbFiltresTelephone ? `, ${nbFiltresTelephone} actif${nbFiltresTelephone > 1 ? 's' : ''}` : ''}`}>
                  <Filter size={18} color="currentColor" aria-hidden="true" />
                  {nbFiltresTelephone > 0 && <span className="vlm-filtre-n" aria-hidden="true">{nbFiltresTelephone}</span>}
                </button>
              )}
              {!isMobile && (
                <label className={`mi-filtre ${sourceFilter !== 'agents_or_internal' ? 'is-on' : ''}`}>
                  <span aria-hidden="true">Origine : {ORIGINES.find((o) => o.valeur === sourceFilter)?.libelle}</span>
                  <ArrowDown2 size={14} color="currentColor" aria-hidden="true" />
                  <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} aria-label="Filtrer par origine">
                    {ORIGINES.map((o) => <option key={o.valeur} value={o.valeur}>Origine : {o.libelle}</option>)}
                  </select>
                </label>
              )}
            </div>

            {estTelephone && nbFiltresTelephone > 0 && (
              <div className="sgm-resume vlm-resume mim-resume">
                {statusFilter && (
                  <button type="button" className="sgm-puce" onClick={() => setStatusFilter('')} aria-label={`Retirer le filtre ${libelleStatutFiltre}`}>
                    {libelleStatutFiltre}<i aria-hidden="true">×</i>
                  </button>
                )}
                {sourceFilter !== 'agents_or_internal' && (
                  <button type="button" className="sgm-puce" onClick={() => setSourceFilter('agents_or_internal')} aria-label={`Retirer le filtre ${libelleOrigineFiltre}`}>
                    {libelleOrigineFiltre}<i aria-hidden="true">×</i>
                  </button>
                )}
              </div>
            )}
          </div>

          {vide ? (
            <div className="mi-boite mi-vide">
              <span className="mi-vide-ic"><Briefcase size={22} color="currentColor" /></span>
              <b>Aucune intervention</b>
              <p>{filtreActif || statusFilter
                ? 'Aucun résultat avec ces critères. Modifiez la recherche ou le filtre.'
                : 'Les signalements que votre organisation prend en charge apparaîtront ici.'}</p>
              {estTelephone && nbFiltresTelephone > 0 && <button type="button" className="sgm-vide-effacer" onClick={effacerFiltres}>Effacer les filtres</button>}
            </div>
          ) : estTelephone ? (
            <div className="mim-cartes">
              {chargementInitial ? [0, 1, 2].map((n) => <div key={n} className="sgm-squelette" aria-hidden="true"><i /><div><span /><span /><span /></div></div>) : interventions.map((i) => (
                <article key={i.id} className={`mim-carte ${i.photo ? '' : 'is-sans-photo'}`}>
                  <button type="button" className="mim-ouvrir" onClick={() => ouvrir(i)}>
                    {i.photo && <span className="mim-photo"><BlurryImage src={i.photo} alt="" /></span>}
                    <span className="mim-corps">
                      <b>{i.title || 'Sans titre'}</b>
                      {i.lieu && <span>{i.lieu}</span>}
                      <span className="mim-statut">
                        <span className={`mi-statut ${i.etat.classe}`}><i aria-hidden="true" />{i.etat.libelle}</span>
                        {i.mode && <span className="mim-mode">{i.mode.libelle}</span>}
                      </span>
                      <span className="mim-ligne"><span>{i.resoluLe ? `Résolu le ${i.resoluLe}` : 'Pas encore résolu'}</span><b>{i.avancement} %</b></span>
                      <span className={`mi-barre ${i.etat.classe}`} aria-hidden="true"><span style={{ width: `${i.avancement}%` }} /></span>
                    </span>
                  </button>
                  <span className="mim-pied">
                    <span>{i.declareLe ? `Déclaré le ${i.declareLe}` : ''}</span>
                    {/* Les rapports s'ouvrent depuis la carte, sans passer par ⋯. */}
                    <button type="button" className={`mim-rapports ${i.nbRapports ? 'is-on' : ''}`} onClick={() => openReportsModal(i)} disabled={!i.nbRapports}>
                      <DocumentText size={15} color="currentColor" aria-hidden="true" />
                      {i.nbRapports ? `${i.nbRapports} rapport${i.nbRapports > 1 ? 's' : ''}` : 'Aucun rapport'}
                    </button>
                  </span>
                  <button type="button" className="mim-menu" onClick={() => setMenu(i)} aria-label={`Actions sur ${i.title || 'cette intervention'}`}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="18.5" cy="12" r="1.7" /></svg>
                  </button>
                </article>
              ))}
              {!chargementInitial && interventions.length < total && (
                <ChargerPlus chargement={chargementPlus} onPlus={chargerPlus} reste={Math.min(TAILLE_PAGE, total - interventions.length)} nom="interventions" feminin />
              )}
            </div>
          ) : isMobile ? (
            <div className="mi-cartes">
              {chargementInitial ? [0, 1, 2].map((n) => <div key={n} className="mi-carte"><ShimmerThumbnail height={120} className="m-0" /><div className="mi-carte-corps"><ShimmerText line={3} gap={8} /></div></div>) : interventions.map((i) => (
                <article key={i.id} className="mi-carte">
                  {i.photo && <div className="mi-carte-photo"><BlurryImage src={i.photo} alt="" /></div>}
                  <div className="mi-carte-corps">
                    <div className="mi-carte-tete">
                      <div>
                        <button type="button" className="mi-titre" onClick={() => ouvrir(i)}>{i.title || 'Sans titre'}</button>
                        <span className="mi-sous">{[i.lieu, i.mode?.libelle].filter(Boolean).join(' · ')}</span>
                      </div>
                      {actionsDe(i)}
                    </div>
                    <div className="mi-carte-etat">
                      <span className={`mi-barre ${i.etat.classe}`} aria-hidden="true"><span style={{ width: `${i.avancement}%` }} /></span>
                      <b>{i.avancement} %</b>
                      <Etat etat={i.etat} />
                    </div>
                    <div className="mi-carte-pied">
                      <button type="button" className="mi-equipe is-large" onClick={() => openAgentsModal(i)}>
                        <People size={15} color="currentColor" aria-hidden="true" />Équipe
                      </button>
                      {boutonRapports(i, true)}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mi-boite mi-tableau-boite">
              <table className="mi-tableau">
                <thead>
                  <tr>
                    <th scope="col">Signalement</th>
                    <th scope="col">Prise en charge</th>
                    <th scope="col">Déclaré le</th>
                    <th scope="col">Avancement</th>
                    <th scope="col">Équipe</th>
                    <th scope="col">Rapports</th>
                    <th scope="col">Statut</th>
                    <th scope="col"><span className="mi-masque">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {chargementInitial ? [0, 1, 2, 3, 4].map((n) => (
                    <tr key={n}><td colSpan={8}><div className="mi-squelette"><ShimmerThumbnail height={44} width={56} rounded className="m-0" /><div style={{ flex: 1 }}><ShimmerText line={2} gap={8} /></div></div></td></tr>
                  )) : interventions.map((i) => (
                    <tr key={i.id} className="mi-ligne" onClick={() => ouvrir(i)}>
                      <td>
                        <div className="mi-signalement">
                          <span className="mi-photo">{i.photo ? <BlurryImage src={i.photo} alt="" /> : null}</span>
                          <div>
                            {/* Le titre est le vrai lien de la ligne : le clic sur
                                toute la ligne n'est qu'un raccourci à la souris. */}
                            <button type="button" className="mi-titre" onClick={(e) => { e.stopPropagation(); ouvrir(i); }}>{i.title || 'Sans titre'}</button>
                            <span className="mi-sous"><Location size={12} color="currentColor" aria-hidden="true" />{i.lieu}</span>
                          </div>
                        </div>
                      </td>
                      <td>{i.mode ? <span className={`mi-mode ${i.mode.classe}`}>{i.mode.libelle}</span> : <span className="mi-absent">—</span>}</td>
                      <td className="mi-doux mi-date">{i.declareLe || '—'}</td>
                      <td><Avancement intervention={i} /></td>
                      <td>
                        <button type="button" className="mi-equipe" onClick={(e) => { e.stopPropagation(); openAgentsModal(i); }}>
                          <People size={15} color="currentColor" aria-hidden="true" />Voir
                        </button>
                      </td>
                      <td>{boutonRapports(i)}</td>
                      <td><Etat etat={i.etat} /></td>
                      <td className="mi-actions" onClick={(e) => e.stopPropagation()}>{actionsDe(i)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!vide && !estTelephone && total > TAILLE_PAGE && (
            <div className="mi-pied">
              <span>{`${(page - 1) * TAILLE_PAGE + 1}–${Math.min(page * TAILLE_PAGE, total)} sur ${nombreFr(total)}`}</span>
              <Pagination page={page} pageSize={TAILLE_PAGE} count={total} onChange={setPage} />
            </div>
          )}
        </main>
      </div>

      {menu && (
        <FeuilleActions
          titre={menu.title || 'Sans titre'}
          onClose={() => setMenu(null)}
          actions={[
            { id: 'detail', label: 'Voir le signalement', onSelect: () => navigate(`/signalements/${menu.id}`, { state: { incident: menu, from: '/mes-interventions' } }) },
            { id: 'team', label: 'Voir l’équipe', onSelect: () => openAgentsModal(menu) },
            { id: 'assign', label: 'Assigner un agent', onSelect: () => openAssignModal(menu) },
            menu.nbRapports > 0 && { id: 'rapports', label: `Rapports de terrain · ${menu.nbRapports}`, onSelect: () => openReportsModal(menu) },
          ].filter(Boolean)}
        />
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
              <h3 id="mim-titre-statut">Statut</h3>
              <div className="sgm-segs sgm-segs-3" role="radiogroup" aria-labelledby="mim-titre-statut">
                {STATUTS.map((x) => (
                  <button key={x.valeur || 'toutes'} type="button" role="radio" aria-checked={statusFilter === x.valeur} onClick={() => setStatusFilter(x.valeur)}>{x.libelle}</button>
                ))}
              </div>
            </div>
            <div>
              <h3 id="mim-titre-origine">Origine</h3>
              <div className="sgm-segs sgm-segs-3" role="radiogroup" aria-labelledby="mim-titre-origine">
                {[['agents_or_internal', 'Toutes'], ['internal', 'Internes'], ['agents', 'Agents']].map(([v, l]) => (
                  <button key={v} type="button" role="radio" aria-checked={sourceFilter === v} onClick={() => setSourceFilter(v)}>{l}</button>
                ))}
              </div>
            </div>
          </div>
          <footer className="sgm-filtres-pied">
            <button type="button" className="sgm-voir" onClick={() => setFiltresOuverts(false)}>
              {chargementInitial ? 'Voir les interventions' : `Voir ${nombreFr(total)} intervention${total > 1 ? 's' : ''}`}
            </button>
          </footer>
        </FeuilleBasse>
      )}

      <MesInterventionsAssignModal />
      <IncidentAgentsListModal />
      <AgentReportsModal
        isOpen={reportsModal.open}
        onClose={closeReportsModal}
        incidentId={reportsModal.incident?.id}
        latitude={reportsModal.incident?.lattitude ?? reportsModal.incident?.latitude}
        longitude={reportsModal.incident?.longitude}
      />
      {toast && <div key={toast.n} className="mi-toast" role="status">{toast.texte}</div>}
    </div>
  );
};

export const MesInterventions = () => (
  <MesInterventionsModalProvider>
    <Contenu />
  </MesInterventionsModalProvider>
);

export default MesInterventions;
