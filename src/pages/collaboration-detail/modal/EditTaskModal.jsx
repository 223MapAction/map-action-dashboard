import React, { useEffect } from 'react';
import { CloseCircle } from 'iconsax-react';
import { useCollaborationDetail } from '../context/collaborationDetailContexte';
import { Dialogue } from '../../../components/molecules/Dialogue';
import { aujourdhui, lendemain, dateCourte } from './dates';
import { ChampDate } from './ChampDate';
import { IcoCrayon, IcoInfo } from './icones';

// Les contrôles de dates de useTaches renvoient une phrase ; on la range sous
// le champ qu'elle concerne plutôt qu'en bandeau au-dessus du formulaire.
const champDeLErreur = (message = '') => {
  if (message.includes("antérieure à la date d'aujourd'hui")) return 'debut';
  if (message.includes('date de début') || message.includes('date de fin')) return 'fin';
  return null;
};

const Erreur = ({ id, children }) => (
  <span id={id} className="dg-erreur"><IcoInfo />{children}</span>
);

/**
 * Modifier une tâche existante. S'ouvre depuis le crayon d'une tâche de la
 * liste ; se ferme d'elle-même après l'enregistrement et confirme par un toast.
 */
export const EditTaskModal = ({ onToast }) => {
  const {
    currentTasks,
    editingTaskId,
    editTaskTitle, setEditTaskTitle,
    editTaskDescription, setEditTaskDescription,
    editTaskStartDate, setEditTaskStartDate,
    editTaskDeadline, setEditTaskDeadline,
    editTaskSaving, taskAlert,
    cancelEditTask, saveEditTask, setTaskToDelete,
  } = useCollaborationDetail();

  const succes = taskAlert?.type === 'success';

  // Enregistré : on ferme tout de suite et on le dit, au lieu de laisser un
  // bandeau vert dans une fenêtre qui n'a plus rien à faire.
  useEffect(() => {
    if (!succes) return;
    onToast?.('Tâche enregistrée');
    cancelEditTask();
  }, [succes, onToast, cancelEditTask]);

  const tache = currentTasks.find((t) => t.id === editingTaskId);
  if (!editingTaskId || !tache) return null;

  const erreur = taskAlert?.type === 'danger' ? taskAlert.message : null;
  const champ = champDeLErreur(erreur || '');
  const today = aujourdhui();

  const supprimer = () => {
    cancelEditTask();
    setTaskToDelete(tache);
  };

  return (
    <Dialogue
      onClose={cancelEditTask}
      verrouille={editTaskSaving}
      titre="Modifier la tâche"
      sousTitre={`Créée ${tache.createdBy === 'me' ? 'par vous' : `par ${tache.createdBy}`}${tache.created_at ? ` le ${dateCourte(tache.created_at)}` : ''} · en cours`}
      icone={<IcoCrayon />}
      pied={({ close }) => (
        <>
          <button type="button" className="dg-btn dg-btn-texte is-ko" onClick={supprimer} disabled={editTaskSaving}>Supprimer</button>
          <span className="dg-espace" />
          <button type="button" className="dg-btn dg-btn-g" onClick={close} disabled={editTaskSaving}>Annuler</button>
          <button
            type="submit"
            form="form-edition-tache"
            className="dg-btn dg-btn-p"
            disabled={!editTaskTitle.trim() || editTaskSaving}
          >
            {editTaskSaving ? <><span className="dg-spin" aria-hidden="true" />Enregistrement…</> : 'Enregistrer'}
          </button>
        </>
      )}
    >
      {erreur && !champ && (
        <div className="dg-alerte dg-alerte-ko" role="alert">
          <CloseCircle size={18} variant="Bold" color="currentColor" /><span>{erreur}</span>
        </div>
      )}

      <form
        id="form-edition-tache"
        className="tm-form"
        noValidate
        onSubmit={(e) => { e.preventDefault(); saveEditTask(tache.id); }}
      >
        <label className="dg-champ">
          Que faut-il faire ?
          <input
            type="text"
            className="dg-input"
            value={editTaskTitle}
            onChange={(e) => setEditTaskTitle(e.target.value)}
            disabled={editTaskSaving}
            maxLength={200}
          />
        </label>

        <label className="dg-champ">
          <span>Détails <span className="dg-opt">facultatif</span></span>
          <textarea
            className="dg-textarea"
            rows={3}
            value={editTaskDescription}
            onChange={(e) => setEditTaskDescription(e.target.value)}
            disabled={editTaskSaving}
          />
        </label>

        <div className="dg-grille2">
          <ChampDate
            libelle="Début"
            valeur={editTaskStartDate}
            min={today}
            onChange={setEditTaskStartDate}
            disabled={editTaskSaving}
            invalide={champ === 'debut'}
            idErreur={champ === 'debut' ? 'err-debut' : undefined}
          >
            {champ === 'debut' && <Erreur id="err-debut">{erreur}</Erreur>}
          </ChampDate>
          <ChampDate
            libelle="Échéance"
            valeur={editTaskDeadline}
            min={lendemain(editTaskStartDate || today)}
            onChange={setEditTaskDeadline}
            disabled={editTaskSaving}
            invalide={champ === 'fin'}
            idErreur={champ === 'fin' ? 'err-fin' : undefined}
          >
            {champ === 'fin' && <Erreur id="err-fin">{erreur}</Erreur>}
          </ChampDate>
        </div>
      </form>
    </Dialogue>
  );
};

export default EditTaskModal;
