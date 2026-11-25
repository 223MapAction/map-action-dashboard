import { useLocation } from 'react-router-dom';
import { texteCopyright } from '../../utils/copyright';
import './mention-copyright.css';

const PAGES_PUBLIQUES = ['/login', '/forgot-password', '/reset-password'];

/**
 * Mention de copyright des pages publiques (connexion, mot de passe oublié,
 * réinitialisation). Les pages connectées affichent la leur, `PiedDePage`,
 * dans leur propre colonne de contenu. Les pages publiques retirent
 * `--hauteur-copyright` de leur hauteur minimale, variable qui ne vaut
 * quelque chose que lorsque ce pied de page est affiché.
 */
export const MentionCopyright = () => {
  const { pathname } = useLocation();
  if (!PAGES_PUBLIQUES.includes(pathname)) return null;

  return (
    <footer className="mention-copyright" role="contentinfo">
      {texteCopyright()}
    </footer>
  );
};

export default MentionCopyright;
