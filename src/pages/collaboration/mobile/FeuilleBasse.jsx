import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { EscapeToClose } from '../../../components/atoms/EscapeToClose';
import '../../incident/mobile/mobile.css';
import './collaboration-mobile.css';

/**
 * Feuille qui monte du bas sur téléphone, à la hauteur de son contenu : filtres,
 * aperçu d'une demande, règles de collaboration.
 *
 * @param {string} ariaLabel
 * @param {() => void} onClose
 * @param {React.ReactNode} children
 */
export const FeuilleBasse = ({ ariaLabel, onClose, children }) => {
  const fenetreRef = useRef(null);

  useEffect(() => {
    const origine = document.activeElement;
    fenetreRef.current?.focus({ preventScroll: true });
    return () => origine?.focus?.({ preventScroll: true });
  }, []);

  return createPortal(
    <div className="sgm-fond" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <EscapeToClose onClose={onClose} />
      <section ref={fenetreRef} className="vlm-feuille" role="dialog" aria-modal="true" aria-label={ariaLabel} tabIndex={-1}>
        <span className="vlm-poignee" aria-hidden="true" />
        {children}
      </section>
    </div>,
    document.body,
  );
};

/** Les règles de collaboration, derrière le bouton i sur téléphone. */
export const ReglesCollaboration = ({ onClose }) => (
  <FeuilleBasse ariaLabel="Règles de collaboration" onClose={onClose}>
    <div className="vlm-regles">
      <h2>Règles de collaboration sur les Signalements</h2>
      <p><strong>1. Sans Leader :</strong> toute demande d'observation ou de contribution est automatiquement acceptée.</p>
      <p><strong>2. Prise en charge par un Leader :</strong> les contributions repassent « En attente » pour validation. Les observateurs restent actifs.</p>
      <button type="button" className="vlm-btn" onClick={onClose}>OK</button>
    </div>
  </FeuilleBasse>
);
