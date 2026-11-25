import { texteCopyright } from '../../utils/copyright';
import './pied-de-page.css';

/**
 * Mention de copyright des pages connectées. Elle se place en dernier dans la
 * colonne de contenu de la page, à droite de la barre latérale et à gauche des
 * panneaux latéraux : elle ne passe donc jamais sous l'un ou l'autre.
 *
 * Sous 640 px, elle est masquée : la barre d'onglets occupe le bas de l'écran
 * et la mention figure dans l'écran « Plus ».
 */
export const PiedDePage = () => (
  <footer className="pied-de-page" role="contentinfo">
    {texteCopyright()}
  </footer>
);

export default PiedDePage;
