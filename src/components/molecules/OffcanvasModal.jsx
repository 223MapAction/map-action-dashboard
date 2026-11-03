import { useCallback, useState } from 'react';
import { CloseCircle } from 'iconsax-react';
import { EscapeToClose } from '../atoms/EscapeToClose';
import '../../styles/modals.css';

/** Durée de l'animation de sortie, alignée sur `am-offcanvas-panel--closing`. */
const DUREE_FERMETURE = 280;

/**
 * Coquille commune à toutes les modales latérales du dashboard.
 *
 * Les modales du projet répétaient chacune le même échafaudage : un état
 * `isClosing`, un `handleClose` temporisé sur l'animation, le calcul des
 * classes du panneau et du fond, le fond cliquable, la fermeture au clavier et
 * un en-tête avec bouton de fermeture. Cette duplication est la raison pour
 * laquelle une correction devait être appliquée une vingtaine de fois.
 *
 * @param {() => void} onClose       appelé APRÈS l'animation de sortie
 * @param {string}     title         titre de l'en-tête
 * @param {React.ReactNode} [subtitle] ligne secondaire sous le titre
 * @param {string}    [ariaLabel]    libellé accessible ; défaut : `title`
 * @param {'sm'|'md'} [size]         largeur du panneau
 * @param {'danger'}  [tone]         teinte de l'en-tête
 * @param {'dialog'|'alertdialog'} [role]
 * @param {'plain'|'icon'} [closeVariant]
 *        `plain` rend le bouton Bootstrap `btn-close` (glyphe ×) utilisé par la
 *        majorité des modales ; `icon` rend une icône CloseCircle.
 * @param {boolean}   [closeDisabled]
 *        Verrouille la fermeture — bouton grisé, fond inerte, Échap sans effet.
 *        Utilisé pendant une soumission ou après un succès, pour empêcher de
 *        quitter au mauvais moment. Le bouton reste visible, contrairement à
 *        une suppression pure, afin de ne pas faire disparaître un repère.
 * @param {string}    [className]    classe ajoutée au panneau (et `<classe>-fond` au fond)
 * @param {React.ReactNode} [footer]
 * @param {React.ReactNode | (({ close }) => React.ReactNode)} children
 *        Sous forme de fonction, reçoit `close` pour fermer depuis l'intérieur
 *        (bouton « Annuler ») en conservant l'animation.
 */
export const OffcanvasModal = ({
  onClose,
  title,
  subtitle,
  ariaLabel,
  size = 'md',
  tone,
  role = 'dialog',
  closeVariant = 'icon',
  closeDisabled = false,
  isClosing,
  footer,
  footerLayout = 'row',
  className = '',
  children,
}) => {
  const [fermetureInterne, setFermetureInterne] = useState(false);

  // Deux modes.
  //
  // NON CONTRÔLÉ (isClosing omis) : la coquille possède l'animation. Elle passe
  // le panneau en sortie, attend, puis appelle onClose.
  //
  // CONTRÔLÉ (isClosing fourni) : la page parente ou un contexte possède déjà
  // l'animation — c'est le cas de treize modales du projet, où `closeXxxModal`
  // bascule un état `xxxClosing` puis démonte après temporisation. La coquille
  // se contente alors de refléter cet état et d'appeler onClose immédiatement.
  // Sans ce mode, les deux animations s'enchaîneraient.
  const estControle = isClosing !== undefined;
  const enFermeture = estControle ? isClosing : fermetureInterne;

  const close = useCallback(() => {
    if (closeDisabled || enFermeture) return;
    if (estControle) {
      onClose();
      return;
    }
    setFermetureInterne(true);
    setTimeout(() => {
      onClose();
      setFermetureInterne(false);
    }, DUREE_FERMETURE);
  }, [closeDisabled, enFermeture, estControle, onClose]);

  const classePanneau = [
    'am-offcanvas-panel',
    size === 'sm' ? 'am-offcanvas-panel--sm' : '',
    enFermeture ? 'am-offcanvas-panel--closing' : 'am-offcanvas-panel--opening',
    className,
  ].filter(Boolean).join(' ');

  const classeFond = [
    'am-offcanvas-backdrop',
    enFermeture ? 'am-offcanvas-backdrop--closing' : '',
    className ? `${className}-fond` : '',
  ].filter(Boolean).join(' ');

  const classeEntete = [
    'am-offcanvas-header',
    tone === 'danger' ? 'am-offcanvas-header--danger' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div className={classeFond} onClick={close} />
      {!closeDisabled && <EscapeToClose onClose={close} />}

      <aside
        className={classePanneau}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel || title}
      >
        <header className={classeEntete}>
          <div className="am-offcanvas-heading">
            <h3 className="am-offcanvas-title">{title}</h3>
            {subtitle && <p className="am-offcanvas-subtitle">{subtitle}</p>}
          </div>

          {closeVariant === 'plain' ? (
            <button
              type="button"
              className={tone === 'danger' ? 'btn-close btn-close-white' : 'btn-close'}
              onClick={close}
              disabled={closeDisabled}
              aria-label="Fermer"
            />
          ) : (
            <button
              type="button"
              className="am-offcanvas-close"
              onClick={close}
              disabled={closeDisabled}
              aria-label="Fermer"
            >
              <CloseCircle size={22} variant="Linear" color="currentColor" />
            </button>
          )}
        </header>

        {typeof children === 'function' ? children({ close }) : children}

        {footer && (
          <footer
            className={[
              'am-offcanvas-footer',
              footerLayout === 'col' ? 'am-offcanvas-footer--col' : '',
            ].filter(Boolean).join(' ')}
          >
            {footer}
          </footer>
        )}
      </aside>
    </>
  );
};

export default OffcanvasModal;
