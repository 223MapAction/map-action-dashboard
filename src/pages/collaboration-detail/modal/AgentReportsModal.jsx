import React, { useEffect, useState } from 'react';
import useSWR from 'swr';
import { DocumentText, Danger } from 'iconsax-react';
import { ShimmerThumbnail, ShimmerText } from 'react-shimmer-effects';
import { getFieldReportsService } from '../../collaboration/service/collaboration_service';
import { BlurryImage } from '../../../components/atoms/BlurryImage';
import { Dialogue } from '../../../components/molecules/Dialogue';
import { ImageViewer } from '../../../components/molecules/ImageViewer';
import { logger } from '../../../utils/logger';
import { IcoRapport, IcoAgrandir } from './icones';

// Une couleur stable par agent : on reconnaît d'un coup d'œil qui est passé.
const COULEURS_AGENTS = ['#0E7490', '#7C3AED', '#B45309', '#1E78AC', '#BE185D', '#15803D'];
const couleurAgent = (nom = '') => COULEURS_AGENTS[[...nom].reduce((h, c, i) => h + c.charCodeAt(0) * (i + 1), 0) % COULEURS_AGENTS.length];

// Au-delà de cette distance, l'agent n'était manifestement pas devant le
// signalement : on le dit plutôt que d'afficher un nombre brut.
const SEUIL_SUR_PLACE = 50;

