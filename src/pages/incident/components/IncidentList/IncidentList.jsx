import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Edit2, Trash, SearchNormal1, Gallery, Location, Refresh2 } from 'iconsax-react';
import { ShimmerThumbnail, ShimmerText } from 'react-shimmer-effects';
import { BlurryImage } from '../../../../components/atoms/BlurryImage';
import { useIncidentModalContext } from '../../modale/IncidentModalContext';
import { authService } from '../../../auth/services/authService';
import { isSuperAdmin as checkSuperAdmin, getAccessibleNavIds } from '../../../../utils/permissions';
import Pagination from '../../../../components/molecules/Pagination';
import { TableActionsMenu } from '../../../../components/molecules/TableActionsMenu';
import { gravite, libelleGravite } from '../../../../utils/gravite';
import { titreIncident, descriptionRedondante } from '../../../../utils/titreIncident';
import { lieuIncident } from '../../../../utils/lieuIncident';
import { IS_MAPBOX } from '../../../../config/mapEngine';
import { OSM_STYLE } from '../../../../config/mapStyles';
import { CarteSignalementsMapLibre } from './CarteSignalementsMapLibre';
import { CarteSignalementsMapbox } from './CarteSignalementsMapbox';
import { ETATS, etatDe, nomEtatPluriel, quandRelatif, auteurDe, priseEnChargeDe } from './formatSignalement';
import { FeuilleActions } from '../../mobile/FeuilleActions';
import './signalements.css';
import '../../mobile/mobile.css';

const CarteSignalements = IS_MAPBOX ? CarteSignalementsMapbox : CarteSignalementsMapLibre;

// La description complète, sauf quand elle ne fait que répéter le titre (ou
// qu'il s'agit du libellé de repli posé par l'adaptateur de la page).
const descriptionPleine = (incident) => {
  const d = (incident.description || '').trim();
  if (!d || d === 'Aucune description disponible' || descriptionRedondante(incident)) return '';
  return d;
};

// Vue d'ensemble du Sénégal, quand aucun signalement de la page n'est localisé.
const VUE_PAR_DEFAUT = { longitude: -14.45, latitude: 14.5, zoom: 6 };

const Gravite = ({ niveau, petite = false }) => (
  <span className={`sg-chip sg-gc-${niveau} ${petite ? 'sg-chip-s' : ''}`}>
    <i aria-hidden="true" />{libelleGravite(niveau)}
  </span>
);

/** Badge de gravité affiché dans les colonnes étendu (renduCarte / rendu). */
const BadgeGravite = ({ incident }) => (
  <Gravite niveau={gravite(incident)} petite />
);

const Etat = ({ etat, petite = false, surPhoto = false }) => {
  const e = etatDe(etat);
  return <span className={`sg-chip ${surPhoto ? 'sg-chip-photo' : e.classe} ${petite ? 'sg-chip-s' : ''}`} data-etat={etat}>{e.libelle}</span>;
};

// La vignette seulement : la photo d'origine pèse jusqu'à 1,5 Mo (~14 Ko pour
// la vignette, voir docs/rapport-performance-2026-08-22.md). Vingt photos
// d'origine par page, c'était des dizaines de Mo pour des cases de 56 px.
const Vignette = ({ incident, className }) => (
  <span className={className}>
    {incident.thumbnail
      ? <BlurryImage src={incident.thumbnail} alt="" />
      : <Gallery size={18} color="currentColor" aria-hidden="true" />}
  </span>
);

/** Onglets d'état : soulignés sur grand écran, pastilles sur téléphone. */
const OngletsEtat = ({ valeur, onChange, count, chargement, variante = 'souligne' }) => (
  <div className={`sg-etats sg-etats-${variante}`} role="tablist" aria-label="État">
    {ETATS.map((e) => {
      const actif = valeur === e.valeur;
      return (
        <button key={e.valeur || 'tous'} type="button" role="tab" aria-selected={actif} className={actif ? 'is-on' : ''} onClick={() => onChange(e.valeur)}>
          {e.libelle}
          {actif && !chargement && count > 0 && (variante === 'pastille' ? (e.valeur === '' ? ` · ${count}` : null) : <span className="sg-n">{count}</span>)}
        </button>
      );
    })}
  </div>
);

