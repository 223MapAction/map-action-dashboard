import { useEffect, useState } from 'react';

const REQUETE = '(max-width: 640px)';

/** Vrai sous 640 px, le seuil de la refonte mobile native. */
export const useEstTelephone = () => {
  const [estTelephone, setEstTelephone] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.(REQUETE).matches));

  useEffect(() => {
    const mq = window.matchMedia?.(REQUETE);
    if (!mq) return undefined;
    const maj = (e) => setEstTelephone(e.matches);
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);

  return estTelephone;
};
