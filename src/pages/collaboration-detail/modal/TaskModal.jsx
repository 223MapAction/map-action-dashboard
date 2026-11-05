import React, { useEffect, useRef } from 'react';
import { TickCircle, CloseCircle } from 'iconsax-react';
import { useCollaborationDetail } from '../context/collaborationDetailContexte';
import { Dialogue } from '../../../components/molecules/Dialogue';
import { aujourdhui, ajouterJours, lendemain, dateCourte, ecartJours, libelleDuree } from './dates';
import { ChampDate } from './ChampDate';
import { IcoTache, IcoCroix } from './icones';

const DUREES = [1, 3, 7, 14];

/**
 * Créer une ou plusieurs tâches.
 *
 * On compose une liste « Prêtes à créer », puis on valide tout d'un coup : rien
 * n'est envoyé au serveur avant le bouton du pied. La modification d'une tâche
 * existante a sa propre fenêtre (EditTaskModal).
 */
export const TaskModal = () => {
  const {
    collaboration,
    showTaskModal,
    taskModalClosing,
    closeTaskModal,
    draftTasks,
    setDraftTasks,
    newTaskTitle,
    setNewTaskTitle,
    newTaskDescription,
    setNewTaskDescription,
    newTaskStartDate,
    setNewTaskStartDate,
    newTaskDeadline,
    setNewTaskDeadline,
    addDraftTask,
    submitNewTask,
    taskSubmitSaving,
    taskSubmitAlert,
  } = useCollaborationDetail();

  const titreRef = useRef(null);

  // Après « Ajouter à la liste », on revient au titre pour enchaîner la suivante.
  const nbBrouillons = draftTasks.length;
  useEffect(() => {
    if (nbBrouillons > 0) titreRef.current?.focus();
  }, [nbBrouillons]);

  if (!showTaskModal) return null;

  const today = aujourdhui();
  const duree = ecartJours(newTaskStartDate, newTaskDeadline);
  const nbOrgs = (collaboration?.incidentDetails?.acting_organisations || []).length;

  const ajouter = (e) => {
    e.preventDefault();
    addDraftTask();
  };

  const libelleCreer = nbBrouillons > 1 ? `Créer les ${nbBrouillons} tâches` : 'Créer la tâche';

  return (
    <Dialogue
      onClose={closeTaskModal}
      enFermeture={Boolean(taskModalClosing)}
      verrouille={taskSubmitSaving}
      titre="Nouvelles tâches"
      sousTitre={collaboration?.title}
      icone={<IcoTache />}
      pied={(
        <>
          <span className="dg-pied-info">
            {nbOrgs > 1 ? `Visibles par les ${nbOrgs} organisations` : 'Visibles par toutes les organisations de la collaboration'}
          </span>
          <button type="button" className="dg-btn dg-btn-g" onClick={closeTaskModal} disabled={taskSubmitSaving}>Annuler</button>
          <button type="button" className="dg-btn dg-btn-p" onClick={submitNewTask} disabled={nbBrouillons === 0 || taskSubmitSaving}>
            {taskSubmitSaving ? <><span className="dg-spin" aria-hidden="true" />Création…</> : libelleCreer}
          </button>
        </>
      )}
    >
      {taskSubmitAlert && (
        <div className={`dg-alerte ${taskSubmitAlert.type === 'success' ? 'dg-alerte-ok' : 'dg-alerte-ko'}`} role={taskSubmitAlert.type === 'success' ? 'status' : 'alert'}>
          {taskSubmitAlert.type === 'success'
            ? <TickCircle size={18} variant="Bold" color="currentColor" />
            : <CloseCircle size={18} variant="Bold" color="currentColor" />}
          <span>{taskSubmitAlert.message}</span>
        </div>
      )}

      <form onSubmit={ajouter} className="tm-form" noValidate>
        <label className="dg-champ">
          Que faut-il faire ?
          <input
            ref={titreRef}
            data-autofocus
            type="text"
            className="dg-input"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Ex. : curage du tronçon sud"
            disabled={taskSubmitSaving}
            maxLength={200}
          />
        </label>

        <label className="dg-champ">
          <span>Détails <span className="dg-opt">facultatif · matériel, lieu précis, consignes</span></span>
          <textarea
            className="dg-textarea"
            rows={2}
            value={newTaskDescription}
            onChange={(e) => setNewTaskDescription(e.target.value)}
            disabled={taskSubmitSaving}
          />
        </label>

        <div className="dg-grille2">
          <ChampDate libelle="Début" valeur={newTaskStartDate} min={today} onChange={setNewTaskStartDate} disabled={taskSubmitSaving} />
          <ChampDate libelle="Échéance" valeur={newTaskDeadline} min={lendemain(newTaskStartDate || today)} onChange={setNewTaskDeadline} disabled={taskSubmitSaving} />
        </div>

        <div className="dg-pastilles" role="group" aria-label="Durée rapide">
          {DUREES.map((n) => (
            <button
              key={n}
              type="button"
              className="dg-pastille"
              aria-pressed={duree === n}
              onClick={() => setNewTaskDeadline(ajouterJours(newTaskStartDate || today, n))}
              disabled={taskSubmitSaving}
            >
              {libelleDuree(n)}
            </button>
          ))}
          <span className="dg-espace" />
          <button type="submit" className="dg-btn dg-btn-contour dg-btn-s" disabled={!newTaskTitle.trim() || taskSubmitSaving}>
            Ajouter à la liste
          </button>
        </div>
      </form>

      {nbBrouillons > 0 && (
        <div className="dg-boite">
          <div className="dg-boite-tete">
            <b>Prêtes à créer</b>
            <span>Rien n'est enregistré avant de valider</span>
          </div>
          <ul className="tm-liste">
            {draftTasks.map((t, i) => {
              const jours = ecartJours(t.start_date, t.end_date);
              return (
                <li key={`${t.title}-${i}`}>
                  <span className="tm-point" aria-hidden="true" />
                  <div>
                    <b>{t.title}</b>
                    <span>
                      {t.start_date ? dateCourte(t.start_date) : 'Sans date'}
                      {t.end_date && ` → ${dateCourte(t.end_date)}`}
                      {jours ? ` · ${libelleDuree(jours)}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="dg-ico"
                    onClick={() => setDraftTasks(draftTasks.filter((_, j) => j !== i))}
                    disabled={taskSubmitSaving}
                    aria-label={`Retirer « ${t.title} » de la liste`}
                  >
                    <IcoCroix />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Dialogue>
  );
};

export default TaskModal;