const Recherche = ({ valeur, onChange, placeholder = 'Titre, description ou quartier…' }) => (
  <label className="sg-recherche">
    <SearchNormal1 size={16} color="currentColor" aria-hidden="true" />
    <input
      type="search"
      value={valeur}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label="Rechercher un signalement"
    />
  </label>
);

export const IncidentList = ({
  incidents = [],
  onSelectIncident,
  isLoading = false,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  page,
  setPage,
  pageSize,
  count,
  vue,
  setVue,
  isMobile,
  estTelephone = false,
  onPlus,
}) => {
  const { openDeleteModal, openAssignModal } = useIncidentModalContext();
  const [feuille, setFeuille] = useState(null);
  const user = authService.getCurrentUser();
  const isSuperAdmin = checkSuperAdmin(user);
  // « admin » ici = peut piloter les incidents sans être super_admin.
  const isAdmin = !isSuperAdmin && getAccessibleNavIds(user).includes('incidents');
  const monOrgId = user?.organisation_member;

  const lignes = useMemo(() => incidents.map((incident) => ({
    incident,
    niveau: gravite(incident),
    // Ni le titre ni la description ne sont coupés : on les affiche en entier.
    titre: titreIncident(incident, Infinity),
    description: descriptionPleine(incident),
    lieu: lieuIncident(incident),
    charge: priseEnChargeDe(incident, monOrgId),
    auteur: auteurDe(incident),
    quand: quandRelatif(incident.created_at),
  })), [incidents, monOrgId]);

  const listeActions = (incident, charge) => [
    { id: 'view', label: 'Voir le détail', icon: Eye, onSelect: () => onSelectIncident?.(incident) },
    (incident.isOwner || charge?.estMoi) && { id: 'assign', label: 'Assigner à un agent', icon: Edit2, onSelect: () => openAssignModal(incident) },
    !isAdmin && { id: 'delete', label: 'Supprimer le signalement', icon: Trash, tone: 'danger', onSelect: () => openDeleteModal(incident) },
  ].filter(Boolean);

  const actionsDe = (incident, charge) => (
    <TableActionsMenu
      ariaLabel={`Actions sur ${incident.title || 'ce signalement'}`}
      actions={listeActions(incident, charge)}
    />
  );

  const nomEtat = nomEtatPluriel(statusFilter);
  const annonce = isLoading
    ? 'Chargement…'
    : `${count} signalement${count > 1 ? 's' : ''}${nomEtat ? ` ${nomEtat}` : ''}${search ? ` pour « ${search} »` : ''}`;

  const vide = !isLoading && lignes.length === 0;
  const etatVide = (
    <div className="sg-vide">
      <span className="sg-vide-ic"><SearchNormal1 size={22} color="currentColor" /></span>
      <b>Aucun signalement</b>
      <p>{search ? 'Aucun résultat pour cette recherche. Essayez un autre mot ou un autre état.' : "Il n'y a aucun signalement dans cet état pour le moment."}</p>
    </div>
  );

  return (
    <section className="sg" aria-labelledby="sg-titre">
      <div className="sg-tete">
        <div>
          <h1 id="sg-titre">Signalements</h1>
          {vue !== 'carte' && <p>Les problèmes remontés par les citoyens et les agents de terrain.</p>}
        </div>
        {!isMobile && !estTelephone && (
          <div className="sg-vue" role="group" aria-label="Affichage">
            <button type="button" aria-pressed={vue !== 'carte'} onClick={() => setVue('tableau')}>Tableau</button>
            <button type="button" aria-pressed={vue === 'carte'} onClick={() => setVue('carte')}>Carte</button>
          </div>
        )}
        {isMobile && !estTelephone && (
          <div className="sg-vue" role="group" aria-label="Affichage">
            <button type="button" aria-pressed={vue !== 'carte'} onClick={() => setVue('tableau')}>Liste</button>
            <button type="button" aria-pressed={vue === 'carte'} onClick={() => setVue('carte')}>Carte</button>
          </div>
        )}
      </div>

      {vue === 'carte' ? (
        <VueCarte
          lignes={lignes}
          isLoading={isLoading}
          isMobile={isMobile}
          search={search}
          setSearch={setSearch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          count={count}
          onOuvrir={onSelectIncident}
          etatVide={etatVide}
        />
      ) : isMobile ? (
        <>
          <Recherche valeur={search} onChange={setSearch} placeholder={estTelephone ? 'Titre, description ou quartier' : undefined} />
          <OngletsEtat valeur={statusFilter} onChange={setStatusFilter} count={count} chargement={isLoading} variante="pastille" />
          <p className="sg-annonce" role="status">{annonce}</p>
          {vide ? etatVide : (
            <div className="sg-cartes">
              {lignes.map(({ incident, niveau, titre, description, lieu, charge, quand }) => (
                <div key={incident.id} className={estTelephone ? 'sgm-carte' : undefined}>
                  <a href={`/signalements/${incident.id}`} className="sg-carte" onClick={(e) => { e.preventDefault(); onSelectIncident?.(incident); }}>
                    <span className="sg-carte-photo">
                      <Vignette incident={incident} className="sg-carte-img" />
                      <Gravite niveau={niveau} />
                      <Etat etat={incident.etat} surPhoto />
                    </span>
                    <span className="sg-carte-corps">
                      <b>{titre}</b>
                      {description && <p className="sg-desc">{description}</p>}
                      <span>{[lieu, quand].filter(Boolean).join(' · ')}</span>
                      <span className={`sg-carte-charge ${charge ? 'is-pris' : ''}`}>
                        {charge ? [charge.nom, charge.mode.toLowerCase()].filter(Boolean).join(' · ') : "Personne ne l'a encore pris en charge"}
                      </span>
                    </span>
                  </a>
                  {estTelephone && (
                    <button
                      type="button"
                      className="sgm-plus"
                      aria-label="Actions sur ce signalement"
                      onClick={() => setFeuille({ incident, titre, lieu, actions: listeActions(incident, charge) })}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="18.5" cy="12" r="1.7" /></svg>
                    </button>
                  )}
                </div>
              ))}
              {isLoading && [0, 1].map((n) => (estTelephone
                ? <div key={n} className="sgm-squelette" aria-hidden="true"><i /><div><span /><span /></div></div>
                : <div key={n} className="sg-carte"><ShimmerThumbnail height={150} className="m-0" /><div className="sg-carte-corps"><ShimmerText line={2} gap={8} /></div></div>))}
            </div>
          )}
          {feuille && (
            <FeuilleActions
              titre={feuille.titre}
              sousTitre={[feuille.lieu, etatDe(feuille.incident.etat).libelle].filter(Boolean).join(' · ')}
              actions={feuille.actions}
              onClose={() => setFeuille(null)}
            />
          )}
          {!isLoading && lignes.length < count && (
            <button type="button" className="sg-plus" onClick={onPlus}>
              Afficher {Math.min(pageSize, count - lignes.length)} signalements de plus
            </button>
          )}
        </>
      ) : (
        <>
          <OngletsEtat valeur={statusFilter} onChange={setStatusFilter} count={count} chargement={isLoading} />
          <div className="sg-outils">
            <Recherche valeur={search} onChange={setSearch} />
            <span className="sg-annonce" role="status">{annonce}</span>
          </div>

          {vide ? <div className="sg-boite">{etatVide}</div> : (
            <div className="sg-boite sg-tableau-boite">
              <table className="sg-tableau">
                {/* Largeurs fixées : le texte se replie dans sa colonne, en
                    entier, au lieu d'étirer le tableau ou d'être coupé. */}
                <colgroup>
                  <col className="sg-col-sig" />
                  <col className="sg-col-lieu" />
                  <col className="sg-col-gravite" />
                  <col className="sg-col-etat" />
                  <col className="sg-col-charge" />
                  <col className="sg-col-quand" />
                  <col className="sg-col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Signalement</th>
                    <th scope="col">Localisation</th>
                    <th scope="col">Gravité</th>
                    <th scope="col">État</th>
                    <th scope="col">Pris en charge par</th>
                    <th scope="col">Signalé</th>
                    <th scope="col"><span className="sg-masque">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? [0, 1, 2, 3, 4, 5].map((n) => (
                    <tr key={n} className="sg-squelette">
                      <td colSpan={7}><div className="sg-squelette-ligne"><ShimmerThumbnail height={44} width={56} rounded className="m-0" /><div style={{ flex: 1 }}><ShimmerText line={2} gap={8} /></div></div></td>
                    </tr>
                  )) : lignes.map(({ incident, niveau, titre, description, lieu, charge, auteur, quand }) => (
                    <tr key={incident.id} className="sg-ligne" onClick={() => onSelectIncident?.(incident)}>
                      <td>
                        <div className="sg-sig">
                          <Vignette incident={incident} className="sg-vignette" />
                          <div>
                            <a
                              href={`/signalements/${incident.id}`}
                              className="sg-titre"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelectIncident?.(incident); }}
                            >
                              {titre}
                            </a>
                            {description && <p className="sg-desc">{description}</p>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="sg-lieu">
                          <Location size={14} color="currentColor" aria-hidden="true" />
                          {lieu}
                        </span>
                      </td>
                      <td><Gravite niveau={niveau} /></td>
                      <td><Etat etat={incident.etat} /></td>
                      <td>
                        {charge ? (
                          <span className="sg-charge">
                            <b className={charge.estMoi ? 'is-moi' : ''}>{charge.nom}</b>
                            {charge.mode && <span>{charge.mode}</span>}
                          </span>
                        ) : <span className="sg-libre">Personne pour l'instant</span>}
                      </td>
                      <td className="sg-quand">
                        <span>{quand}</span>
                        {auteur && <small>{auteur}</small>}
                      </td>
                      <td className="sg-actions" onClick={(e) => e.stopPropagation()}>{actionsDe(incident, charge)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!vide && (
            <div className="sg-pied">
              <span>{count ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, count)} sur ${count}` : ''}</span>
              <Pagination page={page} pageSize={pageSize} count={count} onChange={setPage} />
            </div>
          )}
        </>
      )}
    </section>
  );
};

/** Vue carte : la liste de la page à gauche, ses signalements sur la carte à droite. */
const VueCarte = ({
  lignes, isLoading, isMobile, search, setSearch, statusFilter, setStatusFilter,
  page, setPage, pageSize, count, onOuvrir, etatVide,
}) => {
  const carteRef = useRef(null);
  const [selId, setSelId] = useState(null);

  const points = useMemo(() => lignes
    .filter(({ incident }) => incident.coordinates)
    .map(({ incident, niveau, titre }) => ({
      id: incident.id,
      lat: incident.coordinates.lat,
      lng: incident.coordinates.lng,
      niveau,
      libelle: `${titre}, gravité ${libelleGravite(niveau).toLowerCase()}`,
    })), [lignes]);

  const sansCoord = lignes.length - points.length;
  const ligneSel = lignes.find(({ incident }) => incident.id === selId);
  const pointSel = points.find((p) => p.id === selId);

  // La carte cadre les signalements de la page affichée à chaque changement de page.
  const cleCadrage = points.map((p) => p.id).join(',');
  useEffect(() => {
    if (!points.length) return undefined;
    let annule = false;
    const cadrer = () => {
      if (annule) return;
      const carte = carteRef.current;
      if (!carte?.fitBounds) { setTimeout(cadrer, 200); return; }
      const lngs = points.map((p) => p.lng);
      const lats = points.map((p) => p.lat);
      carte.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], { padding: 70, maxZoom: 14, duration: 600 });
    };
    cadrer();
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleCadrage]);

  const choisir = (id) => {
    setSelId(id);
    const p = points.find((x) => x.id === id);
    // Le point descend sous le centre : la fiche, ouverte au-dessus, reste entière à l'écran.
    if (p) carteRef.current?.flyTo?.({ center: [p.lng, p.lat], offset: [0, 150], zoom: Math.max(carteRef.current.getZoom?.() || 12, 13), duration: 500 });
  };

  const fiche = ligneSel && (
    <article className="sg-fiche">
      <span className="sg-fiche-photo">
        <Vignette incident={ligneSel.incident} className="sg-fiche-img" />
        <button type="button" className="sg-fiche-x" onClick={() => setSelId(null)} aria-label="Fermer la fiche">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </span>
      <div className="sg-fiche-corps">
        <span className="sg-fiche-chips"><Gravite niveau={ligneSel.niveau} petite /><Etat etat={ligneSel.incident.etat} petite /></span>
        <b>{ligneSel.titre}</b>
        {ligneSel.description && <p className="sg-desc">{ligneSel.description}</p>}
        <span className="sg-fiche-meta">{[ligneSel.lieu, ligneSel.quand.toLowerCase(), ligneSel.auteur].filter(Boolean).join(' · ')}</span>
        <span className="sg-fiche-charge">
          {ligneSel.charge ? `${ligneSel.charge.nom}${ligneSel.charge.mode ? ` · ${ligneSel.charge.mode.toLowerCase()}` : ''}` : "Personne ne l'a encore pris en charge."}
        </span>
        <button type="button" className="sg-fiche-ouvrir" onClick={() => onOuvrir?.(ligneSel.incident)}>Ouvrir la fiche</button>
      </div>
    </article>
  );

  return (
    <div className={`sg-carte-vue ${isMobile ? 'is-mobile' : ''}`}>
      <section className="sg-liste" aria-label="Liste des signalements">
        <div className="sg-liste-tete">
          <Recherche valeur={search} onChange={setSearch} />
          <div className="sg-segment" role="tablist" aria-label="État">
            {ETATS.map((e) => (
              <button key={e.valeur || 'tous'} type="button" role="tab" aria-selected={statusFilter === e.valeur} onClick={() => setStatusFilter(e.valeur)}>
                {e.libelle}
              </button>
            ))}
          </div>
        </div>
        <div className="sg-liste-corps">
          {isLoading ? [0, 1, 2, 3, 4].map((n) => <div key={n} className="sg-item"><ShimmerText line={2} gap={8} /></div>)
            : lignes.length === 0 ? etatVide
              : lignes.map(({ incident, niveau, titre, lieu, quand }) => (
                <button
                  key={incident.id}
                  type="button"
                  className={`sg-item ${selId === incident.id ? 'is-on' : ''}`}
                  onClick={() => (incident.coordinates ? choisir(incident.id) : onOuvrir?.(incident))}
                  aria-pressed={selId === incident.id}
                >
                  <i className={`sg-item-point sg-g-${niveau}`} aria-hidden="true" />
                  <span className="sg-item-t">
                    <b>{titre}</b>
                    <span>{[lieu, quand.toLowerCase()].filter(Boolean).join(' · ')}{!incident.coordinates && ' · non localisé sur la carte'}</span>
                  </span>
                  <Etat etat={incident.etat} petite />
                </button>
              ))}
        </div>
        <div className="sg-liste-pied">
          <span>{count ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, count)} sur ${count}` : ''}</span>
          <span className="sg-pages">
            <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Page précédente">‹</button>
            <button type="button" onClick={() => setPage(page + 1)} disabled={page * pageSize >= count} aria-label="Page suivante">›</button>
          </span>
        </div>
      </section>

      <div className="sg-carte-zone">
        <CarteSignalements
          carteRef={carteRef}
          mapStyle={OSM_STYLE}
          initialViewState={VUE_PAR_DEFAUT}
          points={points}
          selection={pointSel}
          onSelect={choisir}
          fiche={fiche}
        />
        {!isLoading && lignes.length > 0 && (
          <span className="sg-carte-compte">
            <b>{points.length}</b> sur {lignes.length} localisés{sansCoord > 0 ? ` · ${sansCoord} sans coordonnées` : ''}
          </span>
        )}
        <div className="sg-legende" aria-label="Légende">
          <b>Gravité</b>
          {['high', 'medium', 'low'].map((n) => <span key={n}><i className={`sg-g-${n}`} aria-hidden="true" />{libelleGravite(n)}</span>)}
        </div>
      </div>
    </div>
  );
};

export default IncidentList;
