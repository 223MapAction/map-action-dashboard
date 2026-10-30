import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { SearchNormal1, ArrowDown2, Location } from 'iconsax-react';
import { ShimmerThumbnail, ShimmerText } from 'react-shimmer-effects';
import { useSidebarState } from '../../hooks/useSidebarState';
import { useRechercheDebouncee } from '../../hooks/useRechercheDebouncee';
import { useReinitialisationSurChangement } from '../../hooks/useReinitialisationSurChangement';
import { Header, Sidebar } from '../../components/layout';
import { BlurryImage } from '../../components/atoms/BlurryImage';
import Pagination from '../../components/molecules/Pagination';
import { BandeauErreur } from '../../components/molecules/BandeauErreur';
import { authService } from '../auth/services/authService';
import { IS_MAPBOX } from '../../config/mapEngine';
import { OSM_STYLE } from '../../config/mapStyles';
import { getGlobalImpactService, getImpactIncidentsService } from './service/impact_service';
import { lireGlobal, lireSignalement } from './donnees';
import { zonesGeoJSON, emprise } from './carte';
import { CarteImpactMapLibre } from './CarteImpactMapLibre';
import { CarteImpactMapbox } from './CarteImpactMapbox';
import './impact-page.css';

const CarteImpact = IS_MAPBOX ? CarteImpactMapbox : CarteImpactMapLibre;
const VUE_PAR_DEFAUT = { longitude: -8, latitude: 12.6, zoom: 5 };
const TAILLE_PAGE = 10;

const STATUTS = [
  { valeur: 'all', libelle: 'Résolus et en action', court: 'Résolus et en action' },
  { valeur: 'resolved', libelle: 'Résolus', court: 'Résolus' },
  { valeur: 'taken_action', libelle: 'Pris en charge avec action', court: 'Avec action' },
];

const PERIODES = [
  { valeur: 'all', libelle: 'Toute la période', phrase: '' },
  { valeur: '30d', libelle: '30 jours', phrase: ' sur les 30 derniers jours' },
  { valeur: '90d', libelle: '90 jours', phrase: ' sur les 90 derniers jours' },
  { valeur: 'year', libelle: 'Cette année', phrase: ' cette année' },
];

const nombreFr = (n, decimales = 0) => (n ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: decimales, minimumFractionDigits: decimales });
const pluriel = (n, mot) => `${mot}${n > 1 ? 's' : ''}`;

const dateFr = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Liste « libellé : valeur » des petites cartes de détail. */
const Detail = ({ titre, lignes }) => (
  <div className="ip-detail">
    <b>{titre}</b>
    <dl>
      {lignes.map(([libelle, valeur]) => (
        <React.Fragment key={libelle}>
          <dt>{libelle}</dt>
          <dd>{valeur ?? '—'}</dd>
        </React.Fragment>
      ))}
    </dl>
  </div>
);

