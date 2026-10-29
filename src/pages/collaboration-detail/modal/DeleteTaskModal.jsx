import { useState } from 'react';
import { CloseCircle } from 'iconsax-react';
import { Dialogue } from '../../../components/molecules/Dialogue';
import { logger } from '../../../utils/logger';
import { IcoCorbeille } from './icones';

const messageErreur = (error) => {
  const data = error?.response?.data;
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    return Object.entries(data)
      .map(([champ, e]) => `${champ} : ${Array.isArray(e) ? e.join(', ') : e}`)
      .join(' · ');
  }
  return "La tâche n'a pas pu être supprimée. Réessayez dans un instant.";
};

/**
 * Confirmer la suppression d'une tâche.
 *
 * La suppression elle-même appartient à `onConfirm` (la page fait la mise à
 * jour optimiste, l'appel et la notification temps réel). Cette fenêtre
 * l'appelait aussi de son côté : chaque suppression partait deux fois, et la
 * seconde, en échec, déclenchait un rechargement de la liste pour rien.
 *
 * @param {() => Promise<void>} onConfirm  rejette en cas d'échec
 * @param {() => void} [onRemettre]  proposé quand la tâche est en échec
 */
export const DeleteTaskModal = ({
  isOpen,
  onClose,
  onConfirm,
  taskTitle,
  impact,
  onRemettre,
}) => {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);

  if (!isOpen) return null;

  const confirmer = async (close) => {
    setErreur(null);
    setEnCours(true);
    try {
      await onConfirm();
      setEnCours(false);
      close();
    } catch (error) {
      logger.error('[DeleteTaskModal] Suppression impossible :', error);
      setErreur(messageErreur(error));
      setEnCours(false);
    }
  };

  const fermer = () => {
    setErreur(null);
    onClose();
  };

  return (
    <Dialogue
      onClose={fermer}
      role="alertdialog"
      taille="sm"
      ton="danger"
      pile
      verrouille={enCours}
      titre={`Supprimer « ${taskTitle || 'Sans titre'} » ?`}
      icone={<IcoCorbeille />}
      pied={({ close }) => (
        <>
          <span className="dg-espace" />
          <button type="button" className="dg-btn dg-btn-g" onClick={close} disabled={enCours}>Garder la tâche</button>
          <button type="button" className="dg-btn dg-btn-ko" onClick={() => confirmer(close)} disabled={enCours}>
            {enCours ? <><span className="dg-spin" aria-hidden="true" />Suppression…</> : 'Supprimer'}
          </button>
        </>
      )}
    >
      {({ close }) => (
        <>
          {erreur && (
            <div className="dg-alerte dg-alerte-ko" role="alert">
              <CloseCircle size={18} variant="Bold" color="currentColor" /><span>{erreur}</span>
            </div>
          )}
          <p className="dt-texte">{impact}</p>
          {onRemettre && (
            <button
              type="button"
              className="dt-lien"
              onClick={() => { onRemettre(); close(); }}
              disabled={enCours}
            >
              La remettre en cours à la place
            </button>
          )}
        </>
      )}
    </Dialogue>
  );
};

export default DeleteTaskModal;
