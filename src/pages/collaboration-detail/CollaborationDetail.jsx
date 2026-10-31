import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import useSWR from 'swr';
import { ShimmerThumbnail, ShimmerTitle, ShimmerText } from 'react-shimmer-effects';
import { useSidebarState } from '../../hooks/useSidebarState';
import { Header, Sidebar } from '../../components/layout';
import { CollaborationDetailProvider } from './context/CollaborationDetailContext';
import { useDiscussion } from './useDiscussion';
import { useTaches } from './useTaches';
import { useSuggestionsOrganisations } from './useSuggestionsOrganisations';
import { useClotureIncident } from './useClotureIncident';
import { TaskModal } from './modal/TaskModal';
import { SuggestOrgModal } from './modal/SuggestOrgModal';
import { DeleteTaskModal } from './modal/DeleteTaskModal';
import { AgentReportsModal } from './modal/AgentReportsModal';
import { NotFound } from '../not-found';
import { getCollaborationService } from '../collaboration/service/collaboration_service';
import { getTasksService, deleteTaskService } from '../incident/service/task_service';
import { CloseCircle, Danger } from 'iconsax-react';
import { ImageViewer } from '../../components/molecules/ImageViewer';
import { VueCollaboration } from './VueCollaboration';
import { EditTaskModal } from './modal/EditTaskModal';
import { ResolveModal } from './modal/ResolveModal';
import { aujourdhui, bornesTaches } from './modal/dates';
import { useEstTelephone } from '../incident/mobile/useEstTelephone';
import './collaboration-detail.css';
import './modal/modales.css';


