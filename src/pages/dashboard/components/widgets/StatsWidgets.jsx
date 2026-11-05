import React from 'react';
import { ShimmerThumbnail, ShimmerText } from 'react-shimmer-effects';
import './stats-widgets.css';
import { couleurGravite, libelleGravite } from '../../../../utils/gravite';
import { useStatsWidgets, tempsRelatif } from './useStatsWidgets';
import { titreIncident } from '../../../../utils/titreIncident';


// Anneau SVG : un segment par niveau, cliquable.
const arc = (cx, cy, r, ri, a0, a1) => {
  if (a1 - a0 <= 0.002) return '';
  const grand = a1 - a0 > Math.PI ? 1 : 0;
  const p = (a, R) => [cx + R * Math.cos(a), cy + R * Math.sin(a)];
  const [x0, y0] = p(a0, r);
  const [x1, y1] = p(a1, r);
  const [x2, y2] = p(a1, ri);
  const [x3, y3] = p(a0, ri);
  return `M${x0} ${y0}A${r} ${r} 0 ${grand} 1 ${x1} ${y1}L${x2} ${y2}A${ri} ${ri} 0 ${grand} 0 ${x3} ${y3}Z`;
};

/**
 * Trois widgets reliés à la carte :
 * - Par localité : `onZone(nom)` recadre et filtre la carte ;
 * - À traiter en priorité : `onIncident(id)` ouvre le signalement sur la carte ;
 * - Gravité : `onGravite(cle)` filtre la carte par niveau.
 */
export const StatsWidgets = ({ stats, zoneActive = null, graviteActive = null, onZone, onGravite, onIncident }) => {
  const { locationStats, graviteParZone, nonResolus, aTraiter, aAfficher, severityData, totalGravite, sommePourcent } = useStatsWidgets(stats);

  let angle = -Math.PI / 2;
  const segments = severityData.map((item) => {
    const debut = angle;
    angle += (item.percentage / sommePourcent) * Math.PI * 2;
    return { ...item, d: arc(60, 60, 52, 34, debut, angle - 0.001) };
  });

  return (
    <div className="stats-widgets">
      {/* Par localité */}
      <section className="stats-widget">
        <header className="widget-header">
          <h3>Par localité</h3>
          <small>cliquez pour zoomer</small>
        </header>
        <div className="widget-content">
          {!stats ? (
            [0, 1, 2, 3, 4].map((n) => <ShimmerText key={n} line={2} gap={6} />)
          ) : locationStats.length > 0 ? (
            locationStats.map((zone) => (
              <button
                key={zone.name}
                type="button"
                className={`zone-row ${zoneActive === zone.name ? 'is-active' : ''}`}
                aria-pressed={zoneActive === zone.name}
                disabled={zone.name === 'Zone inconnue'}
                title={zone.name === 'Zone inconnue' ? 'Signalements sans localité : impossible de les situer' : undefined}
                onClick={() => onZone?.(zoneActive === zone.name ? null : zone.name)}
              >
                <span className="zone-name" title={zone.name}>{zone.name}</span>
                <span className="zone-count">{zone.count.toLocaleString('fr-FR')}</span>
                <span className="zone-bar" aria-hidden="true">
                  <span className="zone-bar-fill" style={{ width: `${Math.max(zone.ratio * 100, 4)}%` }}>
                    {(() => {
                      const c = graviteParZone?.[zone.name];
                      const total = c ? c.high + c.medium + c.low : 0;
                      if (!total) return <i style={{ width: '100%', backgroundColor: 'var(--color-primary)' }} />;
                      return ['high', 'medium', 'low'].map((cle) => (
                        <i key={cle} style={{ width: `${(c[cle] / total) * 100}%`, backgroundColor: couleurGravite(cle) }} />
                      ));
                    })()}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className="widget-empty">Aucune donnée pour ce périmètre.</p>
          )}
        </div>
      </section>

      {/* À traiter en priorité */}
      <section className="stats-widget">
        <header className="widget-header">
          <h3>À traiter en priorité</h3>
          {nonResolus && <small>{aTraiter.length.toLocaleString('fr-FR')} en attente</small>}
        </header>
        <div className="widget-content widget-content-list">
          {!nonResolus ? (
            [0, 1, 2, 3].map((n) => (
              <div key={n} className="todo-row todo-row-chargement" aria-hidden="true">
                <ShimmerThumbnail height={38} width={38} rounded />
                <div className="todo-text"><ShimmerText line={2} gap={6} /></div>
              </div>
            ))
          ) : aTraiter.length > 0 ? (
            aAfficher.map((incident) => (
              <button key={incident.id} type="button" className="todo-row" onClick={() => onIncident?.(incident.id)}>
                <span
                  className="todo-thumb"
                  style={incident.thumbnail || incident.photo ? { backgroundImage: `url(${incident.thumbnail || incident.photo})` } : undefined}
                >
                  <i style={{ backgroundColor: couleurGravite(incident._gravite) }} title={`Gravité ${libelleGravite(incident._gravite).toLowerCase()}`} />
                </span>
                <span className="todo-text">
                  <b title={titreIncident(incident, 400)}>{titreIncident(incident)}</b>
                  {incident.zone && <small>{incident.zone}</small>}
                </span>
                <span className="todo-age">{tempsRelatif(incident.created_at)}</span>
              </button>
            ))
          ) : (
            <p className="widget-empty">Rien à traiter. Bravo.</p>
          )}
        </div>
      </section>

      {/* Gravité */}
      <section className="stats-widget">
        <header className="widget-header">
          <h3>Gravité</h3>
        </header>
        <div className="widget-content severity-content">
          <svg viewBox="0 0 120 120" className="severity-donut" role="img" aria-label="Répartition par gravité">
            {totalGravite === 0 ? (
              <circle cx="60" cy="60" r="43" fill="none" stroke="var(--color-border)" strokeWidth="18" />
            ) : (
              segments.map((s) => s.d && (
                <path
                  key={s.cle}
                  d={s.d}
                  fill={s.color}
                  className={graviteActive && graviteActive !== s.cle ? 'is-dim' : ''}
                  onClick={() => onGravite?.(graviteActive === s.cle ? null : s.cle)}
                >
                  <title>{`${s.label} : ${s.count}`}</title>
                </path>
              ))
            )}
            <text x="60" y="58" textAnchor="middle" className="donut-total">{totalGravite.toLocaleString('fr-FR')}</text>
            <text x="60" y="74" textAnchor="middle" className="donut-sub">actifs</text>
          </svg>
          <div className="severity-legend">
            {severityData.map((item) => (
              <button
                key={item.cle}
                type="button"
                className={`legend-item ${graviteActive === item.cle ? 'is-active' : ''}`}
                aria-pressed={graviteActive === item.cle}
                onClick={() => onGravite?.(graviteActive === item.cle ? null : item.cle)}
              >
                <span className="legend-dot" style={{ backgroundColor: item.color }} />
                <span className="legend-label">{item.label}</span>
                <span className="legend-value">{item.percentage} %</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default StatsWidgets;
