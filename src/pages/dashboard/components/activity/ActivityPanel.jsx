import React, { useMemo, useState } from 'react';
import { ArrowRight2 } from 'iconsax-react';
import { ShimmerCircularImage, ShimmerText } from 'react-shimmer-effects';
import './activity-panel.css';

const FILTRES = [
  { cle: 'all', libelle: 'Tout' },
  { cle: 'signalement', libelle: 'Signalements' },
  { cle: 'collaboration', libelle: 'Collaborations' },
];

// Une prise en charge « en mode collaboratif » reste un événement de
// signalement : seules les demandes, invitations et adhésions relèvent des
// collaborations.
const categorie = (action = '') => {
  const act = action.toLowerCase();
  if (/demande de collaboration|invit|a rejoint|quitté la collaboration|nouvelle collaboration/.test(act)) {
    return 'collaboration';
  }
  return 'signalement';
};

const initiales = (nom = '') => {
  const mots = nom.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return '?';
  return (mots[0][0] + (mots[1]?.[0] ?? '')).toUpperCase();
};

// Avatars d'organisation : une teinte stable par nom, tirée d'une gamme
// sobre (bleus, ardoises, sarcelles). Le rouge, l'orange et le jaune restent
// réservés à la gravité, le vert au « résolu ».
const COULEURS_ORG = ['#1E78AC', '#0E7490', '#475569', '#0F766E', '#334155', '#2B8BC4'];

const couleurPour = (id, nom = '') => {
  const cle = String(id ?? '') + nom;
  let h = 0;
  for (const c of cle) h = (h * 31 + c.charCodeAt(0)) | 0;
  return COULEURS_ORG[Math.abs(h) % COULEURS_ORG.length];
};

const tempsRelatif = (date) => {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `Il y a ${heures} h`;
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const libelleJour = (date) => {
  const debut = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const ecart = Math.round((debut(new Date()) - debut(date)) / 86400000);
  if (ecart === 0) return "Aujourd'hui";
  if (ecart === 1) return 'Hier';
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
};

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
