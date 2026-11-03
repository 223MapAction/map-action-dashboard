import { useCallback, useEffect, useRef, useState } from 'react';
import { BandeauErreur } from '../../../components/molecules/BandeauErreur';
import { FeuilleBasse, ReglesCollaboration } from './FeuilleBasse';

const DELAI_ANNULATION = 5000;

/**
 * Les demandes qui attendent une réponse, sur téléphone.
 *
 * Accepter part après 5 secondes : le temps d'annuler. Quitter la page entre-temps
 * envoie la décision, pour ne pas perdre un geste que l'utilisateur croit fait.
 *
 * @param {{ id: string, titre: string, type: string, texte: string, motif?: string, image?: string, lieu?: string, requete: object }[]} elements
 * @param {(requete: object, action: 'accept'|'reject') => Promise<void>} onDecider
 * @param {(requete: object) => void} onVoir  ouvre la fiche du signalement
 */
export const ListeATraiter = ({ elements, onDecider, onVoir }) => {
  const [attente, setAttente] = useState(null);
  const [apercu, setApercu] = useState(null);
  const [aRefuser, setARefuser] = useState(null);
  const [regles, setRegles] = useState(false);
  const [masques, setMasques] = useState([]);
  const [erreur, setErreur] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const enCoursRef = useRef(null);

  const envoyer = useCallback(async (el, action) => {
    try {
      await onDecider(el.requete, action);
    } catch (err) {
      setMasques((m) => m.filter((id) => id !== el.id));
      setErreur(err?.response?.data?.detail || err?.response?.data?.message || "La décision n'a pas pu être enregistrée. Réessayez.");
    }
  }, [onDecider]);

  const envoyerRef = useRef(envoyer);
  useEffect(() => { envoyerRef.current = envoyer; }, [envoyer]);

  useEffect(() => () => {
    if (!enCoursRef.current) return;
    clearTimeout(enCoursRef.current.minuteur);
    envoyerRef.current(enCoursRef.current.el, 'accept');
  }, []);

  const lancerEnAttente = () => {
    if (!enCoursRef.current) return;
    clearTimeout(enCoursRef.current.minuteur);
    envoyer(enCoursRef.current.el, 'accept');
    enCoursRef.current = null;
  };

  const accepter = (el) => {
    lancerEnAttente();
    setErreur(null);
    setApercu(null);
    setMasques((m) => [...m, el.id]);
    setAttente(el);
    const minuteur = setTimeout(() => {
      envoyer(el, 'accept');
      enCoursRef.current = null;
      setAttente(null);
    }, DELAI_ANNULATION);
    enCoursRef.current = { el, minuteur };
  };

  const annuler = () => {
    if (!enCoursRef.current) return;
    const { el, minuteur } = enCoursRef.current;
    clearTimeout(minuteur);
    setMasques((m) => m.filter((id) => id !== el.id));
    enCoursRef.current = null;
    setAttente(null);
  };

  const refuser = async () => {
    setEnvoi(true);
    setErreur(null);
    const el = aRefuser;
    setMasques((m) => [...m, el.id]);
    await envoyer(el, 'reject');
    setEnvoi(false);
    setARefuser(null);
  };

  const visibles = elements.filter((el) => !masques.includes(el.id));

  const boutons = (el) => (
    <div className="vlm-duo">
      <button type="button" className="vlm-btn vlm-btn-g" onClick={() => { setApercu(null); setARefuser(el); }}>Refuser</button>
      <button type="button" className="vlm-btn" onClick={() => accepter(el)}>Accepter</button>
    </div>
  );

  return (
    <>
      <BandeauErreur erreur={erreur} message={erreur} />
      {visibles.map((el) => (
        <article key={el.id} className="vlm-atraiter">
          <button type="button" className="vlm-atraiter-tete" onClick={() => setApercu(el)}>
            <span className="vlm-vignette" style={el.image ? { backgroundImage: `url("${el.image}")` } : undefined} />
            <span className="vlm-atraiter-t">
              <span className={`vlm-type ${el.type === 'Demande' ? 'is-demande' : ''}`}>{el.type}</span>
              <b>{el.titre}</b>
              <span>{el.texte}</span>
            </span>
          </button>
          {el.motif && <p className="vlm-motif">« {el.motif} »</p>}
          {boutons(el)}
        </article>
      ))}

      {attente && (
        <div className="vlm-toast" role="status">
          <span>Demande acceptée</span>
          <button type="button" onClick={annuler}>Annuler</button>
        </div>
      )}

      {apercu && (
        <FeuilleBasse ariaLabel={apercu.titre} onClose={() => setApercu(null)}>
          <div className="vlm-regles">
            <h2>{apercu.titre}</h2>
            <p className="vlm-gris">{[apercu.lieu, apercu.texte].filter(Boolean).join(' · ')}</p>
            {apercu.motif && <p>« {apercu.motif} »</p>}
            <button type="button" className="vlm-lien" onClick={() => { const r = apercu.requete; setApercu(null); onVoir(r); }}>Voir le signalement</button>
            <button type="button" className="vlm-lien" onClick={() => { setApercu(null); setRegles(true); }}>Règles de collaboration</button>
            {boutons(apercu)}
          </div>
        </FeuilleBasse>
      )}

      {aRefuser && (
        <FeuilleBasse ariaLabel="Refuser" onClose={() => !envoi && setARefuser(null)}>
          <div className="vlm-regles">
            <h2>Refuser : {aRefuser.titre} ?</h2>
            <p className="vlm-gris">{aRefuser.texte}</p>
            <button type="button" className="vlm-btn vlm-btn-ko" onClick={refuser} disabled={envoi}>{envoi ? 'Envoi…' : 'Refuser'}</button>
            <button type="button" className="vlm-btn vlm-btn-g" onClick={() => setARefuser(null)} disabled={envoi}>Annuler</button>
          </div>
        </FeuilleBasse>
      )}

      {regles && <ReglesCollaboration onClose={() => setRegles(false)} />}
    </>
  );
};

export default ListeATraiter;
