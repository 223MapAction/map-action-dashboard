import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { EscapeToClose } from '../../../components/atoms/EscapeToClose';
import './mobile.css';

/**
 * Feuille d'actions d'un signalement sur téléphone : les actions groupées, le
 * bouton Annuler à part. Dialogue ne convient pas ici : il impose un en-tête
 * avec une croix, que la maquette n'a pas.
 *
 * @param {string} titre
 * @param {string} [sousTitre]
 * @param {{ id: string, label: string, tone?: 'danger', onSelect: () => void }[]} actions
 * @param {() => void} onClose
 */
export const FeuilleActions = ({ titre, sousTitre, actions, onClose }) => {
  const fenetreRef = useRef(null);
  const idTitre = useId();

  useEffect(() => {
    const origine = document.activeElement;
    fenetreRef.current?.focus({ preventScroll: true });
    return () => origine?.focus?.({ preventScroll: true });
  }, []);

  const choisir = (action) => {
    onClose();
    action.onSelect();
  };

  return createPortal(
    <div className="sgm-fond" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <EscapeToClose onClose={onClose} />
      <div ref={fenetreRef} className="sgm-actions" role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1}>
        <div className="sgm-actions-groupe">
          <div className="sgm-actions-tete">
            <b id={idTitre}>{titre}</b>
            {sousTitre && <span>{sousTitre}</span>}
          </div>
          {actions.map((action) => (
            <button key={action.id} type="button" className={`sgm-action ${action.tone === 'danger' ? 'is-danger' : ''}`} onClick={() => choisir(action)}>
              {action.label}
            </button>
          ))}
        </div>
        <button type="button" className="sgm-action sgm-action-annuler" onClick={onClose}>Annuler</button>
      </div>
    </div>,
    document.body,
  );
};

export default FeuilleActions;
