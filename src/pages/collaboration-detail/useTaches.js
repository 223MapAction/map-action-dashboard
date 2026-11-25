import { useState, useRef, useMemo } from 'react';
import { useSocketIncident } from '../../hooks/useSocketIncident';
import {
  createTaskService,
  completeTaskService,
  failTaskService,
  deleteTaskService,
  updateTaskService,
} from '../incident/service/task_service';
import { logger } from '../../utils/logger';

/**
 * Les taches d'une collaboration : liste temps reel, avancement, preuves,
 * creation, edition, suppression.
 *
 * Comme la discussion, ce bloc n'avait aucune raison de vivre dans le corps du
 * composant de page. Il ne depend que du signalement, de la collaboration
 * courante et de deux fonctions de rafraichissement SWR.
 */
export function useTaches({ incidentId, collaboration, tasksData, mutateTasks }) {
  // La socket des taches sert aussi a emettre vers les autres participants :
  // on garde une reference dessus, pas seulement un abonnement.
  const tasksSocketRef = useRef(null);
  // Declaree avant les etats : l'un d'eux l'appelle pour sa valeur initiale,
  // et un `const` n'existe pas avant sa ligne.
  const getTodayStr = () => {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDeadline, setEditTaskDeadline] = useState('');
  const [editTaskDescription, setEditTaskDescription] = useState('');
  const [editTaskStartDate, setEditTaskStartDate] = useState('');
  const [editTaskSaving, setEditTaskSaving] = useState(false);
  const [taskAlert, setTaskAlert] = useState(null);
  const [taskSubmitSaving, setTaskSubmitSaving] = useState(false);
  const [taskSubmitAlert, setTaskSubmitAlert] = useState(null);
  const [deletingTaskIds, setDeletingTaskIds] = useState([]);
  const [expandedProofTask, setExpandedProofTask] = useState(null);
  const [uploadingProofTask, setUploadingProofTask] = useState(null);
  const [selectedProofFile, setSelectedProofFile] = useState(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState(null);
  const [proofPreviewType, setProofPreviewType] = useState(null);
  const [proofUploadError, setProofUploadError] = useState(null);
  const [proofUploadSuccess, setProofUploadSuccess] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');
  const [draftTasks, setDraftTasks] = useState([]);
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskStartDate, setNewTaskStartDate] = useState(getTodayStr());
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskModalClosing, setTaskModalClosing] = useState(false);
  const [taskModalShowing, setTaskModalShowing] = useState(false);

  const [expandedFailureTask, setExpandedFailureTask] = useState(null);
  const [failureReason, setFailureReason] = useState('');
  const [failureAlert, setFailureAlert] = useState(null);
  const [failureSaving, setFailureSaving] = useState(false);

  const [activeProofPreview, setActiveProofPreview] = useState(null);
  const [expandedCompletedProofs, setExpandedCompletedProofs] = useState([]);

  const [taskToDelete, setTaskToDelete] = useState(null);

  // Temps reel des taches. La connexion, la reconnexion a delai croissant et les
  // codes sur lesquels il ne faut pas insister vivent dans useSocketIncident :
  // ce mecanisme etait ecrit deux fois ici, une par canal, donc corriger un
  // defaut n'en reparait qu'une moitie. Il ne reste que ce que ce canal fait
  // vraiment de ses messages.
  useSocketIncident(incidentId, 'tasks', (event) => {
    try {
      const data = JSON.parse(event.data);

      // Une suppression est appliquee localement sans rappeler le serveur :
      // la tache disparait immediatement de la liste de tous les participants.
      if (data.type === 'task_event' && data.action === 'delete' && data.task_id) {
        const idASupprimer = String(data.task_id);
        mutateTasks((prev) => {
          const liste = Array.isArray(prev) ? prev : (prev?.results || []);
          return Array.isArray(prev)
            ? prev.filter((t) => String(t.id) !== idASupprimer)
            : { ...prev, results: liste.filter((t) => String(t.id) !== idASupprimer) };
        }, { revalidate: false });
        return;
      }

      mutateTasks();
    } catch (err) {
      logger.error('[WS] Erreur parsing message:', err);
      mutateTasks();
    }
  }, { socketRef: tasksSocketRef });

  // Utiliser les tâches de l'API en les formatant pour l'affichage
  const currentTasks = useMemo(() => {
    return (tasksData || []).map(task => {
      const formatted = { ...task };
      if (formatted.state === 'done' || formatted.status === 'completed' || formatted.state === 'completed') formatted.completed = true;
      if (formatted.state === 'failed' || formatted.status === 'failed') formatted.failed = true;

      // Normaliser createdBy pour l'affichage local
      if (!formatted.createdBy) {
        if (formatted.created_by === collaboration?.userId) {
          formatted.createdBy = 'me';
        } else {
          formatted.createdBy = formatted.created_by_organisation;
        }
      }

      // Normaliser assignedTo pour l'affichage local
      if (!formatted.assignedTo) {
        if (formatted.assigned_to === collaboration?.userId) {
          formatted.assignedTo = 'me';
        } else {
          formatted.assignedTo = formatted.assigned_to_name;
        }
      }
      return formatted;
    });
  }, [tasksData, collaboration]);

  const hasUnresolvedOrFailedTasks = useMemo(() => {
    if (currentTasks.length === 0) return true;
    return currentTasks.some(task => !task.completed || task.failed);
  }, [currentTasks]);

  const toggleCompletedProof = (taskId) => {
    setExpandedCompletedProofs(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const getCalculatedProgress = () => {
    if (!currentTasks.length) return 0;
    const completed = currentTasks.filter(t => t.completed || t.status === 'completed').length;
    return Math.round((completed / currentTasks.length) * 100);
  };

  // Progression telle que le serveur l'a enregistree. Une table locale
  // s'intercalait ici pour retenir une valeur « sauvegardee » cote client, mais
  // rien ne l'alimentait — et c'etait tant mieux : toute mutation de tache
  // relance mutateTasks/mutateCollaboration, donc le serveur reste la seule
  // source de verite. On le lit directement.
  const getSavedProgress = () => collaboration?.progress ?? 0;

  const hasPendingChanges = () => {
    const calculated = getCalculatedProgress();
    const saved = getSavedProgress();
    return calculated !== saved;
  };


  // Marquer une tâche comme terminée via API (avec preuve optionnelle)
  const toggleTask = async (taskId) => {
    const task = currentTasks.find(t => t.id === taskId);
    if (!task) return;
    try {
      if (task.completed || task.status === 'completed') {
        // Remettre en cours via patch
        await updateTaskService(incidentId, taskId, { status: 'in_progress' });
      } else {
        // Marquer comme complétée (sans preuve)
        const formData = new FormData();
        await completeTaskService(incidentId, taskId, formData);
      }
      await mutateTasks();
    } catch (err) {
      logger.error('[toggleTask] Erreur:', err);
    }
  };

  // Marquer une tâche comme échouée via API
  const markTaskFailed = async (taskId, reason) => {
    setFailureSaving(true);
    setFailureAlert(null);
    try {
      await failTaskService(incidentId, taskId, { failure_reason: reason });
      await mutateTasks();
      setFailureAlert({ type: 'success', message: 'Tâche marquée comme échouée avec succès.' });
      setTimeout(() => {
        setExpandedFailureTask(null);
        setFailureReason('');
        setFailureAlert(null);
      }, 1500);
    } catch (err) {
      logger.error('[markTaskFailed] Erreur:', err);
      let errorMessage = "Erreur lors du marquage de la tâche.";
      if (err.response?.data) {
        if (typeof err.response.data === 'object') {
          errorMessage = Object.entries(err.response.data)
            .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
            .join(' | ');
        } else if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        }
      }
      setFailureAlert({ type: 'danger', message: errorMessage });
    } finally {
      setFailureSaving(false);
    }
  };

  // Remettre une tâche à "en cours" via API
  const resetTaskStatus = async (taskId) => {
    try {
      await updateTaskService(incidentId, taskId, { status: 'in_progress' });
      await mutateTasks();
    } catch (err) {
      logger.error('[resetTaskStatus] Erreur:', err);
    }
  };

  // Uploader une preuve (image/vidéo/document) pour terminer une tâche via API
  const handleProofUpload = async (taskId, file) => {
    setProofUploadError(null);
    setProofUploadSuccess(null);
    try {
      const formData = new FormData();
      if (file.type && file.type.startsWith('video/')) {
        formData.append('proof_video', file);
      } else if (file.type && file.type.startsWith('image/')) {
        formData.append('proof_image', file);
      } else {
        // Pour les documents (PDF, Word, Excel, etc.)
        formData.append('proof_image', file);
      }
      await completeTaskService(incidentId, taskId, formData);
      await mutateTasks();
      setProofUploadSuccess('Preuve téléversée et tâche terminée avec succès !');
      return true;
    } catch (err) {
      logger.error('[handleProofUpload] Erreur:', err);
      let errorMessage = "Erreur lors de l'envoi de la preuve.";
      if (err.response?.data) {
        if (typeof err.response.data === 'object') {
          errorMessage = Object.entries(err.response.data)
            .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
            .join(' | ');
        } else if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        }
      }
      setProofUploadError(errorMessage);
      throw err;
    }
  };

  // Ouvrir le modal des tâches avec initialisation
  const openTaskModal = () => {
    setShowTaskModal(true);
    setTimeout(() => {
      setTaskModalShowing(true);
    }, 10);
  };

  // Lit et valide la tâche en cours de saisie. Renvoie null (avec une alerte)
  // si les dates ne conviennent pas.
  const tacheDuFormulaire = () => {
    setTaskSubmitAlert(null);

    const todayStr = getTodayStr();

    // Validation 1: Date de début ne peut pas être dans le passé
    if (newTaskStartDate && newTaskStartDate < todayStr) {
      setTaskSubmitAlert({
        type: 'danger',
        message: "La date de début ne peut pas être antérieure à la date d'aujourd'hui."
      });
      return null;
    }

    if (newTaskStartDate && newTaskDeadline) {
      // Validation 2: Date de début ne peut pas être égale à la date de fin
      if (newTaskStartDate === newTaskDeadline) {
        setTaskSubmitAlert({
          type: 'danger',
          message: "La date de début ne peut pas être égale à la date de fin."
        });
        return null;
      }
      // Validation 3: Date de début ne peut pas être supérieure à la date de fin
      if (newTaskStartDate > newTaskDeadline) {
        setTaskSubmitAlert({
          type: 'danger',
          message: "La date de début ne peut pas être supérieure à la date de fin."
        });
        return null;
      }
    }

    return {
      title: newTaskTitle.trim(),
      description: newTaskDescription.trim() || null,
      start_date: newTaskStartDate || null,
      end_date: newTaskDeadline || null,
      assigned_to: null
    };
  };

  // Ajouter une tâche à la liste temporaire (draft)
  const addDraftTask = () => {
    if (!newTaskTitle.trim()) return;
    const task = tacheDuFormulaire();
    if (!task) return;
    setDraftTasks([...draftTasks, task]);
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskStartDate(getTodayStr());
    setNewTaskDeadline('');
  };

  // Créer les tâches de la liste, plus celle en cours de saisie si elle a un
  // titre : « Créer la tâche » fonctionne sans passer par « Ajouter ».
  const submitNewTask = async () => {
    let aCreer = draftTasks;
    if (newTaskTitle.trim()) {
      const enCours = tacheDuFormulaire();
      if (!enCours) return;
      aCreer = [...draftTasks, enCours];
    }
    if (aCreer.length === 0) {
      closeTaskModal();
      return;
    }

    setTaskSubmitSaving(true);
    setTaskSubmitAlert(null);

    try {
      // Créer chaque tâche séquentiellement/en parallèle via l'API
      await Promise.all(
        aCreer.map(task =>
          createTaskService(incidentId, {
            title: task.title,
            description: task.description || null,
            start_date: task.start_date || null,
            end_date: task.end_date || null,
            ...(task.assigned_to && { assigned_to: task.assigned_to })
          })
        )
      );

      await mutateTasks();
      setTaskSubmitAlert({ type: 'success', message: 'Tâche(s) créée(s) et ajoutée(s) avec succès !' });

      // Afficher l'alerte pendant 2 secondes puis refermer le modal
      setTimeout(() => {
        closeTaskModal();
      }, 2000);
    } catch (err) {
      logger.error('[submitNewTask] Erreur lors de la création:', err);
      let errorMessage = 'Une erreur est survenue lors de la création des tâches.';
      if (err.response?.data) {
        if (typeof err.response.data === 'object') {
          errorMessage = Object.entries(err.response.data)
            .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
            .join(' | ');
        } else if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        }
      }
      setTaskSubmitAlert({ type: 'danger', message: errorMessage });
      setTaskSubmitSaving(false); // Réactive le bouton et cache le loader
    }
  };

  const notifyTaskChange = (action, taskId) => {

    if (!tasksSocketRef.current) {
      logger.warn('[WS] tasksSocketRef.current est null');
      return;
    }


    if (tasksSocketRef.current.readyState === WebSocket.OPEN) {
      try {
        const message = { type: 'task_event', action, task_id: taskId };
        tasksSocketRef.current.send(JSON.stringify(message));
      } catch (e) {
        logger.error('[WS] Erreur lors de l\'envoi du message:', e);
      }
    } else {
      logger.warn('[WS] Socket non ouvert, impossible d\'envoyer le message');
    }
  };

  // Supprimer une tâche via API
  const deleteTask = async (taskId) => {
    setDeletingTaskIds(prev => [...prev, taskId]);

    // Mise à jour optimiste locale instantanée
    mutateTasks(prev => {
      const list = Array.isArray(prev) ? prev : (prev?.results || []);
      return Array.isArray(prev)
        ? prev.filter(t => t.id !== taskId)
        : { ...prev, results: list.filter(t => t.id !== taskId) };
    }, { revalidate: false });

    try {
      await deleteTaskService(incidentId, taskId);
      notifyTaskChange('delete', taskId);
    } catch (err) {
      logger.error('[deleteTask] Erreur:', err);
      await mutateTasks(); // Restaurer/Recharger la liste en cas d'erreur
    } finally {
      setDeletingTaskIds(prev => prev.filter(id => id !== taskId));
    }
  };

  // Modifier une tâche via API
  const startEditTask = (task) => {
    setTaskAlert(null); // Reset alert
    setEditingTaskId(task.id);
    setEditTaskTitle(task.title);
    setEditTaskDescription(task.description || '');
    setEditTaskStartDate(task.start_date || '');
    setEditTaskDeadline(task.end_date || task.deadline || '');
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditTaskTitle('');
    setEditTaskDescription('');
    setEditTaskStartDate('');
    setEditTaskDeadline('');
    setTaskAlert(null);
  };

  const saveEditTask = async (taskId) => {
    if (!editTaskTitle.trim()) return;
    setTaskAlert(null);

    const todayStr = getTodayStr();

    // Validation 1: Date de début ne peut pas être dans le passé
    if (editTaskStartDate && editTaskStartDate < todayStr) {
      setTaskAlert({
        type: 'danger',
        message: "La date de début ne peut pas être antérieure à la date d'aujourd'hui."
      });
      return;
    }

    if (editTaskStartDate && editTaskDeadline) {
      // Validation 2: Date de début ne peut pas être égale à la date de fin
      if (editTaskStartDate === editTaskDeadline) {
        setTaskAlert({
          type: 'danger',
          message: "La date de début ne peut pas être égale à la date de fin."
        });
        return;
      }
      // Validation 3: Date de début ne peut pas être supérieure à la date de fin
      if (editTaskStartDate > editTaskDeadline) {
        setTaskAlert({
          type: 'danger',
          message: "La date de début ne peut pas être supérieure à la date de fin."
        });
        return;
      }
    }

    setEditTaskSaving(true);
    try {
      await updateTaskService(incidentId, taskId, {
        title: editTaskTitle.trim(),
        description: editTaskDescription.trim() || null,
        start_date: editTaskStartDate || null,
        end_date: editTaskDeadline || null,
        status: 'in_progress'
      });
      await mutateTasks();
      setTaskAlert({ type: 'success', message: 'Tâche modifiée avec succès !' });
      setTimeout(() => {
        cancelEditTask();
      }, 1500);
    } catch (err) {
      logger.error('[saveEditTask] Erreur:', err);
      let errorMessage = 'Une erreur est survenue lors de la modification de la tâche.';
      if (err.response?.data) {
        if (typeof err.response.data === 'object') {
          errorMessage = Object.entries(err.response.data)
            .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
            .join(' | ');
        } else if (typeof err.response.data === 'string') {
          errorMessage = err.response.data;
        }
      }
      setTaskAlert({ type: 'danger', message: errorMessage });
    } finally {
      setEditTaskSaving(false);
    }
  };

  const closeTaskModal = () => {
    setTaskModalShowing(false);
    setTaskModalClosing(true);
    setTimeout(() => {
      setShowTaskModal(false);
      setTaskModalClosing(false);
      setDraftTasks([]);
      setNewTaskTitle('');
      setNewTaskDescription('');
      setNewTaskStartDate(getTodayStr());
      setNewTaskDeadline('');
      setTaskSubmitAlert(null);
      setTaskSubmitSaving(false);
    }, 300);
  };

  return {
    currentTasks, hasUnresolvedOrFailedTasks,
    getCalculatedProgress, getSavedProgress, hasPendingChanges,
    toggleTask, markTaskFailed, resetTaskStatus, deleteTask, notifyTaskChange,
    taskToDelete, setTaskToDelete, deletingTaskIds, taskAlert,
    expandedFailureTask, setExpandedFailureTask,
    failureReason, setFailureReason, failureAlert, setFailureAlert, failureSaving,
    handleProofUpload, expandedProofTask, setExpandedProofTask,
    uploadingProofTask, setUploadingProofTask,
    selectedProofFile, setSelectedProofFile,
    proofPreviewUrl, setProofPreviewUrl, proofPreviewType, setProofPreviewType,
    proofUploadError, setProofUploadError, proofUploadSuccess, setProofUploadSuccess,
    activeProofPreview, setActiveProofPreview,
    expandedCompletedProofs, toggleCompletedProof,
    showTaskModal, setShowTaskModal, taskModalClosing, setTaskModalClosing,
    taskModalShowing, openTaskModal, closeTaskModal,
    draftTasks, setDraftTasks,
    newTaskTitle, setNewTaskTitle, newTaskDescription, setNewTaskDescription,
    newTaskStartDate, setNewTaskStartDate, newTaskDeadline, setNewTaskDeadline,
    addDraftTask, submitNewTask, taskSubmitSaving, taskSubmitAlert, setTaskSubmitAlert,
    editingTaskId, setEditingTaskId,
    editTaskTitle, setEditTaskTitle, editTaskDescription, setEditTaskDescription,
    editTaskStartDate, setEditTaskStartDate, editTaskDeadline, setEditTaskDeadline,
    editTaskSaving, startEditTask, cancelEditTask, saveEditTask,
    getTodayStr,
  };
}
