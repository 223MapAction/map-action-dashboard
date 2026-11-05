import React, { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { SearchNormal1, ArrowDown2, Location, RotateLeft, Trash } from 'iconsax-react';
import { ShimmerThumbnail, ShimmerText } from 'react-shimmer-effects';
import { useSidebarState } from '../../hooks/useSidebarState';
import { useRechercheDebouncee } from '../../hooks/useRechercheDebouncee';
import { Header, Sidebar } from '../../components/layout';
import { BlurryImage } from '../../components/atoms/BlurryImage';
import { BandeauErreur } from '../../components/molecules/BandeauErreur';
import { Dialogue } from '../../components/molecules/Dialogue';
import { restoreIncidentService, deleteIncidentService } from '../incident/service/incident_service';
import { getToutLaCorbeille, lireSignalementSupprime } from './corbeille';
import { logger } from '../../utils/logger';
import './corbeille-liste.css';

const EMPTY_ARRAY = [];
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

const IcoCorbeille = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7V4h6v3" />
  </svg>
);

/** Case « Tout » : cochée, vide, ou à moitié quand une partie est choisie. */
const CaseTout = ({ etat, onChange, children }) => {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = etat === 'partiel'; }, [etat]);
  return (
    <label className="cb-tout">
      <input ref={ref} type="checkbox" checked={etat === 'tout'} onChange={onChange} aria-label="Tout sélectionner" />
      {children}
    </label>
  );
};

/** Confirmation de suppression définitive, pour un ou plusieurs signalements. */
const FenetreSuppression = ({ signalements, onFermer, onConfirmer }) => {
  const [envoi, setEnvoi] = useState(false);
  const un = signalements.length === 1;

  const confirmer = async (close) => {
    setEnvoi(true);
    await onConfirmer();
    setEnvoi(false);
    close();
  };

  return (
    <Dialogue
      onClose={onFermer}
      role="alertdialog"
      taille="sm"
      ton="danger"
      pile
      verrouille={envoi}
      titre={un ? `Supprimer définitivement « ${signalements[0].titre} » ?` : `Supprimer définitivement ${pluriel(signalements.length, 'signalement')} ?`}
      icone={<IcoCorbeille />}
      pied={({ close }) => (
        <>
          <span className="dg-espace" />
          <button type="button" className="dg-btn dg-btn-g" onClick={close} disabled={envoi}>Garder dans la corbeille</button>
          <button type="button" className="dg-btn dg-btn-ko" onClick={() => confirmer(close)} disabled={envoi}>
            {envoi ? <><span className="dg-spin" aria-hidden="true" />Suppression…</> : 'Supprimer définitivement'}
          </button>
        </>
      )}
    >
      <p className="cb-texte">
        {un ? 'Il disparaîtra' : 'Ils disparaîtront'} définitivement de Map Action. Cette action ne peut pas être annulée.
      </p>
      {!un && (
        <ul className="cb-a-supprimer">
          {signalements.map((s) => <li key={s.id}>{s.titre}</li>)}
        </ul>
      )}
    </Dialogue>
  );
};

