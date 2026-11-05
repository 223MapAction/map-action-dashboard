import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EscapeToClose } from '../atoms/EscapeToClose';
import './dialogue.css';

/** Durée de l'animation de sortie, alignée sur `.dg--sortie` dans dialogue.css. */
const DUREE_FERMETURE = 180;

const FOCUSABLES = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Fenêtre de dialogue centrée.
 *
 * Pendant de OffcanvasModal (panneau latéral) pour les tâches qui demandent
 * toute l'attention : créer, confirmer, résoudre. Sous 640 px elle devient une
 * feuille ancrée en bas d'écran, là où le pouce l'atteint.
 *
 * Elle prend en charge ce que chaque modale refaisait à la main : le focus
 * placé dans la fenêtre à l'ouverture et rendu à l'élément d'origine à la
 * fermeture, la tabulation qui reste dans la fenêtre, Échap, le clic sur le
 * fond, et l'animation de sortie.
 *
 * Le focus va sur l'élément marqué `data-autofocus`, sinon sur la fenêtre
 * elle-même : un formulaire choisit son premier champ, une lecture n'impose
 * rien.
 *
 * @param {() => void} onClose   appelé APRÈS l'animation de sortie
 * @param {string}     titre
 * @param {React.ReactNode} [sousTitre]
 * @param {React.ReactNode} [icone]  pictogramme de l'en-tête
 * @param {'primary'|'success'|'danger'|'warning'} [ton]
 * @param {'sm'|'md'|'lg'} [taille]  440, 580 ou 620 px
 * @param {boolean}    [pile]   confirmation : pictogramme au-dessus du titre, sans croix
 * @param {React.ReactNode} [barre]  bandeau fixe entre l'en-tête et le contenu
 * @param {'dialog'|'alertdialog'} [role]
 * @param {boolean}    [enFermeture]  mode contrôlé : la page possède l'animation
 * @param {boolean}    [verrouille]   empêche de fermer (soumission en cours)
 * @param {React.ReactNode | (({ close }) => React.ReactNode)} [pied]
 * @param {React.ReactNode | (({ close }) => React.ReactNode)} children
 */
export const Dialogue = ({
  onClose,
  titre,
  sousTitre,
  icone,
  ton = 'primary',
  taille = 'md',
  pile = false,
  barre,
  role = 'dialog',
  enFermeture,
  verrouille = false,
  pied,
  children,
}) => {
  const [fermetureInterne, setFermetureInterne] = useState(false);
  const fenetreRef = useRef(null);
  const origineRef = useRef(null);
  const idTitre = useId();
  const idSousTitre = useId();

  const estControle = enFermeture !== undefined;
  const sortie = estControle ? enFermeture : fermetureInterne;

  const close = useCallback(() => {
    if (verrouille || sortie) return;
    if (estControle) {
      onClose();
      return;
    }
    setFermetureInterne(true);
    setTimeout(() => {
      onClose();
      setFermetureInterne(false);
    }, DUREE_FERMETURE);
  }, [verrouille, sortie, estControle, onClose]);

  // Focus : dans la fenêtre à l'ouverture, rendu à l'élément d'origine ensuite.
  useEffect(() => {
    origineRef.current = document.activeElement;
    const fenetre = fenetreRef.current;
    (fenetre?.querySelector('[data-autofocus]') || fenetre)?.focus({ preventScroll: true });
    const html = document.documentElement;
    const ancien = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = ancien;
      origineRef.current?.focus?.({ preventScroll: true });
    };
  }, []);

  // La tabulation boucle dans la fenêtre au lieu de partir dans la page dessous.
  const pieger = (e) => {
    if (e.key !== 'Tab') return;
    const elements = [...fenetreRef.current.querySelectorAll(FOCUSABLES)].filter((el) => el.offsetParent !== null);
    if (!elements.length) return;
    const premier = elements[0];
    const dernier = elements[elements.length - 1];
    if (e.shiftKey && (document.activeElement === premier || document.activeElement === fenetreRef.current)) {
      e.preventDefault();
      dernier.focus();
    } else if (!e.shiftKey && document.activeElement === dernier) {
      e.preventDefault();
      premier.focus();
    }
  };

  const contenu = (valeur) => (typeof valeur === 'function' ? valeur({ close }) : valeur);

  return createPortal(
    <div className={`dg-fond ${sortie ? 'dg--sortie' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      {!verrouille && <EscapeToClose onClose={close} />}
      <section
        ref={fenetreRef}
        className={`dg dg-${taille} dg-ton-${ton} ${pile ? 'dg-pile' : ''} ${sortie ? 'dg--sortie' : ''}`}
        role={role}
        aria-modal="true"
        aria-labelledby={idTitre}
        aria-describedby={sousTitre ? idSousTitre : undefined}
        tabIndex={-1}
        onKeyDown={pieger}
      >
        <span className="dg-poignee" aria-hidden="true" />
        <header className="dg-tete">
          {icone && <span className="dg-icone" aria-hidden="true">{icone}</span>}
          <div className="dg-titres">
            <h2 id={idTitre}>{titre}</h2>
            {sousTitre && <p id={idSousTitre}>{sousTitre}</p>}
          </div>
          {!pile && (
            <button type="button" className="dg-fermer" onClick={close} disabled={verrouille} aria-label="Fermer">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </header>

        {barre && <div className="dg-barre">{contenu(barre)}</div>}

        <div className="dg-corps">{contenu(children)}</div>

        {pied && <footer className="dg-pied">{contenu(pied)}</footer>}
      </section>
    </div>,
    document.body,
  );
};

export default Dialogue;