/** Un signalement retenu, replié ou déplié. */
const Signalement = ({ s, n, deplie, onBasculer, onVoir, refCarte }) => {
  const idCorps = `ip-sig-${s.id}`;
  return (
    <article ref={refCarte} className={`ip-sig ${deplie ? 'is-on' : ''}`}>
      <button type="button" className="ip-sig-tete" aria-expanded={deplie} aria-controls={idCorps} onClick={onBasculer}>
        <span className="ip-sig-photo">
          {s.photo ? <BlurryImage src={s.photo} alt="" /> : null}
          <span className={`ip-gravite is-${s.niveau}`}>{s.libelleNiveau}</span>
        </span>
        <span className="ip-sig-texte">
          <span className="ip-sig-lieu">
            <b className={`ip-num ${deplie ? 'is-on' : ''} ${s.lat === null ? 'is-sans' : ''}`} aria-hidden="true">{n}</b>
            {[s.zone || 'Zone non précisée', s.coordonnees || 'coordonnées non précisées'].join(' · ')}
          </span>
          <b className="ip-sig-titre">{s.titre}</b>
          {s.description && <span className="ip-sig-desc">{s.description}</span>}
          <span className="ip-pastilles">
            {s.analyse ? (
              <>
                {s.directs !== null && <span className="ip-pastille is-bleu">{nombreFr(s.directs)} directs</span>}
                {s.indirects !== null && <span className="ip-pastille">{nombreFr(s.indirects)} indirects</span>}
                {s.rayon > 0 && <span className="ip-pastille">rayon {nombreFr(s.rayon)} m</span>}
              </>
            ) : <span className="ip-pastille is-orange">Impact pas encore estimé</span>}
          </span>
          <span className="ip-sig-dates">
            {[
              s.signaleLe && `Signalé le ${dateFr(s.signaleLe)}`,
              s.resoluLe ? `Résolu le ${dateFr(s.resoluLe)}` : 'Pas encore résolu',
            ].filter(Boolean).join(' · ')}
          </span>
        </span>
        <ArrowDown2 size={18} color="currentColor" className="ip-chevron" aria-hidden="true" />
      </button>

      {deplie && (
        <div id={idCorps} className="ip-sig-corps">
          {s.analyse ? (
            <div className="ip-details">
              <Detail titre="Bénéficiaires directs" lignes={[
                ['Exposés', s.detailDirects.exposes !== null ? nombreFr(s.detailDirects.exposes) : null],
                ['Hommes', s.detailDirects.hommes !== null ? nombreFr(s.detailDirects.hommes) : null],
                ['Femmes', s.detailDirects.femmes !== null ? nombreFr(s.detailDirects.femmes) : null],
                ['Enfants', s.detailDirects.enfants !== null ? nombreFr(s.detailDirects.enfants) : null],
              ]} />
              <Detail titre="Zone à risque" lignes={[
                ['Population', s.zoneRisque.population !== null ? nombreFr(s.zoneRisque.population) : null],
                ['Rayon', s.rayon > 0 ? `${nombreFr(s.rayon)} m` : null],
                ['Propagation', s.zoneRisque.vecteurs],
                ['Bâtiments', s.zoneRisque.batiments !== null ? nombreFr(s.zoneRisque.batiments) : null],
              ]} />
              {s.structures.length > 0
                ? <Detail titre="Structures sensibles" lignes={s.structures.map((x) => [x.libelle, nombreFr(x.n)])} />
                : <div className="ip-detail"><b>Structures sensibles</b><span className="ip-muet">Aucune dans la zone.</span></div>}
            </div>
          ) : (
            <p className="ip-alerte-douce">L’impact de ce signalement n’a pas encore été estimé : bénéficiaires, zone à risque et structures apparaîtront une fois l’analyse faite.</p>
          )}

          <div className="ip-bloc">
            <h4>Qui est intervenu</h4>
            {s.organisations.length === 0 && s.agents.length === 0 ? (
              <span className="ip-muet">Aucune organisation ni agent pour l’instant.</span>
            ) : (
              <>
                {s.organisations.length > 0 && (
                  <div className="ip-puces">
                    {s.organisations.map((o) => <span key={o.nom} className="ip-puce"><b>{o.nom}</b> · {o.relation}</span>)}
                  </div>
                )}
                {s.agents.length > 0 && (
                  <div className="ip-puces">
                    {s.agents.map((a) => <span key={a.nom} className="ip-puce is-plein"><b>{a.nom}</b>{a.role ? ` · ${a.role}` : ''}</span>)}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="ip-bloc">
            <h4>Actions menées {s.taches.length > 0 && <span className="ip-compte">{s.taches.length}</span>}</h4>
            {s.taches.length === 0 ? (
              <span className="ip-muet">Aucune action enregistrée pour ce signalement.</span>
            ) : (
              <ul className="ip-taches">
                {s.taches.map((t) => (
                  <li key={t.id}>
                    <span className={`ip-etat ${t.etat.classe}`}>{t.etat.libelle}</span>
                    <span className="ip-tache-texte">
                      <b>{t.titre}</b>
                      {t.description && <span>{t.description}</span>}
                    </span>
                    {t.echeance && <span className="ip-tache-date">Échéance {dateFr(t.echeance)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button type="button" className="ip-lien" onClick={onVoir}>Voir le signalement</button>
        </div>
      )}
    </article>
  );
};

export const Impact = () => {
  const navigate = useNavigate();
  const {
    isOpen: sidebarOpen,
    setOpen: setSidebarOpen,
    isCollapsed: sidebarCollapsed,
    setCollapsed: setSidebarCollapsed,
  } = useSidebarState();

  const estSuperAdmin = authService.getCurrentUser()?.web_role === 'super_admin';

  const [statut, setStatut] = useState('all');
  const [periode, setPeriode] = useState('all');
  const { saisie, setSaisie, recherche, reinitialiser } = useRechercheDebouncee();
  const [page, setPage] = useState(1);
  const [deplie, setDeplie] = useState(null);
  const [vueMobile, setVueMobile] = useState('liste');

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767.98px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767.98px)');
    const maj = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);

  // L'en-tête de la page reste collé sous celui de l'application.
  const repereRef = useRef(null);
  const enteteRef = useRef(null);
  const [colle, setColle] = useState(false);
  // La carte se colle juste sous l'en-tête de la page, dont la hauteur varie
  // (filtres sur une ou deux lignes) : on la mesure au lieu de la deviner.
  const [hauteurEntete, setHauteurEntete] = useState(180);
  useEffect(() => {
    const el = enteteRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const obs = new ResizeObserver(([e]) => setHauteurEntete(Math.round(e.target.getBoundingClientRect().height)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const surDefilement = (e) => {
    const repere = repereRef.current;
    if (repere) setColle(e.currentTarget.scrollTop > repere.offsetTop - 60);
  };

  useReinitialisationSurChangement([recherche, statut, periode], () => { setPage(1); setDeplie(null); });

  // Les chiffres d'ensemble ne dépendent ni de la recherche ni de la page :
  // taper ou changer de page ne les fait plus repasser en chargement.
  const { data: G, error: erreurGlobal, isLoading: chargeGlobal, mutate: recGlobal } = useSWR(
    ['/MapApi/impact/', statut, periode],
    () => getGlobalImpactService(statut, periode),
    { revalidateOnFocus: false, keepPreviousData: true },
  );
  const { data: D, error: erreurListe, isLoading: chargeListe, mutate: recListe } = useSWR(
    ['/MapApi/impact/incidents/', statut, periode, recherche, page],
    () => getImpactIncidentsService(statut, periode, recherche, page, TAILLE_PAGE),
    { revalidateOnFocus: false, keepPreviousData: true },
  );

  const g = useMemo(() => (G ? lireGlobal(G, estSuperAdmin) : null), [G, estSuperAdmin]);
  const signalements = useMemo(() => {
    const brut = Array.isArray(D) ? D : (D?.results || []);
    return brut.map(lireSignalement);
  }, [D]);
  const total = Array.isArray(D) ? D.length : (D?.count ?? signalements.length);

  // Numérotation commune à la liste et à la carte.
  const numeros = useMemo(() => new Map(signalements.map((s, i) => [String(s.id), i + 1])), [signalements]);
  const localises = useMemo(
    () => signalements.filter((s) => s.lat !== null).map((s) => ({ ...s, n: numeros.get(String(s.id)) })),
    [signalements, numeros],
  );
  const nonLocalises = signalements.filter((s) => s.lat === null).map((s) => numeros.get(String(s.id)));
  const zones = useMemo(() => zonesGeoJSON(localises, deplie), [localises, deplie]);

  // La carte cadre les zones de la page, puis suit le signalement déplié.
  const carteRef = useRef(null);
  const cartesRef = useRef({});
  useEffect(() => {
    const carte = carteRef.current;
    const cadre = emprise(localises);
    if (!carte || !cadre) return;
    carte.fitBounds(cadre, { padding: 48, maxZoom: 15, duration: 600 });
  }, [localises]);
  useEffect(() => {
    const s = localises.find((x) => String(x.id) === String(deplie));
    if (s && carteRef.current) carteRef.current.easeTo({ center: [s.lng, s.lat], zoom: Math.max(carteRef.current.getZoom(), 14), duration: 500 });
  }, [deplie, localises]);

  const choisirSurCarte = (id) => {
    setDeplie(id);
    if (isMobile) setVueMobile('liste');
    requestAnimationFrame(() => cartesRef.current[String(id)]?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const phrasePeriode = PERIODES.find((p) => p.valeur === periode)?.phrase || '';
  const listeInitiale = chargeListe && !D;
  const voirCarte = !isMobile || vueMobile === 'carte';
  const voirListe = !isMobile || vueMobile === 'liste';

  const c = g?.directs.cohortes;
  const ci = g?.citoyens;
  const part = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);
  const repartition = g ? g.mobilisation.enCollaboration + g.mobilisation.seuls : 0;

  return (
    <div className="ip-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      <div className={`ip-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} sidebarCollapsed={sidebarCollapsed} />

        <main className="ip" onScroll={surDefilement} style={{ '--ip-entete': `${hauteurEntete}px` }}>
          <BandeauErreur
            erreur={erreurGlobal || erreurListe}
            onReessayer={() => { recGlobal(); recListe(); }}
            message="Impossible de charger les chiffres d’impact. Ceux affichés peuvent ne plus être à jour."
          />

          <div ref={repereRef} aria-hidden="true" className="ip-repere-colle" />
          <div ref={enteteRef} className={`ip-entete ${colle ? 'is-colle' : ''}`}>
            <div className="ip-tete">
              <h1>Impact</h1>
              <p>Ce que les interventions ont changé sur le terrain, et pour combien de personnes.</p>
            </div>
            <div className="ip-filtres">
              <div className={isMobile ? 'ip-statuts-pastilles' : 'ip-statuts'} role="tablist" aria-label="Signalements pris en compte">
                {STATUTS.map((s) => (
                  <button key={s.valeur} type="button" role="tab" aria-selected={statut === s.valeur} className={statut === s.valeur ? 'is-on' : ''} onClick={() => setStatut(s.valeur)}>
                    {isMobile ? s.court : s.libelle}
                  </button>
                ))}
              </div>
              {isMobile ? (
                <label className="ip-periode-liste">
                  <span aria-hidden="true">Période : {PERIODES.find((p) => p.valeur === periode)?.libelle.toLowerCase()}</span>
                  <ArrowDown2 size={14} color="currentColor" aria-hidden="true" />
                  <select value={periode} onChange={(e) => setPeriode(e.target.value)} aria-label="Période">
                    {PERIODES.map((p) => <option key={p.valeur} value={p.valeur}>{p.libelle}</option>)}
                  </select>
                </label>
              ) : (
                <div className="ip-segment" role="radiogroup" aria-label="Période">
                  {PERIODES.map((p) => (
                    <button key={p.valeur} type="button" role="radio" aria-checked={periode === p.valeur} onClick={() => setPeriode(p.valeur)}>{p.libelle}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Personnes et territoire */}
          <section className="ip-section" aria-labelledby="ip-h-pers">
            <h2 id="ip-h-pers">Personnes et territoire</h2>
            {!g ? (
              <div className="ip-grille4">{[0, 1, 2].map((n) => <div key={n} className={`ip-tuile ${n === 0 ? 'is-large' : ''}`}><ShimmerText line={4} gap={10} /></div>)}</div>
            ) : (
              <div className={`ip-grille4 ${chargeGlobal ? 'is-attente' : ''}`}>
                <article className="ip-tuile is-large ip-benef">
                  <div>
                    <span className="ip-libelle">Bénéficiaires directs</span>
                    <b className="ip-chiffre">{nombreFr(g.directs.total)}</b>
                    <span className="ip-aide">Personnes exposées dans les zones traitées</span>
                    {c ? (
                      <>
                        <span className="ip-barre-empilee" aria-hidden="true">
                          <span className="is-h" style={{ width: `${c.parts.hommes}%` }} />
                          <span className="is-f" style={{ width: `${c.parts.femmes}%` }} />
                          <span className="is-e" style={{ width: `${c.parts.enfants}%` }} />
                        </span>
                        <dl className="ip-legende">
                          <i className="is-h" aria-hidden="true" /><dt>Hommes</dt><dd><b>{nombreFr(c.hommes)}</b> · {c.parts.hommes} %</dd>
                          <i className="is-f" aria-hidden="true" /><dt>Femmes</dt><dd><b>{nombreFr(c.femmes)}</b> · {c.parts.femmes} %</dd>
                          <i className="is-e" aria-hidden="true" /><dt>Enfants</dt><dd><b>{nombreFr(c.enfants)}</b> · {c.parts.enfants} %</dd>
                        </dl>
                      </>
                    ) : <p className="ip-note">La répartition hommes, femmes et enfants n’est pas fournie.</p>}
                  </div>
                  <div className="ip-benef-indirect">
                    <span className="ip-libelle">Bénéficiaires indirects</span>
                    <b className="ip-chiffre">{nombreFr(g.indirects.total)}</b>
                    <span className="ip-aide">Population de la zone à risque autour</span>
                    {g.indirects.cohortes ? (
                      <dl className="ip-liste-chiffres">
                        <dt>Hommes</dt><dd>{nombreFr(g.indirects.cohortes.hommes)}</dd>
                        <dt>Femmes</dt><dd>{nombreFr(g.indirects.cohortes.femmes)}</dd>
                        <dt>Enfants</dt><dd>{nombreFr(g.indirects.cohortes.enfants)}</dd>
                      </dl>
                    ) : <p className="ip-note">La répartition hommes, femmes et enfants n’est pas fournie pour les bénéficiaires indirects.</p>}
                  </div>
                </article>
                <article className="ip-tuile">
                  <span className="ip-libelle">Superficie protégée</span>
                  <b className="ip-chiffre">{nombreFr(g.superficieHa, 1)} <span className="ip-unite">ha</span></b>
                  <span className="ip-aide">Total des zones d’impact des signalements retenus</span>
                </article>
                <article className="ip-tuile">
                  <span className="ip-libelle">Structures sensibles</span>
                  <b className="ip-chiffre">{nombreFr(g.structures.total)}</b>
                  {g.structures.parType.length > 0 ? (
                    <dl className="ip-liste-chiffres">
                      {g.structures.parType.map((s) => <React.Fragment key={s.cle}><dt>{s.libelle}</dt><dd>{nombreFr(s.n)}</dd></React.Fragment>)}
                    </dl>
                  ) : <span className="ip-aide">Aucune structure dans les zones d’impact</span>}
                </article>
              </div>
            )}
          </section>

          {/* Réservé au super-administrateur */}
          {g?.plateforme && (
            <section className="ip-section" aria-labelledby="ip-h-plat">
              <div className="ip-titre-ligne">
                <h2 id="ip-h-plat">Toute la plateforme</h2>
                <span>Visible par les super-administrateurs</span>
              </div>
              <div className={`ip-grille3 ${chargeGlobal ? 'is-attente' : ''}`}>
                <article className="ip-tuile">
                  <h3>Contribution citoyenne</h3>
                  <ol className="ip-entonnoir">
                    {[
                      ['Signalements reçus', ci.recus, null, ci.recus],
                      ['Vérifiés', ci.verifies, part(ci.verifies, ci.recus) !== null ? `${part(ci.verifies, ci.recus)} % des reçus` : null, ci.verifies],
                      ['Ayant conduit à une action', ci.actions, part(ci.actions, ci.verifies) !== null ? `${part(ci.actions, ci.verifies)} % des vérifiés` : null, ci.actions],
                    ].map(([libelle, n, phrase, valeur]) => (
                      <li key={libelle}>
                        <span className="ip-entonnoir-ligne"><span>{libelle}</span><span><b>{nombreFr(n)}</b>{phrase && <span className="ip-muet"> · {phrase}</span>}</span></span>
                        <span className="ip-jauge" aria-hidden="true"><span style={{ width: `${ci.recus > 0 ? Math.round((valeur / ci.recus) * 100) : 0}%` }} /></span>
                      </li>
                    ))}
                  </ol>
                  {ci.actifs !== null && <span className="ip-aide is-fonce"><b>{nombreFr(ci.actifs)}</b> {pluriel(ci.actifs, 'citoyen')} {ci.actifs > 1 ? 'ont' : 'a'} signalé au moins une fois</span>}
                </article>
                <article className="ip-tuile">
                  <h3>Performance des interventions</h3>
                  <div className="ip-duo">
                    <div><b>{g.resolution.joursMoyens ? `${nombreFr(Math.round(g.resolution.joursMoyens))} j` : '—'}</b><span>Temps moyen de résolution</span></div>
                    <div><b>{g.resolution.taux !== null ? `${nombreFr(g.resolution.taux, 1)} %` : '—'}</b><span>Taux de résolution</span></div>
                  </div>
                  {g.sansAnalyse > 0 && (
                    <p className="ip-alerte-douce"><b>{nombreFr(g.sansAnalyse)}</b> {pluriel(g.sansAnalyse, 'signalement')} {g.sansAnalyse > 1 ? 'attendent' : 'attend'} encore leur estimation d’impact : {g.sansAnalyse > 1 ? 'ils ne comptent' : 'il ne compte'} pas dans les chiffres ci-dessus.</p>
                  )}
                </article>
                <article className="ip-tuile">
                  <h3>Mobilisation des acteurs</h3>
                  <div className="ip-trio">
                    <div><b>{nombreFr(g.mobilisation.organisations)}</b><span>{pluriel(g.mobilisation.organisations, 'Organisation')}</span></div>
                    <div><b>{nombreFr(g.mobilisation.agents)}</b><span>Agents de terrain</span></div>
                    <div><b>{nombreFr(g.mobilisation.collaborations)}</b><span>{pluriel(g.mobilisation.collaborations, 'Collaboration')}</span></div>
                  </div>
                  {repartition > 0 && (
                    <div className="ip-repartition">
                      <span className="ip-barre-empilee" aria-hidden="true">
                        <span className="is-collab" style={{ width: `${(g.mobilisation.enCollaboration / repartition) * 100}%` }} />
                        <span className="is-seul" style={{ width: `${(g.mobilisation.seuls / repartition) * 100}%` }} />
                      </span>
                      <span className="ip-repartition-legende">
                        <span><b className="is-collab">{nombreFr(g.mobilisation.enCollaboration)}</b> en collaboration</span>
                        <span><b className="is-seul">{nombreFr(g.mobilisation.seuls)}</b> par une seule organisation</span>
                      </span>
                    </div>
                  )}
                </article>
              </div>
            </section>
          )}

          {/* Signalements retenus : liste et carte des zones d'impact */}
          <section className="ip-section" aria-labelledby="ip-h-sig">
            <div className="ip-titre-ligne is-outils">
              <h2 id="ip-h-sig">Signalements retenus {!listeInitiale && <span className="ip-compte">{nombreFr(total)}</span>}</h2>
              {isMobile && (
                <div className="ip-segment" role="radiogroup" aria-label="Affichage">
                  <button type="button" role="radio" aria-checked={vueMobile === 'liste'} onClick={() => setVueMobile('liste')}>Liste</button>
                  <button type="button" role="radio" aria-checked={vueMobile === 'carte'} onClick={() => setVueMobile('carte')}>Carte</button>
                </div>
              )}
              <label className="ip-recherche">
                <SearchNormal1 size={16} color="currentColor" aria-hidden="true" />
                <input type="search" value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="Titre, description ou zone" aria-label="Rechercher un signalement" />
              </label>
            </div>

            <div className="ip-liste-carte">
              {voirListe && (
                <div className="ip-liste" aria-busy={chargeListe || undefined}>
                  {listeInitiale ? [0, 1, 2].map((k) => (
                    <div key={k} className="ip-sig ip-squelette"><ShimmerThumbnail height={80} width={104} rounded className="m-0" /><div style={{ flex: 1 }}><ShimmerText line={4} gap={8} /></div></div>
                  )) : signalements.length === 0 ? (
                    <div className="ip-vide">
                      <span className="ip-vide-ic"><SearchNormal1 size={22} color="currentColor" /></span>
                      <b>Aucun signalement retenu</b>
                      <p>{recherche
                        ? `Rien ne correspond à « ${recherche} »${phrasePeriode}. Élargissez la période ou effacez la recherche.`
                        : `Aucun signalement ne correspond à ces filtres${phrasePeriode}.`}</p>
                      {recherche && <button type="button" className="ip-btn-g" onClick={reinitialiser}>Effacer la recherche</button>}
                    </div>
                  ) : (
                    <div className={`ip-liste-items ${chargeListe ? 'is-attente' : ''}`}>
                      {signalements.map((s) => (
                        <Signalement
                          key={s.id}
                          s={s}
                          n={numeros.get(String(s.id))}
                          deplie={String(deplie) === String(s.id)}
                          onBasculer={() => setDeplie((d) => (String(d) === String(s.id) ? null : s.id))}
                          onVoir={() => navigate(`/signalements/${s.id}`, { state: { from: '/impact' } })}
                          refCarte={(el) => { cartesRef.current[String(s.id)] = el; }}
                        />
                      ))}
                    </div>
                  )}

                  {total > TAILLE_PAGE && (
                    <div className="ip-pied">
                      <span>{`${(page - 1) * TAILLE_PAGE + 1}–${Math.min(page * TAILLE_PAGE, total)} sur ${nombreFr(total)}`}</span>
                      <Pagination page={page} pageSize={TAILLE_PAGE} count={total} onChange={(p) => { setPage(p); setDeplie(null); }} />
                    </div>
                  )}
                </div>
              )}

              {voirCarte && (
                <aside className="ip-carte" aria-label="Carte des zones d’impact">
                  <div className="ip-carte-cadre">
                    <CarteImpact
                      carteRef={carteRef}
                      mapStyle={OSM_STYLE}
                      initialViewState={VUE_PAR_DEFAUT}
                      zones={zones}
                      points={localises}
                      actif={deplie}
                      onSelect={choisirSurCarte}
                    />
                    <div className="ip-carte-legende">
                      <span><i aria-hidden="true" />Zone d’impact (rayon estimé)</span>
                      {nonLocalises.length > 0 && (
                        <span>
                          {nonLocalises.length > 1
                            ? `Les n° ${nonLocalises.join(', ')} n’ont pas de coordonnées.`
                            : `Le n° ${nonLocalises[0]} n’a pas de coordonnées.`}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="ip-aide">Les signalements de cette page. Cliquez une zone pour déplier le signalement.</span>
                </aside>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default Impact;
