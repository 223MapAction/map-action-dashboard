import React, { useRef, useState } from 'react';
import { TickCircle, CloseCircle } from 'iconsax-react';
import { Dialogue } from '../../../components/molecules/Dialogue';
import { aujourdhui } from './dates';
import { ChampDate } from './ChampDate';
import { IcoBouclier, IcoCoche, IcoCroix, IcoAlerte, IcoDepot } from './icones';

// Le type du fichier se lit à sa couleur, comme dans un explorateur.
const TEINTES = {
  PDF: ['var(--color-danger-surface)', '#B91C1C'],
  DOC: ['var(--color-primary-surface)', 'var(--color-primary-text)'],
  DOCX: ['var(--color-primary-surface)', 'var(--color-primary-text)'],
  XLS: ['var(--color-success-surface)', 'var(--color-success-text)'],
  XLSX: ['var(--color-success-surface)', 'var(--color-success-text)'],
};
const teinte = (ext) => TEINTES[ext] || ['var(--color-accent-surface)', 'var(--color-accent-text)'];

const TYPES = 'image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const extension = (nom = '') => (nom.split('.').pop() || 'Fichier').slice(0, 4).toUpperCase();
const taille = (o) => (o >= 1048576 ? `${(o / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`);

/**
 * Résoudre le signalement depuis sa collaboration.
 *
 * Le bouton qui l'ouvre n'est actif que lorsque toutes les tâches sont faites :
 * la liste du haut le rappelle, au lieu de laisser croire qu'on contourne une
 * règle. La période est préremplie depuis les tâches.
 */
export const ResolveModal = ({
  titre,
  conditions,
  nbOrganisations,
  onClose,
  onResoudre,
  enCours,
  alerte,
  debut, setDebut,
  fin, setFin,
  fichier, setFichier,
}) => {
  const inputRef = useRef(null);
  const [survol, setSurvol] = useState(false);
  const today = aujourdhui();

  const deposer = (e) => {
    e.preventDefault();
    setSurvol(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFichier(f);
  };

  return (
    <Dialogue
      onClose={onClose}
      verrouille={enCours}
      ton="success"
      titre="Résoudre le signalement"
      sousTitre={titre}
      icone={<IcoBouclier />}
      pied={({ close }) => (
        <>
          <span className="dg-espace" />
          <button type="button" className="dg-btn dg-btn-g" onClick={close} disabled={enCours}>Pas maintenant</button>
          <button type="button" className="dg-btn dg-btn-ok" onClick={onResoudre} disabled={enCours || !debut || !fin}>
            {enCours
              ? <><span className="dg-spin" aria-hidden="true" />Résolution…</>
              : <><IcoCoche />Résoudre le signalement</>}
          </button>
        </>
      )}
    >
      {alerte && (
        <div className={`dg-alerte ${alerte.type === 'success' ? 'dg-alerte-ok' : 'dg-alerte-ko'}`} role={alerte.type === 'success' ? 'status' : 'alert'}>
          {alerte.type === 'success' ? <TickCircle size={18} variant="Bold" color="currentColor" /> : <CloseCircle size={18} variant="Bold" color="currentColor" />}
          <span>{alerte.message}</span>
        </div>
      )}

      <ul className="rs-conditions" aria-label="Bilan de l'intervention">
        {conditions.map((c) => (
          <li key={c.texte}>
            <span className="rs-coche" aria-hidden="true"><IcoCoche taille={12} epaisseur={3} /></span>
            <span>{c.texte}</span>
            <b>{c.valeur}</b>
          </li>
        ))}
      </ul>

      <fieldset className="dg-fieldset">
        <legend>Période d'intervention</legend>
        <div className="dg-grille2">
          <ChampDate className="rs-date" libelle="Du" valeur={debut} max={fin || today} onChange={setDebut} disabled={enCours} avecAnnee />
          <ChampDate className="rs-date" libelle="Au" valeur={fin} min={debut || undefined} max={today} onChange={setFin} disabled={enCours} avecAnnee />
        </div>
        <small className="rs-aide">Reprise de la première et de la dernière tâche. Modifiables.</small>
      </fieldset>

      <div className="dg-champ">
        <span>Justificatif <span className="dg-opt">facultatif · PV, photo de fin, rapport</span></span>
        {fichier ? (
          <div className="dg-fichier">
            <span className="dg-fichier-type" aria-hidden="true" style={{ background: teinte(extension(fichier.name))[0], color: teinte(extension(fichier.name))[1] }}>{extension(fichier.name)}</span>
            <span><b>{fichier.name}</b><small>{taille(fichier.size)}</small></span>
            <button type="button" className="dg-btn dg-btn-g dg-btn-s" onClick={() => inputRef.current?.click()} disabled={enCours}>Remplacer</button>
            <button type="button" className="dg-ico" onClick={() => setFichier(null)} disabled={enCours} aria-label="Retirer le fichier">
              <IcoCroix taille={15} />
            </button>
          </div>
        ) : (
          <label
            htmlFor="rs-fichier"
            className={`dg-depot ${survol ? 'is-survol' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setSurvol(true); }}
            onDragLeave={() => setSurvol(false)}
            onDrop={deposer}
          >
            <IcoDepot />
            <b>Glissez un fichier ou parcourez</b>
            <small>Image, vidéo, PDF, Word ou Excel</small>
          </label>
        )}
        <input
          ref={inputRef}
          id="rs-fichier"
          type="file"
          className="dg-masque"
          accept={TYPES}
          aria-label="Choisir un justificatif"
          onChange={(e) => setFichier(e.target.files[0] || null)}
          disabled={enCours}
        />
      </div>

      <p className="dg-alerte dg-alerte-warn">
        <IcoAlerte />
        <span>
          Une fois résolu, le signalement est archivé : tâches et discussion passent en lecture seule
          {nbOrganisations > 1 ? ` pour les ${nbOrganisations} organisations.` : ' pour toutes les organisations.'}
        </span>
      </p>
    </Dialogue>
  );
};

export default ResolveModal;