export const TrashPage = () => {
  const {
    isOpen: sidebarOpen,
    setOpen: setSidebarOpen,
    isCollapsed: sidebarCollapsed,
    setCollapsed: setSidebarCollapsed,
  } = useSidebarState();

  const { data, error, isLoading, mutate } = useSWR('trash-incidents', getToutLaCorbeille, { revalidateOnFocus: false, keepPreviousData: true });
  const signalements = useMemo(() => (data ? data.map(lireSignalementSupprime) : EMPTY_ARRAY), [data]);

  const { saisie, setSaisie, recherche, reinitialiser } = useRechercheDebouncee();
  const [zone, setZone] = useState('');
  const [choisis, setChoisis] = useState(() => new Set());
  const [aSupprimer, setASupprimer] = useState(null);
  const [toast, setToast] = useState(null);
  const afficherToast = (texte) => setToast({ texte, n: Date.now() });

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767.98px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767.98px)');
    const maj = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);

  // L'en-tête de la page reste collé sous celui de l'application.
  const repereRef = useRef(null);
  const [colle, setColle] = useState(false);
  const surDefilement = (e) => {
    const repere = repereRef.current;
    if (repere) setColle(e.currentTarget.scrollTop > repere.offsetTop - 60);
  };

  const zones = useMemo(() => [...new Set(signalements.map((s) => s.zone).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')), [signalements]);

  const affiches = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return signalements.filter((s) => (!zone || s.zone === zone)
      && (!q || s.titre.toLowerCase().includes(q) || s.lieu.toLowerCase().includes(q)));
  }, [signalements, recherche, zone]);

  // Une sélection ne garde que des signalements encore dans la corbeille.
  const selection = signalements.filter((s) => choisis.has(s.id));
  const nbChoisis = selection.length;
  const toutAffiche = affiches.length > 0 && affiches.every((s) => choisis.has(s.id));
  const etatTout = toutAffiche ? 'tout' : (nbChoisis > 0 ? 'partiel' : 'rien');

  const basculer = (id) => setChoisis((prev) => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });
  const basculerTout = () => setChoisis(toutAffiche ? new Set() : new Set(affiches.map((s) => s.id)));
  const toutDeselectionner = () => setChoisis(new Set());

  /**
   * Applique une action à plusieurs signalements. Les échecs ne sont pas
   * masqués : ils restent sélectionnés et la confirmation les compte.
   */
  const appliquer = async (liste, action, verbe) => {
    const resultats = await Promise.allSettled(liste.map((s) => action(s.id)));
    const echecs = liste.filter((_, i) => resultats[i].status === 'rejected');
    resultats.forEach((r) => { if (r.status === 'rejected') logger.error(`[Corbeille] ${verbe} impossible :`, r.reason); });
    const reussis = liste.length - echecs.length;
    setChoisis(new Set(echecs.map((s) => s.id)));
    await mutate();
    return { reussis, echecs };
  };

  const restaurer = async (liste) => {
    const { reussis, echecs } = await appliquer(liste, restoreIncidentService, 'Restauration');
    if (echecs.length === 0) {
      afficherToast(liste.length === 1 ? `« ${liste[0].titre} » est restauré` : `${pluriel(reussis, 'signalement')} ${reussis > 1 ? 'restaurés' : 'restauré'}`);
    } else if (reussis === 0) {
      afficherToast(liste.length === 1 ? `« ${liste[0].titre} » n’a pas pu être restauré` : 'Aucun signalement n’a pu être restauré');
    } else {
      afficherToast(`${pluriel(reussis, 'signalement')} ${reussis > 1 ? 'restaurés' : 'restauré'}, ${echecs.length} n’${echecs.length > 1 ? 'ont' : 'a'} pas pu l’être`);
    }
  };

  const supprimer = async (liste) => {
    const { reussis, echecs } = await appliquer(liste, deleteIncidentService, 'Suppression');
    if (echecs.length === 0) {
      afficherToast(`${pluriel(reussis, 'signalement')} ${reussis > 1 ? 'supprimés' : 'supprimé'} définitivement`);
    } else if (reussis === 0) {
      afficherToast(liste.length === 1 ? 'Le signalement n’a pas pu être supprimé' : 'Aucun signalement n’a pu être supprimé');
    } else {
      afficherToast(`${pluriel(reussis, 'signalement')} ${reussis > 1 ? 'supprimés' : 'supprimé'}, ${echecs.length} n’${echecs.length > 1 ? 'ont' : 'a'} pas pu l’être`);
    }
  };

  const chargementInitial = isLoading && !data;
  const filtreActif = Boolean(recherche || zone);

  const barreSelection = (
    <div className="cb-selection" role="region" aria-label="Actions sur la sélection">
      <div className="cb-selection-compte">
        {isMobile
          ? <b>{nbChoisis} {nbChoisis > 1 ? 'sélectionnés' : 'sélectionné'} sur {signalements.length}</b>
          : <CaseTout etat={etatTout} onChange={basculerTout}>{nbChoisis} {nbChoisis > 1 ? 'sélectionnés' : 'sélectionné'} sur {signalements.length}</CaseTout>}
        <button type="button" className="dg-btn dg-btn-texte dg-btn-s" onClick={toutDeselectionner}>Tout désélectionner</button>
      </div>
      <div className="cb-selection-actions">
        <button type="button" className="dg-btn dg-btn-p" onClick={() => restaurer(selection)}>
          <RotateLeft size={16} color="currentColor" aria-hidden="true" />Restaurer
        </button>
        <button type="button" className="dg-btn dg-btn-ko" onClick={() => setASupprimer(selection)}>
          <Trash size={16} color="currentColor" aria-hidden="true" />{isMobile ? 'Supprimer' : 'Supprimer définitivement'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="cb-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      <div className={`cb-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} sidebarCollapsed={sidebarCollapsed} />

        <main className={`cb ${isMobile && nbChoisis > 0 ? 'avec-barre' : ''}`} onScroll={surDefilement}>
          <BandeauErreur erreur={error} onReessayer={mutate} message="Impossible de charger la corbeille. La liste affichée peut ne plus être à jour." />

          <div ref={repereRef} aria-hidden="true" className="cb-repere" />
          <div className={`cb-entete ${colle ? 'is-colle' : ''}`}>
            <div className="cb-tete">
              <h1>Corbeille</h1>
              <p>Les signalements supprimés. Restaurez-les ou supprimez-les définitivement.</p>
            </div>

            {/* Sur ordinateur, une sélection transforme la ligne d'outils en
                barre d'actions ; sur téléphone, cette barre se pose en bas. */}
            {!isMobile && nbChoisis > 0 ? barreSelection : (
              <div className="cb-outils">
                <CaseTout etat={etatTout} onChange={basculerTout}>{!isMobile && 'Tout'}</CaseTout>
                <label className="cb-recherche">
                  <SearchNormal1 size={16} color="currentColor" aria-hidden="true" />
                  <input type="search" value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="Titre ou lieu" aria-label="Rechercher dans la corbeille" />
                </label>
                {!isMobile && zones.length > 0 && (
                  <label className={`cb-filtre ${zone ? 'is-on' : ''}`}>
                    <span aria-hidden="true">Zone : {zone || 'toutes'}</span>
                    <ArrowDown2 size={14} color="currentColor" aria-hidden="true" />
                    <select value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Filtrer par zone">
                      <option value="">Zone : toutes</option>
                      {zones.map((z) => <option key={z} value={z}>{z}</option>)}
                    </select>
                  </label>
                )}
                {!isMobile && !chargementInitial && (
                  <span className="cb-annonce" role="status">
                    {filtreActif ? `${pluriel(affiches.length, 'résultat')} sur ${signalements.length}` : `${pluriel(signalements.length, 'signalement')} dans la corbeille`}
                  </span>
                )}
              </div>
            )}
          </div>

          {chargementInitial ? (
            <ul className="cb-liste" aria-busy="true">
              {[0, 1, 2, 3].map((n) => <li key={n} className="cb-ligne"><ShimmerThumbnail height={66} width={88} rounded className="m-0" /><div style={{ flex: 1 }}><ShimmerText line={3} gap={8} /></div></li>)}
            </ul>
          ) : signalements.length === 0 && !error ? (
            <div className="cb-vide">
              <span className="cb-vide-ic"><Trash size={22} color="currentColor" /></span>
              <b>La corbeille est vide</b>
            </div>
          ) : affiches.length === 0 && filtreActif ? (
            <div className="cb-vide">
              <b>Aucun signalement ne correspond</b>
              {recherche && <p>Rien ne correspond à « {recherche} ».</p>}
              <button type="button" className="dg-btn dg-btn-g" onClick={() => { reinitialiser(); setZone(''); }}>
                {recherche ? 'Effacer la recherche' : 'Afficher toutes les zones'}
              </button>
            </div>
          ) : (
            <ul className="cb-liste">
              {affiches.map((s) => {
                const coche = choisis.has(s.id);
                return (
                  <li key={s.id} className={`cb-ligne ${coche ? 'is-on' : ''}`}>
                    <input type="checkbox" className="cb-case" checked={coche} onChange={() => basculer(s.id)} aria-label={`Sélectionner « ${s.titre} »`} />
                    {!isMobile && <span className="cb-photo">{s.photo ? <BlurryImage src={s.photo} alt="" /> : null}</span>}
                    <div className="cb-texte-ligne">
                      <div className="cb-meta">
                        {s.etat && <span className={`cb-etat ${s.etat.classe}`}><i aria-hidden="true" />{s.etat.libelle}</span>}
                        <span className="cb-lieu"><Location size={12} color="currentColor" aria-hidden="true" />{s.lieu}</span>
                        {s.signaleLe && <span className="cb-date">· Signalé le {s.signaleLe}</span>}
                      </div>
                      <b className="cb-titre">{s.titre}</b>
                      {s.description && <span className="cb-desc">{s.description}</span>}
                    </div>
                    <div className="cb-actions">
                      <button type="button" className="cb-restaurer" onClick={() => restaurer([s])}>
                        <RotateLeft size={15} color="currentColor" aria-hidden="true" />Restaurer
                      </button>
                      <button type="button" className="cb-supprimer" onClick={() => setASupprimer([s])} aria-label={`Supprimer définitivement « ${s.titre} »`}>
                        <Trash size={16} color="currentColor" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {isMobile && nbChoisis > 0 && <div className="cb-selection-bas">{barreSelection}</div>}
        </main>
      </div>

      {aSupprimer && (
        <FenetreSuppression
          signalements={aSupprimer}
          onFermer={() => setASupprimer(null)}
          onConfirmer={() => supprimer(aSupprimer)}
        />
      )}
      {toast && <div key={toast.n} className="cb-toast" role="status">{toast.texte}</div>}
    </div>
  );
};

export default TrashPage;
