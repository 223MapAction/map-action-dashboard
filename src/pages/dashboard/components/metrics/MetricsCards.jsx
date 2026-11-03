import React, { useMemo } from 'react';
import { ShimmerText, ShimmerTitle } from 'react-shimmer-effects';
import './metrics-cards.css';

// Pictogrammes au trait, identiques à la maquette : document, main, coche.
const Icone = ({ children }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const IconeDocument = () => (
  <Icone><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></Icone>
);
const IconeMain = () => (
  <Icone>
    <path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V11M16 9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L4.3 14a1.5 1.5 0 0 1 2.4-1.8L8 14" />
  </Icone>
);
const IconeCoche = () => (
  <Icone><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></Icone>
);

const formatNombre = (n) => n.toLocaleString('fr-FR');

const pourcentage = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

/**
 * Trois indicateurs qui pilotent la carte : un clic filtre les signalements
 * correspondants (`onSelect('taken' | 'resolved')`), « Total » remet à zéro.
 */
export const MetricsCards = ({ stats: statsData, actif = null, onSelect }) => {
  const stats = useMemo(() => {
    const total = statsData?.total_alerts ?? 0;
    const resolved = statsData?.resolved_incidents ?? 0;
    const takenIntoAccount = statsData?.active_responses ?? 0;
    const unresolved = Math.max(total - resolved - takenIntoAccount, 0);
    return { total, resolved, takenIntoAccount, unresolved };
  }, [statsData]);

  const metrics = [
    {
      id: null,
      label: 'Total des signalements',
      value: stats.total,
      icon: IconeDocument,
      tone: 'primary',
      badge: stats.unresolved > 0 ? `${formatNombre(stats.unresolved)} en attente` : null,
      badgeTone: 'down',
      hint: 'déclarés, pris en compte et résolus',
    },
    {
      id: 'taken',
      label: 'Pris en compte',
      value: stats.takenIntoAccount,
      icon: IconeMain,
      tone: 'primary',
      badge: `${pourcentage(stats.takenIntoAccount, stats.total)} %`,
      badgeTone: 'up',
      hint: 'des signalements sont suivis par une organisation',
    },
    {
      id: 'resolved',
      label: 'Résolus',
      value: stats.resolved,
      icon: IconeCoche,
      tone: 'success',
      badge: `${pourcentage(stats.resolved, stats.total)} %`,
      badgeTone: pourcentage(stats.resolved, stats.total) >= 50 ? 'up' : 'down',
      hint: 'taux de résolution',
    },
  ];

  if (!statsData) {
    return (
      <div className="metrics-cards" aria-busy="true" aria-label="Chargement des indicateurs">
        {[0, 1, 2].map((n) => (
          <div key={n} className="metric-card metric-card-chargement">
            <ShimmerTitle line={1} gap={8} variant="secondary" />
            <ShimmerTitle line={1} gap={8} variant="primary" />
            <ShimmerText line={1} gap={8} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="metrics-cards">
      {metrics.map(({ id, label, value, icon: Icon, tone, badge, badgeTone, hint }) => {
        const estActif = id !== null && actif === id;
        return (
          <button
            key={label}
            type="button"
            className={`metric-card ${estActif ? 'is-active' : ''}`}
            aria-pressed={id !== null ? estActif : undefined}
            onClick={() => onSelect?.(estActif ? null : id)}
          >
            <span className="metric-go">{estActif ? 'Filtre actif' : 'Voir sur la carte'}</span>
            <span className="metric-card-top">
              <span className={`metric-icon metric-icon-${tone}`}>
                <Icon />
              </span>
              <span className="metric-label">{label}</span>
            </span>
            <span className="metric-value">
              <span>{formatNombre(value)}</span>
              {badge && <span className={`metric-badge metric-badge-${badgeTone}`}>{badge}</span>}
            </span>
            <span className="metric-hint">{hint}</span>
          </button>
        );
      })}
    </div>
  );
};

export default MetricsCards;
