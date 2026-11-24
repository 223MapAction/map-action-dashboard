import React from 'react';
import { gravite, libelleGravite } from '../../utils/gravite';
import './badge-gravite.css';

/**
 * Pastille « Gravité … » d'un incident.
 *
 * Ce badge existait en double, écrit deux fois en styles en ligne — dans la
 * liste des signalements et dans le détail — avec à chaque fois la même
 * cascade de trois `if` sur `severity`. Les deux copies peignaient « faible »
 * en VERT, la couleur que la carte réserve aux incidents résolus : lu sur une
 * carte de signalement, un badge vert se comprend comme « c'est réglé », pas
 * comme « peu grave ».
 *
 * Les couleurs viennent maintenant des jetons de l'échelle, donc des mêmes
 * teintes que les marqueurs.
 *
 * @param {Object} incident
 * @param {string} [variante] 'discret' (fond pâle, défaut) | 'plein'
 */
export const BadgeGravite = ({ incident, prediction = null, pred = null, variante = 'discret', className = '' }) => {
  if (!incident) return null;

  const niveau = gravite(incident, prediction || pred);

  return (
    <span className={`badge-gravite badge-gravite--${niveau} badge-gravite--${variante} ${className}`.trim()}>
      Gravité {libelleGravite(niveau).toLowerCase()}
    </span>
  );
};

export default BadgeGravite;
