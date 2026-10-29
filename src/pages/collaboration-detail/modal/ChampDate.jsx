import React from 'react';
import { dateLongue } from './dates';

/**
 * Champ date lisible : affiche « Jeu. 30 oct. » plutôt que « 30/10/2026 ».
 *
 * Le vrai <input type="date"> reste là, transparent par-dessus : il garde le
 * sélecteur natif (indispensable sur téléphone), la saisie clavier et
 * l'accessibilité ; seul l'affichage change.
 */
export const ChampDate = ({
  libelle,
  valeur,
  onChange,
  min,
  max,
  disabled,
  invalide = false,
  idErreur,
  avecAnnee = false,
  className = '',
  children,
}) => (
  <label className={`dg-champ ${className}`}>
    {libelle}
    <span className={`dg-date ${invalide ? 'is-ko' : ''}`}>
      <input
        type="date"
        value={valeur || ''}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* sélecteur indisponible : saisie clavier */ } }}
        aria-invalid={invalide || undefined}
        aria-describedby={idErreur}
      />
      <span className={`dg-date-texte ${valeur ? '' : 'is-vide'}`} aria-hidden="true">
        {valeur ? dateLongue(valeur, avecAnnee) : 'Choisir une date'}
      </span>
    </span>
    {children}
  </label>
);

export default ChampDate;
