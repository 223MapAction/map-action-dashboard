import { useRef } from 'react';
import { couleurGravite } from '../../../utils/gravite';
import { titreIncident } from '../../../utils/titreIncident';
import { useStatsWidgets, tempsRelatif } from '../components/widgets/useStatsWidgets';

const pourcentage = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);
const nombre = (n) => n.toLocaleString('fr-FR');

/**
 * Écran 9 : statistiques, panneau tiré par-dessus la carte. Chaque action
 * pilote la carte, donc referme le panneau pour la montrer.
 */
export const StatistiquesMobile = ({ stats, statut, zoneActive, graviteActive, onStatut, onZone, onGravite, onIncident, onFermer }) => {
  const { locationStats, graviteParZone, nonResolus, aTraiter, aAfficher, severityData, totalGravite, sommePourcent } = useStatsWidgets(stats);
  const debutGeste = useRef(null);

  const total = stats?.total_alerts ?? 0;
  const resolus = stats?.resolved_incidents ?? 0;
  const pris = stats?.active_responses ?? 0;
  const enAttente = Math.max(total - resolus - pris, 0);

  const indicateurs = [
    { id: null, libelle: 'Total', valeur: total, note: `${nombre(enAttente)} en attente`, classe: 'dm-note-attente' },
    { id: 'taken', libelle: 'Pris en compte', valeur: pris, note: `${pourcentage(pris, total)} %`, classe: 'dm-note-prise' },
    { id: 'resolved', libelle: 'Résolus', valeur: resolus, note: `${pourcentage(resolus, total)} %`, classe: 'dm-note-resolu' },
  ];

  let cumul = 0;
  const anneau = severityData
    .map((s) => {
      const debut = cumul;
      cumul += (s.percentage / sommePourcent) * 100;
      return `${s.color} ${debut}% ${cumul}%`;
    })
    .join(', ');

  return (
    <section className="dm-stats" aria-label="Vue d'ensemble">
      <button
        type="button"
        className="dm-stats-poignee"
        aria-label="Réduire le panneau"
        onClick={onFermer}
        onTouchStart={(e) => { debutGeste.current = e.touches[0].clientY; }}
        onTouchEnd={(e) => {
          if (debutGeste.current !== null && e.changedTouches[0].clientY - debutGeste.current > 40) onFermer();
          debutGeste.current = null;
        }}
      >
        <span className="dm-poignee" />
      </button>

      <div className="dm-stats-corps">
        <div className="dm-stats-titre">
          <h1>Statistiques</h1>
          <button type="button" className="dm-lien" onClick={onFermer}>Voir la carte</button>
        </div>

        <div className="dm-indicateurs">
          {indicateurs.map((m) => (
            <button
              key={m.libelle}
              type="button"
              className={statut === m.id ? 'is-actif' : ''}
              aria-pressed={statut === m.id}
              onClick={() => onStatut(m.id)}
            >
              <span>{m.libelle}</span>
              <b>{stats ? nombre(m.valeur) : '–'}</b>
              {stats && <span className={m.classe}>{m.note}</span>}
            </button>
          ))}
        </div>

        <section className="dm-stats-section" aria-labelledby="dm-prio">
          <div className="dm-stats-entete">
            <h2 id="dm-prio">À traiter en priorité</h2>
            {nonResolus && <span>{nombre(aTraiter.length)} en attente</span>}
          </div>
          {nonResolus && aTraiter.length === 0 ? (
            <p className="dm-vide">Rien à traiter.</p>
          ) : (
            <ul className="dm-liste">
              {aAfficher.slice(0, 2).map((incident) => {
                const photo = incident.thumbnail || incident.photo;
                return (
                  <li key={incident.id}>
                    <button type="button" className="dm-prio" onClick={() => onIncident(incident.id)}>
                      <span className="dm-prio-photo" style={photo ? { backgroundImage: `url(${photo})` } : undefined}>
                        <i style={{ backgroundColor: couleurGravite(incident._gravite) }} />
                      </span>
                      <span className="dm-prio-texte">
                        <b>{titreIncident(incident)}</b>
                        <span>{[incident.zone, tempsRelatif(incident.created_at)].filter(Boolean).join(' · ')}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="dm-stats-section" aria-labelledby="dm-loc">
          <div className="dm-stats-entete">
            <h2 id="dm-loc">Par localité</h2>
            <span>Toucher pour zoomer</span>
          </div>
          {stats && locationStats.length === 0 ? (
            <p className="dm-vide">Aucune donnée pour ce périmètre.</p>
          ) : (
            <ul className="dm-liste">
              {locationStats.map((zone) => {
                const c = graviteParZone?.[zone.name];
                const somme = c ? c.high + c.medium + c.low : 0;
                return (
                  <li key={zone.name}>
                    <button
                      type="button"
                      className={`dm-zone ${zoneActive === zone.name ? 'is-actif' : ''}`}
                      aria-pressed={zoneActive === zone.name}
                      disabled={zone.name === 'Zone inconnue'}
                      onClick={() => onZone(zoneActive === zone.name ? null : zone.name)}
                    >
                      <span className="dm-zone-ligne"><b>{zone.name}</b><span>{nombre(zone.count)}</span></span>
                      <span className="dm-zone-barre" aria-hidden="true">
                        {somme > 0 && ['high', 'medium', 'low'].map((cle) => (
                          <span key={cle} style={{ width: `${(c[cle] / somme) * 100}%`, backgroundColor: couleurGravite(cle) }} />
                        ))}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="dm-stats-section" aria-labelledby="dm-grav">
          <h2 id="dm-grav">Gravité</h2>
          <div className="dm-gravite">
            <span
              className="dm-anneau"
              role="img"
              aria-label={`${nombre(totalGravite)} signalements actifs : ${severityData.map((s) => `${s.percentage} % ${s.label.toLowerCase()}`).join(', ')}`}
              style={{ background: totalGravite > 0 ? `conic-gradient(${anneau})` : 'var(--color-border)' }}
            >
              <span><b>{nombre(totalGravite)}</b><small>actifs</small></span>
            </span>
            <div className="dm-gravite-liste">
              {severityData.map((s) => (
                <button
                  key={s.cle}
                  type="button"
                  aria-pressed={graviteActive === s.cle}
                  style={graviteActive === s.cle ? { backgroundColor: `var(--color-severity-${s.cle}-surface)` } : undefined}
                  onClick={() => onGravite(graviteActive === s.cle ? null : s.cle)}
                >
                  <i style={{ backgroundColor: s.color }} />
                  <span>{s.label}</span>
                  {s.percentage} %
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
};

export default StatistiquesMobile;
