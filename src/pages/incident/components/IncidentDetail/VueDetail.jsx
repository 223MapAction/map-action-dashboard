import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft2, Location, Calendar, UserAdd, Danger, MagicStar, Play, Pause,
  VideoSquare, Microphone2, Copy, Routing2, Share, Wind, People, Drop,
  Tree, Buildings2, Gallery, InfoCircle, Crown1, Health, ArrowDown2, Profile, CloseCircle, Briefcase, Add,
} from 'iconsax-react';
import { ShimmerThumbnail, ShimmerTitle, ShimmerText } from 'react-shimmer-effects';
import { IS_MAPBOX } from '../../../../config/mapEngine';
import { OSM_STYLE, MAPBOX_SATELLITE_STYLE, HAS_SATELLITE_STYLE as HAS_MAPBOX_SATELLITE } from '../../../../config/mapStyles';
import { MapDetailViewMapLibre } from './MapDetailViewMapLibre';
import { MapDetailViewMapbox } from './MapDetailViewMapbox';
import { BlurryImage } from '../../../../components/atoms/BlurryImage';
import { gravite, couleurGravite, couleurTexteGravite, libelleGravite } from '../../../../utils/gravite';
import { titreIncident, descriptionRedondante } from '../../../../utils/titreIncident';
import { nombre, niveauScore } from './mesures';
import './vue-detail.css';
import './vue-detail-chat.css';
import './vue-detail-agir.css';

/* --------------------------------------------------------------------------
 * Libellés
 * ------------------------------------------------------------------------ */

// Les vecteurs arrivent en anglais brut depuis le modèle (« wind »,
// « human_contact »…). On les traduit et on leur associe une icône.
const VECTEURS = {
  wind: ['Vent', Wind],
  air: ['Air', Wind],
  water: ['Eau', Drop],
  water_flow: ["Courant d'eau", Drop],
  runoff: ['Ruissellement', Drop],
  surface_runoff: ['Ruissellement', Drop],
  groundwater: ['Nappe phréatique', Drop],
  human_contact: ['Contact humain', People],
  vectors_insects_rodents: ['Insectes et rongeurs', Health],
  insects: ['Insectes', Health],
  rodents: ['Rongeurs', Health],
  soil: ['Sol', Tree],
};

const traduireVecteur = (brut) => {
  const cle = String(brut).trim().toLowerCase();
  if (VECTEURS[cle]) return VECTEURS[cle];
  const lisible = cle.replace(/_/g, ' ');
  return [lisible.charAt(0).toUpperCase() + lisible.slice(1), InfoCircle];
};

const enListe = (valeur) => {
  if (!valeur) return [];
  if (Array.isArray(valeur)) return valeur.map(String).map((v) => v.trim()).filter(Boolean);
  return String(valeur).split(',').map((v) => v.trim()).filter(Boolean);
};

const lectureNdvi = (v) => (v === null ? '' : v < 0.2 ? 'végétation faible' : v < 0.5 ? 'végétation moyenne' : 'végétation dense');
const lectureNdwi = (v) => (v === null ? '' : v < 0 ? 'sol sec' : 'présence d\'eau');

const formatTime = (seconds) => {
  if (!seconds || Number.isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const tempsDepuis = (iso) => {
  if (!iso) return '';
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(minutes) || minutes < 0) return '';
  if (minutes < 60) return `il y a ${Math.max(minutes, 1)} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  return jours === 1 ? 'hier' : `il y a ${jours} j`;
};

const dateHeure = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

/* --------------------------------------------------------------------------
 * Petits composants
 * ------------------------------------------------------------------------ */

const Pastille = ({ badge }) =>
  badge ? (
    <span className="vd-chip" style={{ backgroundColor: badge.bg, color: badge.color }}>
      {badge.icon}
      {badge.label}
    </span>
  ) : null;

export const Jauge = ({ score }) => {
  const s = Math.max(0, Math.min(10, Number(score) || 0));
  const { couleur } = niveauScore(score);
  const longueur = 226; // arc de 270° sur r=48
  return (
    <svg className="vd-gauge" viewBox="0 0 120 120" role="img" aria-label={`Score d'impact ${nombre(score, 2)} sur 10`}>
      <circle cx="60" cy="60" r="48" fill="none" stroke="var(--color-border)" strokeWidth="12" strokeDasharray={`${longueur} 302`} transform="rotate(135 60 60)" strokeLinecap="round" />
      <circle className="vd-gauge-val" cx="60" cy="60" r="48" fill="none" stroke={couleur} strokeWidth="12" strokeDasharray={`${(s / 10) * longueur} 302`} transform="rotate(135 60 60)" strokeLinecap="round" />
      <text x="60" y="62" textAnchor="middle" className="vd-gauge-num">{nombre(score, 2) ?? '—'}</text>
      <text x="60" y="80" textAnchor="middle" className="vd-gauge-sub">sur 10</text>
    </svg>
  );
};