const quand = (iso) => {
  if (!iso) return 'Date inconnue';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const jour = new Date(d); jour.setHours(0, 0, 0, 0);
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const ecart = Math.round((auj - jour) / 86400000);
  const heure = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ');
  if (ecart === 0) return `Aujourd'hui, ${heure}`;
  if (ecart === 1) return `Hier, ${heure}`;
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}, ${heure}`;
};

const depuis = (iso) => {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(min) || min < 0) return '';
  if (min < 60) return `il y a ${Math.max(min, 1)} min`;
  if (min < 1440) return `il y a ${Math.floor(min / 60)} h`;
  return `il y a ${Math.floor(min / 1440)} j`;
};

const initiales = (nom = '') => nom.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0].toUpperCase()).join('') || 'AG';

export const AgentReportsModal = ({ isOpen, onClose, incidentId, latitude, longitude }) => {
  const [imageAZoomer, setImageAZoomer] = useState(null);
  const [liste, setListe] = useState([]);
  const [suivante, setSuivante] = useState(null);
  const [chargeSuite, setChargeSuite] = useState(false);
  const [avecPhoto, setAvecPhoto] = useState(false);

  const { data, error, isLoading } = useSWR(
    isOpen && incidentId ? `field-reports-${incidentId}` : null,
    () => getFieldReportsService({ incident_id: incidentId, page_size: 10 }),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    if (!data) return;
    setListe(data.results || []);
    setSuivante(data.next || null);
  }, [data]);

  const plus = async () => {
    if (!suivante || chargeSuite) return;
    setChargeSuite(true);
    try {
      const page = await getFieldReportsService({ url: suivante });
      setListe((l) => [...l, ...(page?.results || [])]);
      setSuivante(page?.next || null);
    } catch (err) {
      logger.error('[AgentReportsModal] Erreur chargement rapports:', err);
    } finally {
      setChargeSuite(false);
    }
  };

  if (!isOpen) return null;

  // L'API renvoie parfois des rapports d'autres signalements : on ne garde que les siens.
  const rapports = liste.filter((r) => {
    const id = r.incident ?? r.incident_id;
    return id !== undefined && id !== null && String(id).toLowerCase() === String(incidentId).toLowerCase();
  });
  const nbPhotos = rapports.filter((r) => r.photo).length;
  const affiches = avecPhoto ? rapports.filter((r) => r.photo) : rapports;
  const dernier = rapports[0]?.visited_at || rapports[0]?.created_at;

  return (
    <Dialogue
      onClose={onClose}
      taille="lg"
      titre="Rapports de terrain"
      sousTitre="Les visites des agents sur place, de la plus récente à la plus ancienne"
      icone={<IcoRapport />}
      barre={rapports.length > 0 ? (
        <>
          <div className="dg-segment" role="group" aria-label="Filtrer les rapports">
            <button type="button" aria-pressed={!avecPhoto} onClick={() => setAvecPhoto(false)}>Tous · {rapports.length}</button>
            <button type="button" aria-pressed={avecPhoto} onClick={() => setAvecPhoto(true)} disabled={!nbPhotos}>Avec photo · {nbPhotos}</button>
          </div>
          {dernier && <span>Dernière visite {depuis(dernier)}</span>}
        </>
      ) : null}
      pied={({ close }) => (
        <>
          {suivante ? (
            <button type="button" className="dg-btn dg-btn-texte" onClick={plus} disabled={chargeSuite}>
              {chargeSuite ? <><span className="dg-spin" aria-hidden="true" />Chargement…</> : 'Charger les plus anciens'}
            </button>
          ) : <span className="dg-pied-info">{rapports.length ? 'Tous les rapports sont affichés' : ''}</span>}
          <span className="dg-espace" />
          <button type="button" className="dg-btn dg-btn-g" onClick={close}>Fermer</button>
        </>
      )}
    >
      {isLoading ? (
        <div className="ar-fil" aria-busy="true">
          {[0, 1, 2].map((n) => (
            <div key={n} className="ar-item"><ShimmerThumbnail height={34} width={34} rounded /><div><ShimmerText line={3} gap={8} /></div></div>
          ))}
        </div>
      ) : error ? (
        <div className="dg-alerte dg-alerte-ko" role="alert">
          <Danger size={18} variant="Bold" color="currentColor" />
          <span>Les rapports n'ont pas pu être chargés. Vérifiez votre connexion puis rouvrez cette fenêtre.</span>
        </div>
      ) : rapports.length === 0 ? (
        <div className="ar-vide">
          <span className="ar-vide-ic"><DocumentText size={24} variant="Bold" color="currentColor" /></span>
          <b>Aucune visite pour l'instant</b>
          <p>Les rapports des agents apparaîtront ici dès leur premier passage sur place, avec leurs notes et leurs photos.</p>
        </div>
      ) : (
        <ol className="ar-fil">
          {affiches.map((r) => {
            const distance = Number(r.distance_meters);
            const surPlace = Number.isFinite(distance) && distance <= SEUIL_SUR_PLACE;
            const lat = r.location_lat ?? latitude;
            const lon = r.location_lon ?? longitude;
            return (
              <li key={r.id} className="ar-item">
                <span className="ar-av" style={{ backgroundColor: couleurAgent(r.agent_name) }} aria-hidden="true">{initiales(r.agent_name)}</span>
                <div className="ar-contenu">
                  <div className="ar-tete">
                    <b>{r.agent_name || 'Agent de terrain'}</b>
                    <time dateTime={r.visited_at || r.created_at}>{quand(r.visited_at || r.created_at)}</time>
                  </div>
                  {r.notes && <p className="ar-notes">{r.notes}</p>}
                  {r.photo && (
                    <button type="button" className="ar-photo" onClick={() => setImageAZoomer({ src: r.photo, alt: `Photo de ${r.agent_name || "l'agent"}` })} aria-label={`Agrandir la photo de ${r.agent_name || "l'agent"}`}>
                      <BlurryImage src={r.photo} alt="" />
                      <span><IcoAgrandir />Agrandir</span>
                    </button>
                  )}
                  <div className="ar-tags">
                    {Number.isFinite(distance) && (
                      <span className={`ar-tag ${surPlace ? 'is-ok' : 'is-loin'}`}>
                        <i aria-hidden="true" />{surPlace ? 'Sur place' : 'À distance'} · {Math.round(distance)} m
                      </span>
                    )}
                    {r.incident_zone && <span className="ar-tag">{r.incident_zone}</span>}
                    {lat && lon && (
                      <a className="ar-tag ar-lien" href={`https://www.google.com/maps?q=${lat},${lon}`} target="_blank" rel="noreferrer">Voir sur la carte</a>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {imageAZoomer && <ImageViewer src={imageAZoomer.src} alt={imageAZoomer.alt} onClose={() => setImageAZoomer(null)} />}
    </Dialogue>
  );
};

export default AgentReportsModal;
