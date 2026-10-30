import React, { useMemo, useState } from 'react';
import { ArrowRight2 } from 'iconsax-react';
import { ShimmerCircularImage, ShimmerText } from 'react-shimmer-effects';
import './activity-panel.css';
import { categorie, initiales, couleurPour, tempsRelatif, libelleJour } from './activite-utils';

const FILTRES = [
  { cle: 'all', libelle: 'Tout' },
  { cle: 'signalement', libelle: 'Signalements' },
  { cle: 'collaboration', libelle: 'Collaborations' },
];


export const ActivityPanel = ({ activities: propActivities, isLoading, nextUrl, onLoadMore, isLoadingMore, onCollapse, onSelect }) => {
  const [filtre, setFiltre] = useState('all');

  // Une ligne par événement, regroupée par jour. L'auteur devient un avatar
  // plutôt qu'un nom répété en gras devant chaque phrase.
  const groupes = useMemo(() => {
    const items = (propActivities || [])
      .map((act) => {
        const brut = act.created_at || act.timeStamp;
        const parsee = brut ? new Date(brut) : null;
        const date = parsee && !Number.isNaN(parsee.getTime()) ? parsee : null;
        const auteur = act.actor || act.user_name || act.organisation_name || '';
        return {
          id: act.id,
          incidentId: act.incident_id ?? act.incident?.id ?? (typeof act.incident === 'number' ? act.incident : null),
          auteur,
          action: act.action || '',
          date,
          categorie: categorie(act.action),
          couleur: couleurPour(act.organisation_id, auteur),
        };
      })
      .filter((a) => filtre === 'all' || a.categorie === filtre);

    const parJour = [];
    items.forEach((item) => {
      const jour = item.date ? libelleJour(item.date) : 'Date inconnue';
      const dernier = parJour[parJour.length - 1];
      if (dernier && dernier.jour === jour) dernier.items.push(item);
      else parJour.push({ jour, items: [item] });
    });
    return parJour;
  }, [propActivities, filtre]);

  const vide = groupes.length === 0;

  return (
    <div className="activity-panel">
      <div className="activity-header">
        <div className="activity-header-top">
          <h3 className="activity-title">
            Activité en temps réel
            <span className="live-indicator" aria-label="En direct">
              <span className="live-dot"></span>
            </span>
          </h3>
          {onCollapse && (
            <button
              type="button"
              className="activity-collapse-btn"
              onClick={onCollapse}
              aria-label="Réduire le panneau d'activité"
              title="Réduire (A)"
            >
              <ArrowRight2 size={16} color="currentColor" />
            </button>
          )}
        </div>
        <p className="activity-subtitle">Mises à jour de votre réseau</p>
        <div className="activity-filters" role="group" aria-label="Filtrer l'activité">
          {FILTRES.map((f) => (
            <button
              key={f.cle}
              type="button"
              className={`activity-filter ${filtre === f.cle ? 'is-active' : ''}`}
              aria-pressed={filtre === f.cle}
              onClick={() => setFiltre(f.cle)}
            >
              {f.libelle}
            </button>
          ))}
        </div>
      </div>

      <div className="activity-list">
        {isLoading ? (
          <div className="activity-chargement" aria-busy="true" aria-label="Chargement de l'activité">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <div key={n} className="activity-item">
                <ShimmerCircularImage size={30} />
                <div className="activity-content"><ShimmerText line={2} gap={6} /></div>
              </div>
            ))}
          </div>
        ) : vide ? (
          <div className="activity-state">
            {filtre === 'all' ? 'Aucune activité récente.' : 'Aucune activité de ce type pour le moment.'}
          </div>
        ) : (
          <>
            {groupes.map((groupe) => (
              <section key={groupe.jour} className="activity-day">
                <h4 className="activity-day-label">{groupe.jour}</h4>
                {groupe.items.map((item) => {
                  const cliquable = Boolean(onSelect && item.incidentId);
                  const Balise = cliquable ? 'button' : 'div';
                  return (
                  <Balise
                    key={item.id}
                    className={`activity-item ${cliquable ? 'is-clickable' : ''}`}
                    {...(cliquable ? { type: 'button', onClick: () => onSelect(item.incidentId) } : {})}
                  >
                    <span className="activity-avatar" style={{ backgroundColor: item.couleur }} aria-hidden="true">
                      {initiales(item.auteur)}
                    </span>
                    <div className="activity-content">
                      <p className="activity-text">
                        {item.auteur && <strong>{item.auteur}</strong>} {item.action}
                      </p>
                      <span className="activity-time">
                        <span className={`activity-tag activity-tag-${item.categorie}`} aria-hidden="true" />
                        {item.date ? tempsRelatif(item.date) : ''}
                      </span>
                    </div>
                  </Balise>
                  );
                })}
              </section>
            ))}

            {nextUrl && (
              <div className="activity-more">
                <button type="button" className="btn btn-link" onClick={onLoadMore} disabled={isLoadingMore}>
                  {isLoadingMore ? 'Chargement…' : 'Afficher plus'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ActivityPanel;