/* Coquille commune : barre latérale, en-tête fixe, zone qui défile. */
const Coquille = ({ children }) => {
  const estTelephone = useEstTelephone();
  const {
    isOpen: sidebarOpen,
    setOpen: setSidebarOpen,
    isCollapsed: sidebarCollapsed,
    setCollapsed: setSidebarCollapsed,
  } = useSidebarState();

  return (
    <div className="vc-shell">
      {/* Sur téléphone, l'écran est poussé : ni en-tête ni barre d'onglets. */}
      {!estTelephone && (
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
      )}
      <div className={`vc-shell-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {!estTelephone && <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} sidebarCollapsed={sidebarCollapsed} />}
        <div className="vc-scroll">{children}</div>
      </div>
    </div>
  );
};

const Squelette = () => (window.matchMedia?.('(max-width: 640px)').matches ? (
  <div className="vd vc" aria-busy="true" aria-label="Chargement de la collaboration">
    <ShimmerThumbnail height={300} className="m-0" />
    <div style={{ padding: 16 }}><ShimmerTitle line={1} gap={8} /><ShimmerText line={4} gap={10} /></div>
  </div>
) : (
  <div className="vd vc" aria-busy="true" aria-label="Chargement de la collaboration">
    <div style={{ width: 220 }}><ShimmerText line={1} gap={0} /></div>
    <div style={{ maxWidth: 560 }}><ShimmerTitle line={1} gap={8} /><ShimmerText line={1} gap={8} /></div>
    <section className="vd-hero vc-hero">
      <div className="vd-card vd-decide"><ShimmerTitle line={1} gap={8} /><ShimmerThumbnail height={10} rounded /><ShimmerText line={3} gap={10} /></div>
      <div className="vd-card vd-media"><ShimmerThumbnail height={240} rounded /></div>
    </section>
    <div className="vc-work">
      <div className="vc-work-main"><div className="vd-card vd-pad"><ShimmerTitle line={1} gap={8} /><ShimmerText line={6} gap={12} /></div></div>
      <aside className="vc-work-side"><div className="vd-card vd-pad"><ShimmerTitle line={1} gap={8} /><ShimmerText line={8} gap={12} /></div></aside>
    </div>
  </div>
));


export const CollaborationDetail = () => {

  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Utiliser useSWR pour charger la collaboration depuis l'API
  const { data: collaborationData, error: collaborationError, isLoading, mutate: mutateCollaboration } = useSWR(
    id ? `collaboration-${id}` : null,
    () => getCollaborationService(id),
    {
      revalidateOnFocus: false
    }
  );

  // Récupérer l'incidentId depuis la collaboration
  const incidentId = collaborationData?.incident;

  // Toute la discussion — chargement pagine, temps reel, redaction, pieces
  // jointes, enregistrement vocal, edition — vit dans son propre hook. Elle ne
  // consomme rien d'autre de cette page que l'identifiant ci-dessus.
  const discussion = useDiscussion(incidentId);
  const isIncidentResolved = collaborationData?.incident_details?.etat === 'resolved';

  // Utiliser useSWR pour charger les tâches de l'incident (sans polling, géré par WebSockets)
  const { data: tasksData, isLoading: tasksLoading, mutate: mutateTasks } = useSWR(
    incidentId ? `tasks-${incidentId}` : null,
    () => getTasksService(incidentId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true
    }
  );

  /**
   * Image ouverte en plein écran, ou null. { src, alt }
   *
   * Une photo d'incident se lit souvent sur un téléphone, en plein soleil :
   * le détail qui compte (une fissure, une plaque, un niveau d'eau) est
   * invisible dans une vignette. La visionneuse partagée gère le pincement,
   * le glissé et la molette — on la réutilise plutôt que d'ouvrir une
   * seconde fois une image simplement plus grande.
   */
  const [imageAZoomer, setImageAZoomer] = useState(null);

  const [toast, setToast] = useState(null);
  const afficherToast = (texte) => setToast({ texte, n: Date.now() });

  // Mapper les données API vers le format attendu par le composant
  //
  // Memoise : cet objet est une dependance de currentTasks juste en dessous.
  // Recree a chaque rendu, il rendait ce useMemo — et toute la chaine qui en
  // decoule — parfaitement inutile.
  const collaboration = useMemo(() => (collaborationData ? {
    id: collaborationData.id,
    userRole: collaborationData.role,
    title: collaborationData.incident_details?.title || collaborationData.incident_title || `Incident #${collaborationData.incident}`,
    incidentId: collaborationData.incident,
    userId: collaborationData.user,
    status: collaborationData.status,
    createdAt: collaborationData.created_at,
    motivation: collaborationData.motivation,
    endDate: collaborationData.end_date
      ? new Date(collaborationData.end_date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
      : 'En cours',
    otherOption: collaborationData.other_option,
    image: collaborationData.incident_photo || collaborationData.incident_thumbnail || collaborationData.photo || collaborationData.thumbnail || collaborationData.incident_details?.photo || '',
    organisation: collaborationData.organisation_name || ``,
    role: collaborationData.role,
    joinedAt: new Date(collaborationData.created_at).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }),
    startDate: new Date(collaborationData.created_at).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }),
    location: collaborationData.incident_details?.zone || collaborationData.incident_zone || 'À définir',
    description: collaborationData.incident_description || collaborationData.incident_details?.description || collaborationData.motivation || 'Aucune description',
    progress: collaborationData.incident_progress || collaborationData.incident_details?.progress || 0,
    tasks: [],
    // Informations additionnelles retournées par l'API
    userFullName: collaborationData.user_full_name,
    userEmail: collaborationData.user_email,
    organisationId: collaborationData.organisation_id,
    incidentDetails: collaborationData.incident_details,
    predictionDetails: collaborationData.prediction_details
  } : null), [collaborationData]);

  // Les taches — liste temps reel, avancement, preuves, creation, edition —
  // vivent dans leur propre hook, pour la meme raison que la discussion.
  const taches = useTaches({ incidentId, collaboration, tasksData, mutateTasks });
  const {
    currentTasks, hasUnresolvedOrFailedTasks,
    getCalculatedProgress, getSavedProgress, hasPendingChanges,
    deleteTask, notifyTaskChange, resetTaskStatus,
    taskToDelete, setTaskToDelete, deletingTaskIds, taskAlert,
    activeProofPreview, setActiveProofPreview,
    showTaskModal, setShowTaskModal, taskModalClosing, setTaskModalClosing,
    taskModalShowing, openTaskModal, closeTaskModal,
    draftTasks, setDraftTasks,
    newTaskTitle, setNewTaskTitle, newTaskDescription, setNewTaskDescription,
    newTaskStartDate, setNewTaskStartDate, newTaskDeadline, setNewTaskDeadline,
    addDraftTask, submitNewTask, taskSubmitSaving, taskSubmitAlert,
    editingTaskId, setEditingTaskId,
    editTaskTitle, setEditTaskTitle, editTaskDescription, setEditTaskDescription,
    editTaskStartDate, setEditTaskStartDate, editTaskDeadline, setEditTaskDeadline,
    editTaskSaving, startEditTask, cancelEditTask, saveEditTask,
  } = taches;

  // Suggerer des organisations partenaires, et cloturer le signalement : deux
  // parcours complets, chacun avec ses etats de modale, ses champs et son envoi.
  const {
    showSuggestModal, setShowSuggestModal,
    showReportsModal, setShowReportsModal,
    suggestModalClosing,
    suggestModalShowing, setSuggestModalShowing,
    closeSuggestModal,
    suggestSearch, setSuggestSearch,
    suggestedOrgs, toggleSuggestedOrg, updateSuggestedRole, updateSuggestedComment,
    suggestAlert, setSuggestAlert,
    suggestSubmitting, handleSuggestSubmit,
    AVAILABLE_ORGS,
    ROLE_OPTIONS,
  } = useSuggestionsOrganisations(collaboration);

  const {
    showCloseModal,
    openCloseModal, closeCloseModal, handleCloseIncident,
    resolutionStartDate, setResolutionStartDate,
    resolutionEndDate, setResolutionEndDate,
    resolutionFile, setResolutionFile,
    closeAlert,
    isClosing,
  } = useClotureIncident(collaboration, mutateCollaboration);

  // Ces deux effets lisent des valeurs fournies par les hooks ci-dessus, ils
  // doivent donc etre declares APRES eux. Leurs tableaux de dependances sont
  // evalues pendant le rendu : places plus haut, ils lisaient des `const` qui
  // n'existaient pas encore, et la page entiere refusait de se rendre.
  // Bloquer le scroll du body quand un modal est ouvert
  useEffect(() => {
    if (showTaskModal || showSuggestModal || showCloseModal || taskToDelete !== null || showReportsModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showTaskModal, showSuggestModal, showCloseModal, taskToDelete, showReportsModal]);

  // La visionneuse vidéo des preuves se ferme aussi à Échap.
  useEffect(() => {
    if (!activeProofPreview) return undefined;
    const echap = (e) => { if (e.key === 'Escape') setActiveProofPreview(null); };
    document.addEventListener('keydown', echap);
    return () => document.removeEventListener('keydown', echap);
  }, [activeProofPreview, setActiveProofPreview]);


  // Gestion des états de chargement et d'erreur
  if (isLoading) {
    return <Coquille><Squelette /></Coquille>;
  }

  if (collaborationError) {
    return (
      <Coquille>
        <div className="vd vc">
          <div className="vd-card vd-empty vc-error">
            <span className="vd-empty-ic vc-error-ic"><Danger size={24} variant="Bold" color="currentColor" /></span>
            <b>Impossible de charger la collaboration</b>
            <p>Vérifiez votre connexion, puis réessayez. Si le problème persiste, revenez à la liste des collaborations.</p>
            <div className="vc-error-actions">
              <button type="button" className="vd-btn vd-btn-g" onClick={() => navigate('/collaboration')}>Retour aux collaborations</button>
              <button type="button" className="vd-btn vd-btn-p" onClick={() => mutateCollaboration()}>Réessayer</button>
            </div>
          </div>
        </div>
      </Coquille>
    );
  }

  if (!collaboration) {
    return (
      <NotFound
        message="Désolé, la collaboration demandée n'existe pas ou vous n'avez pas l'autorisation d'y accéder."
      />
    );
  }

  const contextValue = {
    collaboration,
    showSuggestModal,
    suggestModalClosing,
    suggestModalShowing,
    closeSuggestModal,
    suggestSearch,
    setSuggestSearch,
    suggestedOrgs,
    toggleSuggestedOrg,
    updateSuggestedRole,
    updateSuggestedComment,
    suggestAlert,
    setSuggestAlert,
    suggestSubmitting,
    handleSuggestSubmit,
    ROLE_OPTIONS,
    AVAILABLE_ORGS,
    showTaskModal,
    setShowTaskModal,
    taskModalClosing,
    setTaskModalClosing,
    taskModalShowing,
    closeTaskModal,
    openTaskModal,
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
    currentTasks,
    editingTaskId,
    setEditingTaskId,
    editTaskTitle,
    setEditTaskTitle,
    editTaskDescription,
    setEditTaskDescription,
    editTaskStartDate,
    setEditTaskStartDate,
    editTaskDeadline,
    setEditTaskDeadline,
    editTaskSaving,
    taskAlert,
    taskSubmitSaving,
    taskSubmitAlert,
    deletingTaskIds,
    startEditTask,
    cancelEditTask,
    saveEditTask,
    deleteTask,
    taskToDelete,
    setTaskToDelete
  };

  const nbOrganisations = (collaboration.incidentDetails?.acting_organisations || []).length;
  const nbFaites = currentTasks.filter((t) => t.completed).length;
  const nbPreuves = currentTasks.filter((t) => t.proof_image || t.proof_video || t.proof).length;
  const conditionsResolution = [
    { texte: 'Toutes les tâches sont terminées', valeur: `${nbFaites} / ${currentTasks.length}` },
    { texte: 'Aucune tâche en échec', valeur: '0' },
    { texte: 'Preuves de réalisation déposées', valeur: String(nbPreuves) },
  ];

  // La période de résolution part des tâches : la première commencée, la
  // dernière terminée. Sans cela il fallait la retrouver à la main.
  const ouvrirResolution = () => {
    openCloseModal();
    const { debut, fin } = bornesTaches(currentTasks);
    const today = aujourdhui();
    setResolutionStartDate(debut && debut <= today ? debut : '');
    setResolutionEndDate(fin ? (fin > today ? today : fin) : today);
  };

  // Ce que la suppression change, dit avant de confirmer.
  const impactSuppression = (() => {
    if (!taskToDelete) return '';
    const restantes = currentTasks.filter((t) => t.id !== taskToDelete.id);
    const apres = restantes.length ? Math.round((restantes.filter((t) => t.completed).length / restantes.length) * 100) : 0;
    const avant = getCalculatedProgress();
    const qui = nbOrganisations > 1 ? `les ${nbOrganisations} organisations` : 'toutes les organisations';
    const quoi = taskToDelete.failed ? "La tâche et sa raison d'échec disparaissent" : 'La tâche et ses preuves disparaissent';
    return `${quoi} pour ${qui}.${avant !== apres ? ` L'avancement passe de ${avant} % à ${apres} %.` : ''}`;
  })();

  const nbRestantes = currentTasks.filter((t) => !t.completed && !t.failed).length;
  const nbEchouees = currentTasks.filter((t) => t.failed).length;
  const raisonBlocage = currentTasks.length === 0
    ? 'Créez au moins une tâche avant de résoudre le signalement.'
    : nbEchouees > 0
      ? `${nbEchouees} tâche${nbEchouees > 1 ? 's ont' : ' a'} échoué : remettez-la${nbEchouees > 1 ? 's' : ''} en cours ou supprimez-la${nbEchouees > 1 ? 's' : ''}.`
      : `Encore ${nbRestantes} tâche${nbRestantes > 1 ? 's' : ''} à terminer.`;

  return (
    <CollaborationDetailProvider value={contextValue}>
      <Coquille>
        <VueCollaboration
          collaboration={collaboration}
          onBack={() => navigate(location.state?.from || '/collaboration')}
          lectureSeule={isIncidentResolved}
          progression={getCalculatedProgress()}
          progressionSauvee={getSavedProgress()}
          modificationsEnAttente={hasPendingChanges()}
          taches={taches}
          tachesChargement={tasksLoading}
          peutResoudre={!hasUnresolvedOrFailedTasks}
          raisonBlocage={raisonBlocage}
          onResoudre={ouvrirResolution}
          onCreerTache={openTaskModal}
          onSuggerer={() => {
            setShowSuggestModal(true);
            setTimeout(() => setSuggestModalShowing(true), 10);
          }}
          onRapports={() => setShowReportsModal(true)}
          discussion={discussion}
          onZoomImage={setImageAZoomer}
          onToast={afficherToast}
        />
      </Coquille>
      {toast && <div key={toast.n} className="vd-toast" role="status">{toast.texte}</div>}

      {/* Modal de gestion des tâches externalisé et réutilisable */}
      <TaskModal key={"gestion des taches-1"} />

      {/* Inviter ou suggérer des organisations : la clé remet la fenêtre à
          zéro (recherche, erreurs affichées) à chaque ouverture. */}
      <SuggestOrgModal key={showSuggestModal ? 'suggestion-ouverte' : 'suggestion-fermee'} />

      {/* Modification d'une tâche */}
      <EditTaskModal onToast={afficherToast} />

      {/* Confirmation de suppression d'une tâche */}
      <DeleteTaskModal
        isOpen={taskToDelete !== null}
        onClose={() => setTaskToDelete(null)}
        taskTitle={taskToDelete?.title || ''}
        impact={impactSuppression}
        onRemettre={taskToDelete?.failed ? () => resetTaskStatus(taskToDelete.id) : undefined}
        onConfirm={async () => {
          const taskId = taskToDelete?.id;
          if (!taskId) return;
          // Mise à jour optimiste : la tâche disparaît tout de suite de la liste.
          mutateTasks(prev => {
            const list = Array.isArray(prev) ? prev : (prev?.results || []);
            return Array.isArray(prev)
              ? prev.filter(t => t.id !== taskId)
              : { ...prev, results: list.filter(t => t.id !== taskId) };
          }, { revalidate: false });

          try {
            await deleteTaskService(collaborationData?.incident, taskId);
            notifyTaskChange('delete', taskId);
          } catch (err) {
            await mutateTasks(); // La tâche réapparaît, et la fenêtre affiche l'erreur
            throw err;
          }
        }}
      />

      {/* Lecture d'une vidéo de preuve — les photos passent par la
          visionneuse, qui sait zoomer. */}
      {activeProofPreview && (
        <div className="vd-lightbox" role="dialog" aria-modal="true" aria-label="Preuve de réalisation" onClick={() => setActiveProofPreview(null)}>
          <figure onClick={(e) => e.stopPropagation()}>
            <video src={activeProofPreview.url} controls autoPlay className="vc-lightbox-video" />
            <figcaption>Preuve de réalisation</figcaption>
            <button type="button" className="vd-lightbox-x" onClick={() => setActiveProofPreview(null)} aria-label="Fermer">
              <CloseCircle size={22} variant="Bold" color="currentColor" />
            </button>
          </figure>
        </div>
      )}

      {/* Visionneuse plein écran : zoom molette, pincement tactile,
          glissé, Échap pour fermer. */}
      {imageAZoomer && (
        <ImageViewer
          src={imageAZoomer.src}
          alt={imageAZoomer.alt}
          onClose={() => setImageAZoomer(null)}
        />
      )}

      {/* Résolution du signalement */}
      {showCloseModal && (
        <ResolveModal
          titre={collaboration.title}
          conditions={conditionsResolution}
          nbOrganisations={nbOrganisations}
          onClose={closeCloseModal}
          onResoudre={handleCloseIncident}
          enCours={isClosing}
          alerte={closeAlert}
          debut={resolutionStartDate}
          setDebut={setResolutionStartDate}
          fin={resolutionEndDate}
          setFin={setResolutionEndDate}
          fichier={resolutionFile}
          setFichier={setResolutionFile}
        />
      )}
      <AgentReportsModal
        isOpen={showReportsModal}
        onClose={() => setShowReportsModal(false)}
        incidentId={collaboration?.incidentId}
        incidentTitle={collaboration?.title}
        latitude={collaboration?.predictionDetails?.latitude || collaboration?.incidentDetails?.lattitude}
        longitude={collaboration?.predictionDetails?.longitude || collaboration?.incidentDetails?.longitude}
      />
    </CollaborationDetailProvider>
  );
};
