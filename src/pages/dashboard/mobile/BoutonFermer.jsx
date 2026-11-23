export const BoutonFermer = ({ onClick, libelle = 'Fermer', className = '' }) => (
  <button type="button" className={`dm-fermer ${className}`} onClick={onClick} aria-label={libelle}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  </button>
);
