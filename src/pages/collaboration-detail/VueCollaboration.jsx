import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft2, Crown1, TickCircle, Gallery, Add,
  MagicStar, Copy, Routing2, Danger, ShieldTick, Lock1, UserAdd, InfoCircle,
} from 'iconsax-react';
import { IS_MAPBOX } from '../../config/mapEngine';
import { OSM_STYLE, MAPBOX_SATELLITE_STYLE, HAS_SATELLITE_STYLE as HAS_MAPBOX_SATELLITE } from '../../config/mapStyles';
import { MapDetailViewMapLibre } from '../incident/components/IncidentDetail/MapDetailViewMapLibre';
import { MapDetailViewMapbox } from '../incident/components/IncidentDetail/MapDetailViewMapbox';
import { Jauge } from '../incident/components/IncidentDetail/VueDetail';
import { nombre, niveauScore } from '../incident/components/IncidentDetail/mesures';
import { BlurryImage } from '../../components/atoms/BlurryImage';
import { formatEtat, formatStatus, formatRole } from './formatage';
import { ListeTaches } from './ListeTaches';
import { Discussion } from './Discussion';
import '../incident/components/IncidentDetail/vue-detail.css';
import '../incident/components/IncidentDetail/vue-detail-agir.css';
import '../incident/components/IncidentDetail/vue-detail-mobile.css';
import './vue-collaboration.css';
import '../collaboration/mobile/collaboration-mobile.css';
import { useEstTelephone } from '../incident/mobile/useEstTelephone';
import { FeuilleActions } from '../incident/mobile/FeuilleActions';

const MapDetailView = IS_MAPBOX ? MapDetailViewMapbox : MapDetailViewMapLibre;

// Les quatre états qu'un signalement traverse côté API.
const ETAPES = ['declared', 'taken_into_account', 'in_progress', 'resolved'];

const CHIP_ETAT = {
  declared: 'vc-chip-info',
  taken_into_account: 'vc-chip-primary',
  in_progress: 'vc-chip-warn',
  resolved: 'vc-chip-ok',
};

const CHIP_STATUT = { accepted: 'vc-chip-ok', pending: 'vc-chip-warn', rejected: 'vc-chip-ko' };


// impact_tags arrive en tableau, en liste séparée par des virgules ou en JSON.
const lireTags = (brut) => {
  if (Array.isArray(brut)) return brut;
  if (typeof brut !== 'string' || !brut.trim()) return [];
  try {
    if (brut.trim().startsWith('[')) {
      const t = JSON.parse(brut);
      if (Array.isArray(t)) return t;
    }
  } catch {
    // Format libre : on retombe sur le découpage par virgules.
  }
  return brut.split(',').map((t) => t.trim()).filter(Boolean);
};

const Ligne = ({ libelle, children }) => (
  <div className="vd-row"><span>{libelle}</span><b>{children}</b></div>
);