const Ligne = ({ libelle, valeur, aide, zero }) => (
  <div className="vd-row">
    <span>
      {libelle}
      {aide && <span className="vd-tip" title={aide} aria-label={aide}>?</span>}
    </span>
    <b className={zero ? 'is-zero' : ''}>{valeur}</b>
  </div>
);

const MapDetailView = IS_MAPBOX ? MapDetailViewMapbox : MapDetailViewMapLibre;

const VidePrediction = ({ predictionError }) => (
  <div className="vd-empty">
    <span className="vd-empty-ic"><MagicStar size={24} variant="Bold" color="currentColor" /></span>
    <b>Analyse IA pas encore disponible</b>
    <p>
      {predictionError?.response?.status === 404
        ? 'Le modèle traite ce signalement. Les résultats apparaîtront ici automatiquement.'
        : "L'analyse prédictive, satellite et de vulnérabilité sociale n'a pas encore été générée."}
    </p>
  </div>
);
/* --------------------------------------------------------------------------
 * Vue
 * ------------------------------------------------------------------------ */

export const VueDetail = (props) => {
  const {
    safeIncident, pred, isLoadingPrediction, predictionError, etapes,
    currentStatus, modeBadge, userRoleBadge, collabRequest, getRoleLabel, getStatusLabel,
    showInvolvementButton, hasPendingRequest, hasAcceptedRole, openJoinModal, onBack, takingOrg,
    audioRef, isPlaying, setIsPlaying, currentTime, duration, togglePlay,
    onAudioTimeUpdate, onAudioLoaded, onAudioEnded, seekAudio, seekAudioClavier,
    carteDetailRef, detailMapStyle, setDetailMapStyle, ouvrirImage, onToast,
  } = props;

  const [onglet, setOnglet] = useState('apercu');
  const [media, setMedia] = useState('photo');
  const [menuAgir, setMenuAgir] = useState(false);
  const [visionneuse, setVisionneuse] = useState(null);
  const refAgir = useRef(null);

  // Le menu « Agir » se ferme au clic extérieur et à Échap
  useEffect(() => {
    if (!menuAgir) return undefined;
    const dehors = (e) => { if (refAgir.current && !refAgir.current.contains(e.target)) setMenuAgir(false); };
    const echap = (e) => { if (e.key === 'Escape') setMenuAgir(false); };
    document.addEventListener('mousedown', dehors);
    document.addEventListener('keydown', echap);
    return () => { document.removeEventListener('mousedown', dehors); document.removeEventListener('keydown', echap); };
  }, [menuAgir]);

  useEffect(() => {
    if (!visionneuse) return undefined;
    const echap = (e) => { if (e.key === 'Escape') setVisionneuse(null); };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [visionneuse]);

  const niveau = gravite(safeIncident);
  const titre = titreIncident(safeIncident, 400);
  const coords = safeIncident.coordinates;
  const etat = safeIncident.etat || 'declared';
  const indexEtape = Math.max(0, etapes.findIndex((e) => e.id === etat));
  const score = pred?.global_impact_score;
  const lecture = niveauScore(score);
  const audioSrc = safeIncident.aiAnalysis?.audio;
  const isCollab = ['collaborative', 'collaboratif'].includes(safeIncident.take_in_charge_mode);
  const isInterne = ['internal', 'interne'].includes(safeIncident.take_in_charge_mode);

  const avecMenu = etat === 'declared' && !safeIncident.isOwner && !hasAcceptedRole && !isInterne;
  const agir = (mode) => { setMenuAgir(false); openJoinModal(mode); };
  const libelleAction = safeIncident.isOwner || hasAcceptedRole
    ? 'Inviter des organisations'
    : etat === 'declared' ? 'Agir sur ce signalement' : "Rejoindre l'action";

  const organisations = useMemo(() => {
    const liste = [];
    const nomPrincipal = (typeof safeIncident.taken_by_organisation === 'object' && safeIncident.taken_by_organisation?.name) || safeIncident.taken_by_name;
    if (nomPrincipal) liste.push({ nom: nomPrincipal, role: isCollab ? 'Leader' : 'Prise en charge', principal: true });
    (safeIncident.acting_organisations || []).forEach((o) => {
      if (o?.name && o.name !== nomPrincipal) {
        liste.push({ nom: o.name, role: o.relation === 'leader' ? 'Leader' : o.relation === 'co-leader' ? 'Co-leader' : 'Partenaire' });
      }
    });
    return liste;
  }, [safeIncident, isCollab]);

  const activite = useMemo(() => {
    const e = [];
    if (pred?.status === 'completed') e.push({ qui: 'IA', couleur: '#475569', texte: <><b>Analyse IA</b> terminée{pred.sub_category ? ` : ${pred.sub_category.toLowerCase()}` : ''}</> });
    if (safeIncident.resolution_end_date || etat === 'resolved') e.push({ qui: '✓', couleur: 'var(--color-success-text)', texte: <><b>Signalement résolu</b></>, quand: dateHeure(safeIncident.resolution_end_date) });
    if (safeIncident.taken_in_charge_at || etat !== 'declared') e.push({ qui: (organisations[0]?.nom || 'O')[0].toUpperCase(), couleur: '#1E78AC', texte: <><b>{organisations[0]?.nom || 'Une organisation'}</b> a pris le signalement en charge{isCollab ? ' en collaboration' : isInterne ? ' en interne' : ''}</>, quand: dateHeure(safeIncident.taken_in_charge_at) });
    if (collabRequest) e.push({ qui: 'V', couleur: '#0E7490', texte: <>Votre demande <b>{getRoleLabel(collabRequest.role)}</b> : {getStatusLabel(collabRequest.status).toLowerCase()}</> });
    e.push({ qui: 'S', couleur: '#334155', texte: <><b>Signalement</b> créé depuis l'application</>, quand: dateHeure(safeIncident.created_at) || safeIncident.startDate });
    return e;
  }, [pred, safeIncident, etat, organisations, isCollab, isInterne, collabRequest, getRoleLabel, getStatusLabel]);

  const copier = async (texte, message) => {
    try {
      await navigator.clipboard.writeText(texte);
      onToast?.(message);
    } catch {
      onToast?.('Copie impossible dans ce navigateur');
    }
  };

  const vecteurs = enListe(pred?.spread_vectors);
  const tags = enListe(pred?.impact_tags);
  const ndvi = pred?.satellite?.ndvi != null ? Number(pred.satellite.ndvi) : null;
  const ndwi = pred?.satellite?.ndwi != null ? Number(pred.satellite.ndwi) : null;
  const altitude = Number(pred?.topography?.elevation);
  const total = Number(pred?.total_population_exposed) || 0;
  const pct = (v) => (total ? `${(Number(v || 0) / total) * 100}%` : '0%');
  const rayon = pred?.potential_risk?.potential_radius || pred?.impact_radius_meters;


  const sansPrediction = !isLoadingPrediction && !pred;


  return (
    <div className="vd">
      {/* Fil d'Ariane */}
      <nav className="vd-crumb" aria-label="Fil d'Ariane">
        <button type="button" className="vd-back" onClick={onBack} aria-label="Retour à la liste">
          <ArrowLeft2 size={16} color="currentColor" />
        </button>
        <button type="button" className="vd-crumb-link" onClick={onBack}>Signalements</button>
        <span>/</span>
        <span>{safeIncident.zone || 'Signalement'}</span>
      </nav>

      {/* En-tête */}
      <header className="vd-head">
        <div className="vd-head-t">
          <h1>{titre}</h1>
          <div className="vd-chips">
            <Pastille badge={currentStatus} />
            {safeIncident.severity && (
              <span className="vd-chip" style={{ backgroundColor: `var(--color-severity-${niveau}-surface)`, color: couleurTexteGravite(niveau) }}>
                <i style={{ backgroundColor: couleurGravite(niveau) }} />Gravité {libelleGravite(niveau).toLowerCase()}
              </span>
            )}
            {pred?.status === 'completed' && (
              <span className="vd-chip vd-chip-ia"><MagicStar size={13} variant="Bold" color="currentColor" />Analysé par l'IA</span>
            )}
            <Pastille badge={modeBadge} />
            <Pastille badge={userRoleBadge} />
            {collabRequest && (
              <span className="vd-chip vd-chip-attente">
                <i style={{ backgroundColor: 'currentColor' }} />
                Demande {getRoleLabel(collabRequest.role)} : {getStatusLabel(collabRequest.status)}
              </span>
            )}
          </div>
          <div className="vd-meta">
            <span><Location size={15} color="currentColor" />{safeIncident.zone || safeIncident.location || 'Localisation non spécifiée'}</span>
            <span>
              <Calendar size={15} color="currentColor" />
              Signalé {safeIncident.created_at ? `le ${new Date(safeIncident.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} à ${new Date(safeIncident.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ')}` : `le ${safeIncident.startDate}`}
              {tempsDepuis(safeIncident.created_at) && ` · ${tempsDepuis(safeIncident.created_at)}`}
            </span>
            <span><Profile size={15} color="currentColor" />{safeIncident.reporter_name || safeIncident.user_name || "Citoyen, via l'application"}</span>
          </div>
        </div>
        <div className="vd-actions">
          <button type="button" className="vd-btn vd-btn-g" onClick={() => copier(window.location.href, 'Lien du signalement copié')}>
            <Share size={16} color="currentColor" />Partager
          </button>
          {showInvolvementButton && (
            <div className="vd-agir-wrap" ref={refAgir}>
              <button
                type="button"
                className="vd-btn vd-btn-p"
                onClick={() => (avecMenu ? setMenuAgir((o) => !o) : openJoinModal())}
                disabled={!!hasPendingRequest}
                aria-haspopup={avecMenu ? 'menu' : undefined}
                aria-expanded={avecMenu ? menuAgir : undefined}
              >
                {hasPendingRequest ? (
                  <><span className="vd-dot" />Demande en attente</>
                ) : (
                  <>
                    <UserAdd size={16} variant="Bold" color="currentColor" />{libelleAction}
                    {avecMenu && <ArrowDown2 size={14} color="currentColor" className={`vd-caret ${menuAgir ? 'is-open' : ''}`} />}
                  </>
                )}
              </button>
              {avecMenu && menuAgir && (
                <div className="vd-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => agir('interne')}>
                    <span className="vd-menu-ic"><Briefcase size={16} variant="Bold" color="currentColor" /></span>
                    <span><b>Prendre en charge</b><small>Votre organisation devient responsable</small></span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => agir('collaboration')}>
                    <span className="vd-menu-ic"><People size={16} variant="Bold" color="currentColor" /></span>
                    <span><b>Lancer une collaboration</b><small>Vous pilotez, d'autres organisations contribuent</small></span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => agir('collaboration')}>
                    <span className="vd-menu-ic"><Add size={16} color="currentColor" /></span>
                    <span><b>Inviter des organisations</b><small>Ouvre la collaboration et choisit les invités</small></span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Bandeaux d'implication */}
      {isCollab && !safeIncident.taken_by && (
        <div className="vd-banner">
          <People size={18} variant="Bold" color="currentColor" />
          <span><b>Ouvert à la collaboration :</b> des organisations se mobilisent, mais aucun leader ne coordonne encore. Prenez le leadership ou rejoignez l'effort.</span>
        </div>
      )}
      {isInterne && takingOrg && (
        <div className={`vd-banner ${takingOrg.isMe ? 'vd-banner-ok' : 'vd-banner-int'}`}>
          <Buildings2 size={18} variant="Bold" color="currentColor" />
          <span>
            <b>Géré en interne :</b>{' '}
            {takingOrg.isMe
              ? 'votre organisation traite ce signalement avec ses propres équipes.'
              : <>l'organisation <b>{takingOrg.name}</b> traite ce signalement avec ses propres équipes.</>}
          </span>
        </div>
      )}

      {/* Alerte de propagation */}
      {pred && (rayon || pred.recommendation || pred.potential_risk) && (
        <div className="vd-alert" role="status">
          <Danger size={22} variant="Bold" color="currentColor" />
          <div className="vd-alert-t">
            <b>{rayon ? `Intervention recommandée dans un rayon de ${nombre(rayon)} m` : 'Intervention recommandée'}</b>
            <p>
              {pred.potential_risk?.message || pred.recommendation || pred.piste_solution}
              {enListe(pred.spread_vectors).length > 0 && (
                <> Vecteurs : {enListe(pred.spread_vectors).map((v) => traduireVecteur(v)[0].toLowerCase()).join(', ')}.</>
              )}
            </p>
          </div>
          <div className="vd-alert-k">
            {nombre(pred.potential_risk?.stats?.total_pop ?? pred.total_population_exposed) && (
              <span><strong>{nombre(pred.potential_risk?.stats?.total_pop ?? pred.total_population_exposed)}</strong>personnes exposées</span>
            )}
            {nombre(pred.potential_risk?.stats?.infrastructures ?? pred.residential_buildings) && (
              <span><strong>{nombre(pred.potential_risk?.stats?.infrastructures ?? pred.residential_buildings)}</strong>bâtiments à risque</span>
            )}
            {rayon && <span><strong>{nombre(rayon)} m</strong>rayon d'action</span>}
          </div>
        </div>
      )}

      {/* Médias + décision */}
      <section className="vd-hero">
        <div className="vd-card vd-media">
          <div className="vd-stage">
            {media === 'video' && safeIncident.video ? (
              <video src={safeIncident.video} controls className="vd-video" />
            ) : safeIncident.image ? (
              <button type="button" className="vd-photo" onClick={ouvrirImage} aria-label="Agrandir la photo">
                <BlurryImage src={safeIncident.image} alt={titre} className="vd-photo-img" />
                <span className="vd-zoom"><Gallery size={14} color="currentColor" />Agrandir</span>
              </button>
            ) : (
              <div className="vd-photo vd-photo-vide"><Gallery size={28} color="currentColor" /><span>Aucune photo</span></div>
            )}
          </div>
          <div className="vd-thumbs" role="tablist" aria-label="Médias">
            <button type="button" role="tab" aria-selected={media === 'photo'} className={`vd-th ${media === 'photo' ? 'is-on' : ''}`} onClick={() => setMedia('photo')}>Photo</button>
            <button
              type="button" role="tab" aria-selected={media === 'video'}
              className={`vd-th ${media === 'video' ? 'is-on' : ''} ${safeIncident.video ? '' : 'is-off'}`}
              onClick={() => safeIncident.video && setMedia('video')}
              disabled={!safeIncident.video}
              title={safeIncident.video ? 'Voir la vidéo' : 'Aucune vidéo pour ce signalement'}
            >
              <VideoSquare size={18} color="currentColor" />
            </button>
            <button
              type="button" role="tab" aria-selected={media === 'audio'}
              className={`vd-th ${media === 'audio' ? 'is-on' : ''} ${audioSrc ? '' : 'is-off'}`}
              onClick={() => audioSrc && setMedia(media === 'audio' ? 'photo' : 'audio')}
              disabled={!audioSrc}
              title={audioSrc ? 'Écouter le message vocal' : 'Aucun message vocal'}
            >
              <Microphone2 size={18} color="currentColor" />
            </button>
          </div>
          {audioSrc && (
            <div className={`vd-audio ${media === 'audio' ? 'is-open' : ''}`} aria-hidden={media !== 'audio'}>
              <button type="button" className="vd-play" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Lire le message vocal'}>
                {isPlaying ? <Pause size={16} variant="Bold" color="currentColor" /> : <Play size={16} variant="Bold" color="currentColor" />}
              </button>
              <div
                className="vd-audio-track"
                onClick={seekAudio}
                onKeyDown={seekAudioClavier}
                role="slider"
                tabIndex={media === 'audio' ? 0 : -1}
                aria-label="Progression audio"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration || 0)}
                aria-valuenow={Math.round(currentTime || 0)}
                aria-valuetext={`${formatTime(currentTime)} sur ${formatTime(duration)}`}
              >
                <span style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
              </div>
              <time>{formatTime(currentTime)} / {formatTime(duration)}</time>
              <audio
                ref={audioRef}
                src={audioSrc}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={onAudioTimeUpdate}
                onLoadedMetadata={onAudioLoaded}
                onEnded={onAudioEnded}
                preload="metadata"
              />
            </div>
          )}
        </div>

        <div className="vd-card vd-decide">
          {isLoadingPrediction ? (
            <div className="vd-sk"><ShimmerThumbnail height={112} width={112} rounded /><div style={{ flex: 1 }}><ShimmerTitle line={1} gap={8} /><ShimmerText line={3} gap={8} /></div></div>
          ) : pred ? (
            <div className="vd-score">
              <Jauge score={score} />
              <div>
                <h3>Score d'impact : {lecture.libelle}</h3>
                <p>Calculé à partir de l'exposition humaine, de l'environnement et des infrastructures proches.</p>
                <div className="vd-scale"><span /><span /><span /></div>
                <div className="vd-scale-l"><span>0 Faible</span><span>4 Moyen</span><span>7 Élevé 10</span></div>
              </div>
            </div>
          ) : (
            <VidePrediction predictionError={predictionError} />
          )}

          <div>
            <p className="vd-sec">Suivi</p>
            <div className="vd-steps">
              {etapes.map((etape, i) => (
                <div key={etape.id} className={`vd-step ${i < indexEtape || etat === 'resolved' ? 'is-done' : i === indexEtape ? 'is-cur' : ''}`}>
                  <i />
                  {etape.label}
                  <small>
                    {etape.id === 'declared' && (dateHeure(safeIncident.created_at) || safeIncident.startDate)}
                    {etape.id === 'taken_into_account' && (i <= indexEtape ? (organisations[0]?.nom || 'Pris en compte') : 'en attente')}
                    {etape.id === 'resolved' && (etat === 'resolved' ? (dateHeure(safeIncident.resolution_end_date) || 'Résolu') : '—')}
                  </small>
                </div>
              ))}
            </div>
          </div>

          {pred && (
            <div className="vd-kpis">
              <div className="vd-kpi"><b>{nombre(pred.total_population_exposed) ?? '—'}</b><span>personnes exposées</span></div>
              <div className="vd-kpi"><b>{nombre(pred.social_vulnerability_score, 1) ?? '—'}<small>/10</small></b><span>vulnérabilité sociale</span></div>
              <div className="vd-kpi"><b>{nombre(pred.residential_buildings ?? pred.social_data?.residential_buildings) ?? '—'}</b><span>bâtiments proches</span></div>
            </div>
          )}
        </div>
      </section>

      {/* Onglets */}
      <nav className="vd-tabs" role="tablist">
        {[
          ['apercu', 'Aperçu'],
          ['ia', 'Analyse IA'],
          ['impact', 'Impact', pred ? '3 piliers' : null],
          ['activite', 'Activité', activite.length],
        ].map(([cle, libelle, n]) => (
          <button key={cle} type="button" role="tab" aria-selected={onglet === cle} className={onglet === cle ? 'is-on' : ''} onClick={() => setOnglet(cle)}>
            {cle === 'ia' && <MagicStar size={15} color="currentColor" />}
            {libelle}
            {n ? <span className="vd-n">{n}</span> : null}
          </button>
        ))}
      </nav>

      {/* APERÇU */}
      {onglet === 'apercu' && (
        <section className="vd-panel">
          <div className="vd-grid2">
            <div className="vd-card vd-pad">
              <h3>Description</h3>
              <p className="vd-text">
                {descriptionRedondante(safeIncident) && safeIncident.description ? safeIncident.description : (safeIncident.description || 'Aucune description disponible')}
              </p>
              {pred?.display_name && (
                <>
                  <h3 className="vd-mt">Adresse estimée par l'IA</h3>
                  <p className="vd-text">{pred.display_name}</p>
                </>
              )}
            </div>
            <div className="vd-card vd-pad">
              <h3>Localisation {rayon && <small>zone d'intervention : {nombre(rayon)} m</small>}</h3>
              {coords ? (
                <>
                  <div className="vd-map">
                    <MapDetailView
                      carteRef={carteDetailRef}
                      longitude={coords.lng}
                      latitude={coords.lat}
                      mapStyle={detailMapStyle === 'satellite' && MAPBOX_SATELLITE_STYLE ? MAPBOX_SATELLITE_STYLE : OSM_STYLE}
                      rayon={Number(rayon) || 0}
                      couleur={niveau === 'high' ? '#EF4444' : niveau === 'medium' ? '#F97316' : '#EAB308'}
                    />
                    <div className="vd-mstyle" role="group" aria-label="Fond de carte">
                      <button type="button" className={detailMapStyle !== 'satellite' ? 'is-on' : ''} onClick={() => setDetailMapStyle('streets')}>Plan</button>
                      {HAS_MAPBOX_SATELLITE && (
                        <button type="button" className={detailMapStyle === 'satellite' ? 'is-on' : ''} onClick={() => setDetailMapStyle('satellite')}>Satellite</button>
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
            <h3>Organisations impliquées <small>{organisations.length ? `${organisations.length} organisation${organisations.length > 1 ? 's' : ''}` : 'aucune pour le moment'}</small></h3>
            {organisations.length ? (
              <div className="vd-orgs">
                {organisations.map((o) => (
                  <div key={o.nom} className="vd-org">
                    <span className="vd-av">{o.nom[0].toUpperCase()}</span>
                    <b>{o.nom}</b>
                    <span className="vd-chip vd-chip-role">{o.role === 'Leader' && <Crown1 size={13} variant="Bold" color="currentColor" />}{o.role}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="vd-text">
                Personne n'a encore pris ce signalement en charge.
                {showInvolvementButton && !hasPendingRequest && (
                  <> <button type="button" className="vd-link" onClick={() => (avecMenu ? setMenuAgir(true) : openJoinModal())}>{libelleAction}</button></>
                )}
              </p>
            )}
          </div>
        </section>
      )}

      {/* ANALYSE IA */}
      {onglet === 'ia' && (
        <section className="vd-panel">
          {isLoadingPrediction ? (
            <div className="vd-card vd-pad"><ShimmerTitle line={1} gap={8} /><ShimmerText line={5} gap={8} /></div>
          ) : sansPrediction ? (
            <div className="vd-card"><VidePrediction predictionError={predictionError} /></div>
          ) : (
            <div className="vd-grid2">
              <div className="vd-card vd-pad">
                <div className="vd-chips vd-mb">
                  <span className="vd-chip vd-chip-ia"><MagicStar size={13} variant="Bold" color="currentColor" />{pred.status === 'completed' ? 'Analyse terminée' : 'Analyse en cours'}</span>
                  {pred.sub_category && <span className="vd-chip vd-chip-motif">{pred.sub_category}</span>}
                  {(pred.incident_type || pred.macro_category) && <span className="vd-chip vd-chip-neutre">{pred.incident_type || pred.macro_category}</span>}
                </div>
                <p className="vd-text">{pred.analysis || pred.description}</p>
                {(pred.city || pred.region || pred.country) && (
                  <dl className="vd-dl">
                    {pred.city && <><dt>Ville</dt><dd>{pred.city}</dd></>}
                    {pred.region && pred.region !== 'Inconnue' && <><dt>Région</dt><dd>{pred.region}</dd></>}
                    {pred.country && <><dt>Pays</dt><dd>{pred.country}</dd></>}
                  </dl>
                )}
              </div>
              <div className="vd-card vd-pad">
                <h3>Vecteurs de propagation</h3>
                {vecteurs.length ? (
                  <div className="vd-vect">
                    {vecteurs.map((v) => {
                      const [libelle, icone] = traduireVecteur(v);
                      return <span key={v}>{React.createElement(icone, { size: 15, color: 'currentColor' })}{libelle}</span>;
                    })}
                  </div>
                ) : <p className="vd-text">Aucun vecteur identifié.</p>}
                {pred.potential_risk?.vector && (
                  <p className="vd-text vd-mt8">
                    Propagation secondaire par <b>{traduireVecteur(pred.potential_risk.vector)[0].toLowerCase()}</b>
                    {pred.potential_risk.distance ? <> sur environ <b>{nombre(pred.potential_risk.distance)} m</b></> : null}.
                  </p>
                )}
                {tags.length > 0 && (
                  <>
                    <h3 className="vd-mt">Impacts secondaires</h3>
                    <div className="vd-tags">{tags.map((t) => <span key={t}>{t}</span>)}</div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* IMPACT */}
      {onglet === 'impact' && (
        <section className="vd-panel">
          {isLoadingPrediction ? (
            <div className="vd-grid3">{[0, 1, 2].map((n) => <div key={n} className="vd-card vd-pad"><ShimmerTitle line={1} gap={8} /><ShimmerText line={6} gap={8} /></div>)}</div>
          ) : sansPrediction ? (
            <div className="vd-card"><VidePrediction predictionError={predictionError} /></div>
          ) : (
            <div className="vd-grid3">
              <div className="vd-card vd-pad">
                <h3>Social</h3>
                <div className="vd-big">{nombre(pred.total_population_exposed) ?? '—'} <span>personnes exposées</span></div>
                <div className="vd-stack" aria-hidden="true">
                  <i style={{ width: pct(pred.adult_men_exposed), background: '#1E78AC' }} />
                  <i style={{ width: pct(pred.adult_women_exposed), background: '#7CC4EA' }} />
                  <i style={{ width: pct(pred.children_exposed), background: 'var(--color-severity-low)' }} />
                </div>
                <div className="vd-lg">
                  <span><i style={{ background: '#1E78AC' }} />Hommes <b>{nombre(pred.adult_men_exposed) ?? 0}</b></span>
                  <span><i style={{ background: '#7CC4EA' }} />Femmes <b>{nombre(pred.adult_women_exposed) ?? 0}</b></span>
                  <span><i style={{ background: 'var(--color-severity-low)' }} />Enfants <b>{nombre(pred.children_exposed) ?? 0}</b></span>
                </div>
                <div className="vd-vul">
                  <div><span>Vulnérabilité sociale{pred.is_social_probabilistic && <span className="vd-tip" title="Valeur estimée par modèle probabiliste">?</span>}</span><b>{nombre(pred.social_vulnerability_score, 1) ?? '—'} / 10</b></div>
                  <div className="vd-bar"><i style={{ width: `${Math.min(100, (Number(pred.social_vulnerability_score) || 0) * 10)}%`, background: niveauScore(pred.social_vulnerability_score).couleur }} /></div>
                </div>
                <div className="vd-rows">
                  <Ligne libelle="Maternités" valeur={(pred.maternities_count ?? pred.maternities ?? 0) || 'Aucune à proximité'} zero={!(pred.maternities_count ?? pred.maternities)} />
                  <Ligne libelle="Crèches" valeur={(pred.nurseries_count ?? pred.nurseries ?? 0) || 'Aucune à proximité'} zero={!(pred.nurseries_count ?? pred.nurseries)} />
                  <Ligne libelle="Centres de santé" valeur={pred.health_centers || 'Aucun à proximité'} zero={!pred.health_centers} />
                </div>
              </div>

              <div className="vd-card vd-pad">
                <h3>Environnement</h3>
                <div className="vd-rows">
                  <Ligne libelle="Température" valeur={nombre(pred.topography?.temperature_celsius, 1) ? `${nombre(pred.topography.temperature_celsius, 1)} °C` : '—'} />
                  <Ligne libelle="Précipitations" valeur={nombre(pred.topography?.precipitation, 1) != null ? `${nombre(pred.topography.precipitation, 1)} mm` : '—'} />
                  <Ligne libelle="Vent" valeur={nombre(pred.topography?.wind_speed, 1) ? `${nombre(pred.topography.wind_speed, 1)} km/h` : '—'} />
                  <Ligne libelle="Pente" valeur={nombre(pred.topography?.slope_percent, 1) != null ? `${nombre(pred.topography.slope_percent, 1)} %` : '—'} />
                  <Ligne libelle="Végétation" aide="NDVI, de -1 à 1 : sous 0,2, sol nu ou bâti" valeur={ndvi === null ? '—' : `${nombre(ndvi, 2)} · ${lectureNdvi(ndvi)}`} />
                  <Ligne libelle="Humidité de surface" aide="NDWI : une valeur négative indique un sol sec" valeur={ndwi === null ? '—' : `${nombre(ndwi, 2)} · ${lectureNdwi(ndwi)}`} />
                  <Ligne libelle="Occupation du sol" valeur={pred.satellite?.land_use || '—'} />
                  <Ligne libelle="Altitude" valeur={altitude > 0 ? `${nombre(altitude)} m` : 'Non mesurée'} zero={!(altitude > 0)} />
                </div>
                {(pred.landcover_plot || pred.ndvi_heatmap || pred.ndvi_ndwi_plot) && (
                  <div className="vd-sat">
                    {[[pred.landcover_plot, 'Couverture du sol'], [pred.ndvi_heatmap, 'Végétation (NDVI)'], [pred.ndvi_ndwi_plot, 'NDVI et NDWI']]
                      .filter(([src]) => src)
                      .map(([src, libelle]) => (
                        <button key={libelle} type="button" className="vd-sat-btn" onClick={() => setVisionneuse({ src, libelle })} title={`Agrandir : ${libelle}`}>
                          <BlurryImage src={src} alt={libelle} className="vd-sat-img" />
                          <small>{libelle}</small>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="vd-card vd-pad">
                <h3>Économie {rayon && <small>dans la zone de {nombre(rayon)} m</small>}</h3>
                <div className="vd-rows">
                  {[
                    ['Bâtiments', pred.residential_buildings ?? pred.social_data?.residential_buildings],
                    ['Écoles', pred.schools ?? pred.social_data?.schools],
                    ['Marchés', pred.markets ?? pred.social_data?.markets],
                    ["Sources d'eau", pred.water_points ?? pred.social_data?.water_points],
                    ['Routes et ponts', pred.main_roads_bridges ?? pred.social_data?.main_roads_bridges],
                  ].map(([l, v]) => <Ligne key={l} libelle={l} valeur={nombre(v) ?? 0} zero={!Number(v)} />)}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* ACTIVITÉ */}
      {onglet === 'activite' && (
        <section className="vd-panel">
          <div className="vd-card vd-pad">
            <h3>Activité</h3>
            <ul className="vd-tl">
              {activite.map((a, i) => (
                <li key={i}>
                  <span className="vd-av" style={{ background: a.couleur }}>{a.qui}</span>
                  <p>{a.texte}</p>
                  {a.quand && <time>{a.quand}</time>}
                </li>
              ))}
            </ul>
            {showInvolvementButton && !hasPendingRequest && etat === 'declared' && (
              <div className="vd-cta">
                <button type="button" className="vd-btn vd-btn-p vd-btn-s" onClick={() => openJoinModal('interne')}>
                  <UserAdd size={14} variant="Bold" color="currentColor" />Être le premier à agir
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {visionneuse && (
        <div className="vd-lightbox" role="dialog" aria-modal="true" aria-label={visionneuse.libelle} onClick={() => setVisionneuse(null)}>
          <figure onClick={(e) => e.stopPropagation()}>
            <img src={visionneuse.src} alt={visionneuse.libelle} />
            <figcaption>{visionneuse.libelle}</figcaption>
            <button type="button" className="vd-lightbox-x" onClick={() => setVisionneuse(null)} aria-label="Fermer">
              <CloseCircle size={22} variant="Bold" color="currentColor" />
            </button>
          </figure>
        </div>
      )}
    </div>
  );
};

export default VueDetail;