const useEchap = (actif, fermer) => {
  useEffect(() => {
    if (!actif) return undefined;
    const echap = (e) => { if (e.key === 'Escape') fermer(); };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [actif, fermer]);
};

export const VueCollaboration = ({
  collaboration, onBack, lectureSeule,
  progression, progressionSauvee, modificationsEnAttente, taches, tachesChargement,
  peutResoudre, raisonBlocage, onResoudre, onCreerTache, onSuggerer, onRapports,
  discussion, onZoomImage, onToast,
}) => {
  const [onglet, setOnglet] = useState('taches');
  const estTelephone = useEstTelephone();
  const [menuOuvert, setMenuOuvert] = useState(false);
  const refPhoto = useRef(null);
  const [photoPassee, setPhotoPassee] = useState(false);

  // La barre compacte apparaît une fois la photo sortie de l'écran.
  useEffect(() => {
    const photo = refPhoto.current;
    if (!estTelephone || !photo || typeof IntersectionObserver === 'undefined') return undefined;
    const observateur = new IntersectionObserver(([e]) => setPhotoPassee(!e.isIntersecting));
    observateur.observe(photo);
    return () => observateur.disconnect();
  }, [estTelephone]);

  const [fond, setFond] = useState('streets');
  const carteRef = useRef(null);

  const incident = collaboration.incidentDetails || {};
  const pred = collaboration.predictionDetails;
  const etat = incident.etat || 'declared';
  const indexEtape = Math.max(0, ETAPES.indexOf(etat));
  const estLeader = collaboration.userRole === 'leader';

  const lat = Number(pred?.latitude || incident.lattitude || incident.latitude);
  const lng = Number(pred?.longitude || incident.longitude);
  const coords = Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng) ? { lat, lng } : null;
  const rayon = Number(pred?.potential_risk?.potential_radius || pred?.impact_radius_meters) || 0;
  const score = pred?.global_impact_score;
  const tags = lireTags(pred?.impact_tags);

  const liste = taches.currentTasks;
  const nbFaites = liste.filter((t) => t.completed).length;
  const nbEchouees = liste.filter((t) => t.failed).length;
  const nbEnCours = liste.length - nbFaites - nbEchouees;

  const acting = incident.acting_organisations || [];
  const leader = acting.find((o) => o.relation === 'leader');
  const partenaires = acting.filter((o) => o.relation !== 'leader' && o.name);
  const organisations = [
    ...(leader ? [{ nom: leader.name, role: 'Leader', principal: true }] : []),
    ...partenaires.map((o) => ({ nom: o.name, role: o.relation === 'co-leader' ? 'Co-leader' : 'Partenaire' })),
  ];

  const copier = async (texte, message) => {
    try {
      await navigator.clipboard.writeText(texte);
      onToast?.(message);
    } catch {
      onToast?.('Copie impossible dans ce navigateur');
    }
  };

  // Sous 1100 px, la discussion quitte la colonne de droite et devient un onglet.
  const [etroit, setEtroit] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 1099.98px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1099.98px)');
    const maj = (e) => setEtroit(e.matches);
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);
  // Revenu en grand écran sur l'onglet Discussion : la discussion est déjà à droite.
  const ongletActif = !etroit && onglet === 'discussion' ? 'taches' : onglet;

  const [aideResolution, setAideResolution] = useState(false);
  useEchap(aideResolution, () => setAideResolution(false));

  const onglets = [
    ['taches', 'Tâches', liste.length || null],
    ...(etroit ? [['discussion', 'Discussion', estTelephone ? null : (discussion.messages.length || null)]] : []),
    ...(estTelephone ? [['infos', 'Infos']] : [
      ['signalement', 'Signalement'],
      ['organisations', 'Organisations', organisations.length || null],
    ]),
  ];

  const boutonSuggerer = !lectureSeule && (
    <button type="button" className="vd-btn vd-btn-g" onClick={onSuggerer}>
      <UserAdd size={16} color="currentColor" />{estLeader ? 'Inviter des organisations' : 'Suggérer des organisations'}
    </button>
  );

  const pastilles = (
    <div className="vd-chips">
      <span className={`vd-chip ${CHIP_ETAT[etat] || 'vc-chip-info'}`}><i style={{ backgroundColor: 'currentColor' }} />{formatEtat(etat)}</span>
      {collaboration.userRole && (
        <span className={`vd-chip ${estLeader ? 'vc-chip-lead' : 'vd-chip-neutre'}`}>
          Votre rôle : {formatRole(collaboration.userRole)}
        </span>
      )}
      {collaboration.status && collaboration.status !== 'accepted' && (
        <span className={`vd-chip ${CHIP_STATUT[collaboration.status] || 'vd-chip-neutre'}`}>Invitation {formatStatus(collaboration.status).toLowerCase()}</span>
      )}
      {(pred?.sub_category || pred?.macro_category) && <span className="vd-chip vd-chip-motif">{pred.sub_category || pred.macro_category}</span>}
    </div>
  );

  const bandeaux = (
    <>
      {lectureSeule && (
        <div className="vd-banner vd-banner-ok">
          <ShieldTick size={18} variant="Bold" color="currentColor" />
          <span><b>Signalement résolu :</b> la collaboration est archivée. Tâches et discussion restent consultables en lecture seule.</span>
        </div>
      )}
      {!lectureSeule && collaboration.status === 'pending' && (
        <div className="vd-banner">
          <InfoCircle size={18} variant="Bold" color="currentColor" />
          <span><b>Invitation en attente :</b> votre participation n'a pas encore été confirmée par l'organisation leader.</span>
        </div>
      )}
    </>
  );

  const iconeRetour = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>;
  const iconeMenu = <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="18.5" cy="12" r="1.7" /></svg>;

  const actionsMenu = [
    { id: 'inviter', label: estLeader ? 'Inviter des organisations' : 'Suggérer des organisations', onSelect: onSuggerer },
    { id: 'rapports', label: 'Rapports de terrain', onSelect: onRapports },
  ];

  return (
    <div className="vd vc">
      {estTelephone ? (
        <>
          {photoPassee && (
            <header className="vdm-compacte">
              <button type="button" onClick={onBack} aria-label="Retour aux collaborations">{iconeRetour}</button>
              <b>{collaboration.title}</b>
              {lectureSeule ? <span /> : <button type="button" onClick={() => setMenuOuvert(true)} aria-label="Autres actions">{iconeMenu}</button>}
            </header>
          )}

          <div className="vdm-photo" ref={refPhoto}>
            <div className="vd-stage">
              {collaboration.image ? (
                <button type="button" className="vd-photo" onClick={() => onZoomImage({ src: collaboration.image, alt: collaboration.title })} aria-label="Agrandir la photo">
                  <BlurryImage src={collaboration.image} alt={collaboration.title} className="vd-photo-img" />
                </button>
              ) : (
                <div className="vd-photo vd-photo-vide"><Gallery size={28} color="currentColor" /><span>Aucune photo</span></div>
              )}
            </div>
            <div className="vdm-rangee">
              <button type="button" className="vdm-rond" onClick={onBack} aria-label="Retour aux collaborations">{iconeRetour}</button>
              {!lectureSeule && <button type="button" className="vdm-rond" onClick={() => setMenuOuvert(true)} aria-label="Autres actions">{iconeMenu}</button>}
            </div>
          </div>

          <div className="vdm-corps">
            <div className="vdm-titre">
              <h1>{collaboration.title}</h1>
              <p>{collaboration.location}{collaboration.userRole && ` · Votre rôle : ${formatRole(collaboration.userRole)}`}</p>
            </div>
            {bandeaux}
            <section className="vcm-suivi">
              <span
                className="vdm-anneau"
                role="img"
                aria-label={`Avancement ${progression} %`}
                style={{ background: `conic-gradient(${progression === 100 ? 'var(--color-success-text)' : '#1E78AC'} 0 ${progression}%, #F1F3F6 0 100%)` }}
              >
                <span>{progression} %</span>
              </span>
              <span>
                <b>{nbFaites} tâche{nbFaites > 1 ? 's' : ''} sur {liste.length} terminée{nbFaites > 1 ? 's' : ''}</b>
                <span>
                  {nbEnCours + nbEchouees === 0 && liste.length > 0
                    ? 'Prêt à être résolu'
                    : <>Reste {nbEnCours} en cours{nbEchouees > 0 && <em> et {nbEchouees} échouée{nbEchouees > 1 ? 's' : ''}</em>}</>}
                </span>
                {modificationsEnAttente && <span>{progressionSauvee} % enregistré</span>}
              </span>
            </section>
          </div>

          {menuOuvert && <FeuilleActions titre={collaboration.title} actions={actionsMenu} onClose={() => setMenuOuvert(false)} />}
        </>
      ) : (
      <>
      <nav className="vd-crumb" aria-label="Fil d'Ariane">
        <button type="button" className="vd-back" onClick={onBack} aria-label="Retour aux collaborations">
          <ArrowLeft2 size={16} color="currentColor" />
        </button>
        <button type="button" className="vd-crumb-link" onClick={onBack}>Collaborations</button>
        <span>/</span>
        <span>{collaboration.location}</span>
      </nav>

      <header className="vd-head">
        <div className="vd-head-t">
          <h1>{collaboration.title}</h1>
          {pastilles}
          <div className="vd-meta">
            <span>{collaboration.location}</span>
            <span>Rejointe le {collaboration.joinedAt}</span>
            {collaboration.organisation && <span>Organisation : {collaboration.organisation}</span>}
          </div>
        </div>

        <div className="vd-actions">
          {boutonSuggerer}
          {lectureSeule ? (
            <span className="vd-btn vc-btn-done" role="status"><ShieldTick size={16} variant="Bold" color="currentColor" />Signalement résolu</span>
          ) : estLeader && (
            <div className="vd-agir-wrap">
              <button
                type="button"
                className="vd-btn vd-btn-p vc-btn-ok"
                onClick={peutResoudre ? onResoudre : () => setAideResolution((o) => !o)}
                aria-disabled={!peutResoudre}
                aria-expanded={peutResoudre ? undefined : aideResolution}
              >
                {peutResoudre ? <TickCircle size={16} variant="Bold" color="currentColor" /> : <Lock1 size={16} variant="Bold" color="currentColor" />}
                Résoudre le signalement
              </button>
              {!peutResoudre && aideResolution && (
                <div className="vd-menu vc-tip-pop" role="status">
                  <b>Pas encore possible</b>
                  <p>{raisonBlocage}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {bandeaux}

      {/* Avancement + photo */}
      <section className="vd-hero vc-hero">
        <div className="vd-card vd-decide">
          <div className="vc-prog">
            <div className="vc-prog-num">
              <b>{progression}<small>%</small></b>
              <span>
                avancement
                {modificationsEnAttente && <em> · {progressionSauvee} % enregistré</em>}
              </span>
            </div>
            <div className="vc-prog-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progression} aria-label="Avancement de la collaboration">
              <i style={{ width: `${progression}%` }} className={progression === 100 ? 'is-full' : ''} />
            </div>
          </div>

          <div className="vd-kpis">
            <div className="vd-kpi"><b className="vc-k-ok">{nbFaites}</b><span>terminée{nbFaites > 1 ? 's' : ''}</span></div>
            <div className="vd-kpi"><b>{nbEnCours}</b><span>en cours</span></div>
            <div className="vd-kpi"><b className={nbEchouees ? 'vc-k-ko' : ''}>{nbEchouees}</b><span>échouée{nbEchouees > 1 ? 's' : ''}</span></div>
          </div>

          <div>
            <p className="vd-sec">Suivi du signalement</p>
            <div className="vd-steps vc-steps">
              {ETAPES.map((id, i) => (
                <div key={id} className={`vd-step ${i < indexEtape || etat === 'resolved' ? 'is-done' : i === indexEtape ? 'is-cur' : ''}`}>
                  <i />
                  {formatEtat(id)}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="vd-card vd-media">
          <div className="vd-stage">
            {collaboration.image ? (
              <button type="button" className="vd-photo vc-photo" onClick={() => onZoomImage({ src: collaboration.image, alt: collaboration.title })} aria-label="Agrandir la photo">
                <BlurryImage src={collaboration.image} alt={collaboration.title} className="vd-photo-img" />
                <span className="vd-zoom"><Gallery size={14} color="currentColor" />Agrandir</span>
              </button>
            ) : (
              <div className="vd-photo vd-photo-vide vc-photo"><Gallery size={28} color="currentColor" /><span>Aucune photo</span></div>
            )}
          </div>
        </div>
      </section>

      </>
      )}

      {/* Espace de travail : onglets à gauche, discussion à droite */}
      <div className="vc-work">
        <div className="vc-work-main">
          <nav className="vd-tabs" role="tablist">
            {onglets.map(([cle, libelle, n]) => (
              <button key={cle} type="button" role="tab" aria-selected={ongletActif === cle} className={ongletActif === cle ? 'is-on' : ''} onClick={() => setOnglet(cle)}>
                {libelle}
                {n ? <span className="vd-n">{n}</span> : null}
              </button>
            ))}
          </nav>

          {ongletActif === 'taches' && (
            <section className="vd-panel">
              <div className="vd-card vd-pad">
                <h3>
                  Tâches
                  {!lectureSeule && liste.length > 0 && (
                    <button type="button" className="vd-btn vd-btn-p vd-btn-s vc-h-btn" onClick={onCreerTache}>
                      <Add size={15} color="currentColor" />Nouvelle tâche
                    </button>
                  )}
                </h3>
                <ListeTaches
                  taches={taches}
                  chargement={tachesChargement}
                  lectureSeule={lectureSeule}
                  onCreer={onCreerTache}
                  onZoomImage={onZoomImage}
                />
              </div>
            </section>
          )}

          {ongletActif === 'discussion' && (
            <section className="vd-panel vc-chat-tab">
              <Discussion discussion={discussion} lectureSeule={lectureSeule} onRapports={onRapports} />
            </section>
          )}

          {(ongletActif === 'signalement' || ongletActif === 'infos') && (
            <section className="vd-panel">
              <div className="vd-grid2">
                <div className="vd-card vd-pad">
                  <h3>Description</h3>
                  <p className="vd-text vc-pre">{collaboration.description}</p>
                  {pred?.display_name && (
                    <>
                      <h3 className="vd-mt">Adresse estimée</h3>
                      <p className="vd-text">{pred.display_name}</p>
                    </>
                  )}
                  {collaboration.incidentId && (
                    <Link className="vd-link vc-link-block" to={`/signalements/${collaboration.incidentId}`}>Ouvrir la fiche complète du signalement</Link>
                  )}
                </div>

                <div className="vd-card vd-pad">
                  <h3>Localisation {rayon > 0 && <small>zone d'intervention : {nombre(rayon)} m</small>}</h3>
                  {coords ? (
                    <>
                      <div className="vd-map">
                        <MapDetailView
                          carteRef={carteRef}
                          longitude={coords.lng}
                          latitude={coords.lat}
                          mapStyle={fond === 'satellite' && MAPBOX_SATELLITE_STYLE ? MAPBOX_SATELLITE_STYLE : OSM_STYLE}
                          rayon={rayon}
                        />
                        <div className="vd-mstyle" role="group" aria-label="Fond de carte">
                          <button type="button" className={fond !== 'satellite' ? 'is-on' : ''} onClick={() => setFond('streets')}>Plan</button>
                          {HAS_MAPBOX_SATELLITE && (
                            <button type="button" className={fond === 'satellite' ? 'is-on' : ''} onClick={() => setFond('satellite')}>Satellite</button>
                          )}
                        </div>
                      </div>
                      <div className="vd-coords">
                        <span className="vd-coord">Lat. <b>{nombre(coords.lat, 5)}</b></span>
                        <span className="vd-coord">Long. <b>{nombre(coords.lng, 5)}</b></span>
                        <button type="button" className="vd-btn vd-btn-g vd-btn-s" onClick={() => copier(`${coords.lat}, ${coords.lng}`, 'Coordonnées copiées')}>
                          <Copy size={14} color="currentColor" />Copier
                        </button>
                        <a className="vd-btn vd-btn-g vd-btn-s" href={`https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`} target="_blank" rel="noreferrer">
                          <Routing2 size={14} color="currentColor" />Itinéraire
                        </a>
                      </div>
                    </>
                  ) : (
                    <p className="vd-text">Coordonnées non disponibles.</p>
                  )}
                </div>
              </div>

              <div className="vd-card vd-pad vd-mt16">
                <h3><MagicStar size={16} variant="Bold" color="var(--color-accent-text)" />Analyse d'impact IA</h3>
                {pred ? (
                  <div className="vc-ia">
                    {score !== undefined && score !== null && (
                      <div className="vd-score">
                        <Jauge score={score} />
                        <div>
                          <h3>Score d'impact : {niveauScore(score).libelle}</h3>
                          <p>Exposition humaine, environnement et infrastructures proches.</p>
                        </div>
                      </div>
                    )}
                    <div className="vd-rows">
                      {pred.total_population_exposed !== undefined && (
                        <Ligne libelle="Population exposée">
                          {nombre(pred.total_population_exposed) ?? 0} personnes
                          {(pred.children_exposed !== undefined || pred.adult_men_exposed !== undefined) && (
                            <small className="vc-sub">
                              {nombre(pred.children_exposed) ?? 0} enfants · {nombre(pred.adult_men_exposed) ?? 0} hommes · {nombre(pred.adult_women_exposed) ?? 0} femmes
                            </small>
                          )}
                        </Ligne>
                      )}
                      {pred.residential_buildings !== undefined && <Ligne libelle="Bâtiments résidentiels">{nombre(pred.residential_buildings) ?? 0}</Ligne>}
                      {pred.water_points !== undefined && <Ligne libelle="Points d'eau">{nombre(pred.water_points) ?? 0}</Ligne>}
                      {Number(pred.schools) > 0 && <Ligne libelle="Écoles">{nombre(pred.schools)}</Ligne>}
                      {Number(pred.health_centers) > 0 && <Ligne libelle="Centres de santé">{nombre(pred.health_centers)}</Ligne>}
                    </div>
                  </div>
                ) : (
                  <p className="vd-text">Aucune analyse IA disponible pour ce signalement.</p>
                )}
                {pred?.recommendation && (
                  <div className="vd-alert vd-mt16">
                    <Danger size={20} variant="Bold" color="currentColor" />
                    <div className="vd-alert-t">
                      <b>Recommandation</b>
                      <p>{pred.recommendation}{pred.potential_risk?.message ? ` ${pred.potential_risk.message}` : ''}</p>
                    </div>
                  </div>
                )}
                {tags.length > 0 && (
                  <>
                    <h3 className="vd-mt">Domaines d'impact</h3>
                    <div className="vd-tags">{tags.map((t) => <span key={t}>{t}</span>)}</div>
                  </>
                )}
              </div>
            </section>
          )}

          {(ongletActif === 'organisations' || ongletActif === 'infos') && (
            <section className="vd-panel">
              <div className="vd-card vd-pad">
                <h3>Organisations impliquées <small>{organisations.length ? `${organisations.length} organisation${organisations.length > 1 ? 's' : ''}` : 'aucune pour le moment'}</small></h3>
                {organisations.length > 0 && (
                  <div className="vd-orgs">
                    {organisations.map((o) => (
                      <div key={o.nom} className="vd-org">
                        <span className="vd-av">{o.nom[0].toUpperCase()}</span>
                        <b>{o.nom}{o.nom === collaboration.organisation && <span className="vc-you"> · vous</span>}</b>
                        <span className="vd-chip vd-chip-role">{o.principal && <Crown1 size={13} variant="Bold" color="currentColor" />}{o.role}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="vd-rows vd-mt16 vc-mine">
                  <Ligne libelle="Votre organisation">{collaboration.organisation || '—'}</Ligne>
                  <Ligne libelle="Votre rôle">{formatRole(collaboration.userRole)}</Ligne>
                  <Ligne libelle="Invitation">{formatStatus(collaboration.status)}</Ligne>
                  <Ligne libelle="Rejointe le">{collaboration.joinedAt}</Ligne>
                </div>
                {boutonSuggerer && <div className="vd-cta">{boutonSuggerer}</div>}
              </div>
            </section>
          )}
        </div>

        {!etroit && (
          <aside className="vc-work-side">
            <Discussion discussion={discussion} lectureSeule={lectureSeule} onRapports={onRapports} />
          </aside>
        )}
      </div>

      {estTelephone && !lectureSeule && (
        <div className="vdm-barre">
          {estLeader && peutResoudre && liste.length > 0 ? (
            <>
              <button type="button" className="vdm-agir vcm-resoudre" onClick={onResoudre}>Résoudre le signalement</button>
              <button type="button" className="vdm-agir-plus" onClick={onCreerTache} aria-label="Nouvelle tâche">
                <Add size={20} color="currentColor" />
              </button>
            </>
          ) : (
            <button type="button" className="vdm-agir" onClick={onCreerTache}>Nouvelle tâche</button>
          )}
        </div>
      )}
    </div>
  );
};

export default VueCollaboration;
