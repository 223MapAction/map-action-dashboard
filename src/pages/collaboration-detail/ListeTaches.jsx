import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ShimmerTitle, ShimmerText } from 'react-shimmer-effects';
import {
  TickCircle, Danger, Add, Trash, Edit2, Calendar, DocumentUpload, Play, ArrowDown2, TaskSquare, CloseCircle, RefreshLeftSquare,
} from 'iconsax-react';
import { BlurryImage } from '../../components/atoms/BlurryImage';
import { formatFailureReason, formatDateTime } from './formatage';
import { logger } from '../../utils/logger';
import { OffcanvasModal } from '../../components/molecules/OffcanvasModal';
import { useEstTelephone } from '../incident/mobile/useEstTelephone';
import { FeuilleActions } from '../incident/mobile/FeuilleActions';
import '../incident/mobile/mobile.css';

/* --------------------------------------------------------------------------
 * Liste des tâches de la collaboration
 *
 * Purement présentationnel : l'état vient de useTaches, transmis tel quel.
 * ------------------------------------------------------------------------ */

const EXT_IMAGE = /\.(jpg|jpeg|png|gif|bmp|webp|svg|tiff|heic|heif)$/;
const EXT_VIDEO = /\.(mp4|avi|mov|wmv|flv|webm|mkv)$/;

const Spin = ({ size = 14 }) => <span className="vc-spin" style={{ width: size, height: size }} aria-hidden="true" />;

const dateCourte = (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

// Une preuve arrive sous trois formes selon l'ancienneté de la tâche :
// proof_image / proof_video (API actuelle), ou un objet proof { type, url }.
const lirePreuve = (task) => {
  const url = task.proof_video || task.proof_image || task.proof?.url || (typeof task.proof === 'string' ? task.proof : '');
  if (!url) return null;
  const chemin = url.split('?')[0].toLowerCase();
  if (task.proof_video || task.proof?.type === 'video' || EXT_VIDEO.test(chemin)) return { type: 'video', url };
  if (EXT_IMAGE.test(chemin) || task.proof?.type === 'image') return { type: 'image', url };
  return { type: 'document', url, nom: decodeURIComponent(chemin.split('/').pop() || 'Document de preuve') };
};

const Preuve = ({ preuve, onZoomImage, onVideo }) => {
  if (preuve.type === 'image') {
    return (
      <button type="button" className="vc-proof vc-proof-img" onClick={() => onZoomImage({ src: preuve.url, alt: 'Preuve de réalisation' })} aria-label="Agrandir la photo de preuve">
        <BlurryImage src={preuve.url} alt="Preuve" />
        <span className="vd-zoom">Agrandir</span>
      </button>
    );
  }
  if (preuve.type === 'video') {
    return (
      <button type="button" className="vc-proof vc-proof-img" onClick={() => onVideo({ type: 'video', url: preuve.url })} aria-label="Lire la vidéo de preuve">
        <video src={preuve.url} preload="metadata" muted />
        <span className="vc-proof-play"><Play size={18} variant="Bold" color="currentColor" /></span>
      </button>
    );
  }
  return (
    <a className="vc-proof vc-proof-doc" href={preuve.url} target="_blank" rel="noopener noreferrer" download>
      <DocumentUpload size={22} variant="Bold" color="currentColor" />
      <span><b>{preuve.nom}</b><small>Ouvrir ou télécharger</small></span>
    </a>
  );
};

// Rendue dans body : les animations de la liste créent un contexte d'empilement
// qui laisserait la feuille sous la barre d'action.
const FeuilleHaute = (props) => createPortal(
  <OffcanvasModal className="feuille-haute" closeVariant="plain" {...props} />,
  document.body,
);

export const ListeTaches = ({ taches, chargement, lectureSeule, onCreer, onZoomImage }) => {
  const estTelephone = useEstTelephone();
  const [menuTache, setMenuTache] = useState(null);
  const {
    currentTasks, toggleTask, markTaskFailed, resetTaskStatus, startEditTask,
    setTaskToDelete, deletingTaskIds,
    expandedFailureTask, setExpandedFailureTask,
    failureReason, setFailureReason, failureAlert, setFailureAlert, failureSaving,
    handleProofUpload, expandedProofTask, setExpandedProofTask,
    uploadingProofTask, setUploadingProofTask,
    selectedProofFile, setSelectedProofFile,
    proofPreviewUrl, setProofPreviewUrl, proofPreviewType, setProofPreviewType,
    proofUploadError, setProofUploadError, proofUploadSuccess, setProofUploadSuccess,
    setActiveProofPreview,
    expandedCompletedProofs, toggleCompletedProof,
  } = taches;

  const viderFichier = () => {
    setSelectedProofFile(null);
    setProofPreviewUrl(null);
    setProofPreviewType(null);
  };

  const fermerPreuve = () => {
    setExpandedProofTask(null);
    viderFichier();
    setProofUploadError(null);
    setProofUploadSuccess(null);
  };

  const ouvrirPreuve = (id) => {
    setExpandedProofTask((prev) => (prev === id ? null : id));
    setExpandedFailureTask(null);
    setFailureReason('');
  };

  const basculerEchec = (id) => {
    setFailureReason('');
    if (expandedFailureTask === id) {
      setExpandedFailureTask(null);
      return;
    }
    setExpandedFailureTask(id);
    fermerPreuve();
  };

  const choisirFichier = (e) => {
    const fichier = e.target.files[0];
    if (!fichier) return;
    setSelectedProofFile(fichier);
    if (fichier.type.startsWith('image/')) {
      setProofPreviewUrl(URL.createObjectURL(fichier));
      setProofPreviewType('image');
    } else if (fichier.type.startsWith('video/')) {
      setProofPreviewUrl(URL.createObjectURL(fichier));
      setProofPreviewType('video');
    } else {
      setProofPreviewUrl(null);
      setProofPreviewType('document');
    }
    setProofUploadError(null);
    setProofUploadSuccess(null);
  };

  const envoyerPreuve = async (id) => {
    setUploadingProofTask(id);
    try {
      const ok = await handleProofUpload(id, selectedProofFile);
      if (ok) {
        setTimeout(() => {
          setExpandedProofTask(null);
          viderFichier();
          setProofUploadSuccess(null);
        }, 1500);
      }
    } catch (err) {
      logger.error(err);
    } finally {
      setUploadingProofTask(null);
    }
  };

  const actionsTache = (task) => {
    const active = !task.completed && !task.failed;
    return [
      active && task.createdBy === 'me' && { id: 'modifier', label: 'Modifier', onSelect: () => startEditTask(task) },
      active && { id: 'echec', label: 'Signaler un échec', onSelect: () => basculerEchec(task.id) },
      task.failed && { id: 'remettre', label: 'Remettre en cours', onSelect: () => resetTaskStatus(task.id) },
      { id: 'supprimer', label: 'Supprimer', tone: 'danger', onSelect: () => setTaskToDelete(task) },
    ].filter(Boolean);
  };

  if (chargement) {
    return (
      <div className="vc-tasks">
        {[0, 1, 2].map((n) => (
          <div key={n} className="vc-task"><div style={{ flex: 1 }}><ShimmerTitle line={1} gap={8} /><ShimmerText line={1} gap={8} /></div></div>
        ))}
      </div>
    );
  }

  if (currentTasks.length === 0) {
    return (
      <div className="vd-empty">
        <span className="vd-empty-ic vc-empty-ic"><TaskSquare size={24} variant="Bold" color="currentColor" /></span>
        <b>Aucune tâche pour le moment</b>
        <p>Découpez l'intervention en tâches : chaque tâche terminée fait avancer la progression de la collaboration.</p>
        {!lectureSeule && (
          <button type="button" className="vd-btn vd-btn-p vd-btn-s vd-mt8" onClick={onCreer}>
            <Add size={15} color="currentColor" />Créer la première tâche
          </button>
        )}
      </div>
    );
  }

  return (
    <ul className="vc-tasks">
      {currentTasks.map((task) => {
        const active = !task.completed && !task.failed && !lectureSeule;
        const enSuppression = deletingTaskIds.includes(task.id);
        const enEnvoi = uploadingProofTask === task.id;
        const preuve = task.completed ? lirePreuve(task) : null;
        const preuveOuverte = expandedCompletedProofs.includes(task.id);
        const raison = task.failure_reason || task.failureReason;

        return (
          <li key={task.id} className={`vc-task ${task.completed ? 'is-done' : ''} ${task.failed ? 'is-failed' : ''}`}>
            <div className="vc-task-row">
              <button
                type="button"
                className="vc-check"
                role="checkbox"
                aria-checked={task.completed}
                aria-label={task.completed ? `Rouvrir : ${task.title}` : `Terminer : ${task.title}`}
                disabled={task.failed || lectureSeule}
                onClick={() => (task.completed ? toggleTask(task.id) : ouvrirPreuve(task.id))}
              >
                {task.failed ? <CloseCircle size={20} variant="Bold" color="currentColor" /> : <TickCircle size={20} variant="Bold" color="currentColor" />}
              </button>

              <div
                className={`vc-task-body ${active ? 'is-clickable' : ''}`}
                onClick={() => active && ouvrirPreuve(task.id)}
              >
                <b className="vc-task-title">{task.title}</b>
                {task.description && <p className="vc-task-desc">{task.description}</p>}
                <div className="vc-task-meta">
                  <span className={task.createdBy === 'me' ? 'is-me' : ''}>{task.createdBy === 'me' ? 'Par vous' : task.createdBy}</span>
                  {(task.start_date || task.end_date) && (
                    <span>
                      <Calendar size={12} color="currentColor" />
                      {task.start_date && dateCourte(task.start_date)}
                      {task.start_date && task.end_date && ' → '}
                      {task.end_date && dateCourte(task.end_date)}
                    </span>
                  )}
                  {task.completed && (task.completedAt || task.updated_at) && (
                    <span className="is-ok">Faite le {formatDateTime(task.completedAt || task.updated_at)}</span>
                  )}
                  {task.failed && task.updated_at && (
                    <span className="is-ko">Échouée le {formatDateTime(task.updated_at)}</span>
                  )}
                </div>
              </div>

              {!lectureSeule && estTelephone && (
                <button type="button" className="vcm-plus" onClick={() => setMenuTache(task)} disabled={enSuppression} aria-label={`Actions sur : ${task.title}`}>
                  {enSuppression ? <Spin size={13} /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="18.5" cy="12" r="1.7" /></svg>}
                </button>
              )}
              {!lectureSeule && !estTelephone && (
                <div className="vc-task-tools">
                  {active && task.createdBy === 'me' && (
                    <button type="button" className="vc-ico" onClick={() => startEditTask(task)} aria-label={`Modifier : ${task.title}`} title="Modifier">
                      <Edit2 size={16} color="currentColor" />
                    </button>
                  )}
                  {active && (
                    <button type="button" className={`vc-ico vc-ico-warn ${expandedFailureTask === task.id ? 'is-on' : ''}`} onClick={() => basculerEchec(task.id)} aria-label="Signaler un échec" title="Signaler un échec">
                      <Danger size={16} color="currentColor" />
                    </button>
                  )}
                  {task.failed && (
                    <button type="button" className="vc-ico" onClick={() => resetTaskStatus(task.id)} aria-label="Remettre la tâche en cours" title="Remettre en cours">
                      <RefreshLeftSquare size={16} color="currentColor" />
                    </button>
                  )}
                  <button type="button" className="vc-ico vc-ico-danger" onClick={() => setTaskToDelete(task)} disabled={enSuppression} aria-label="Supprimer la tâche" title="Supprimer">
                    {enSuppression ? <Spin size={13} /> : <Trash size={16} color="currentColor" />}
                  </button>
                </div>
              )}
            </div>

            {task.failed && raison && (
              <div className="vc-task-note vc-note-ko">
                <b>Raison de l'échec</b>
                <p>{formatFailureReason(raison)}</p>
              </div>
            )}

            {/* Sur téléphone, les deux formulaires s'ouvrent dans une feuille haute. */}
            {estTelephone && active && expandedFailureTask === task.id && (
              <FeuilleHaute
                title="Signaler un échec"
                subtitle={task.title}
                closeDisabled={failureSaving}
                onClose={() => { setExpandedFailureTask(null); setFailureReason(''); setFailureAlert(null); }}
              >
                <div className="am-offcanvas-body vcm-feuille-corps">
                  {failureAlert && <div className={`vc-alert vc-alert-${failureAlert.type}`} role="alert">{failureAlert.message}</div>}
                  <label className="vcm-champ">
                    Pourquoi cette tâche n'a-t-elle pas pu être réalisée ?
                    <textarea
                      rows={4}
                      value={failureReason}
                      onChange={(e) => setFailureReason(e.target.value)}
                      placeholder="Ex. : accès bloqué par la montée des eaux, matériel manquant…"
                      disabled={failureSaving}
                    />
                  </label>
                </div>
                <div className="am-offcanvas-footer">
                  <button type="button" className="am-btn am-btn--secondary" disabled={failureSaving} onClick={() => { setExpandedFailureTask(null); setFailureReason(''); setFailureAlert(null); }}>Annuler</button>
                  <button type="button" className="am-btn am-btn--primary vcm-ko" disabled={!failureReason.trim() || failureSaving} onClick={() => markTaskFailed(task.id, failureReason.trim())}>
                    {failureSaving ? 'Envoi…' : 'Marquer comme échouée'}
                  </button>
                </div>
              </FeuilleHaute>
            )}

            {estTelephone && active && expandedProofTask === task.id && (
              <FeuilleHaute
                title="Terminer avec une preuve"
                subtitle={task.title}
                closeDisabled={enEnvoi}
                onClose={fermerPreuve}
              >
                <div className="am-offcanvas-body vcm-feuille-corps">
                  <p className="vcm-feuille-texte">Image, vidéo ou document (PDF, Word, Excel…) qui atteste de la réalisation.</p>
                  {proofUploadError && <div className="vc-alert vc-alert-danger" role="alert">{proofUploadError}</div>}
                  {proofUploadSuccess && <div className="vc-alert vc-alert-success" role="status">{proofUploadSuccess}</div>}
                  {(proofPreviewUrl || selectedProofFile) && (
                    <div className="vc-preview">
                      {proofPreviewType === 'image' ? (
                        <BlurryImage src={proofPreviewUrl} alt="Aperçu de la preuve" />
                      ) : proofPreviewType === 'video' ? (
                        <video src={proofPreviewUrl} controls />
                      ) : (
                        <span className="vc-preview-doc">
                          <DocumentUpload size={22} variant="Bold" color="currentColor" />
                          <span><b>{selectedProofFile?.name}</b>{selectedProofFile?.size ? <small>{(selectedProofFile.size / 1024).toFixed(1)} Ko</small> : null}</span>
                        </span>
                      )}
                      <button type="button" className="vc-preview-x" onClick={viderFichier} disabled={enEnvoi} aria-label="Retirer le fichier">
                        <CloseCircle size={20} variant="Bold" color="currentColor" />
                      </button>
                    </div>
                  )}
                  <label className="vcm-fichier">
                    {selectedProofFile ? 'Changer de fichier' : 'Choisir un fichier'}
                    <input type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" disabled={enEnvoi} onChange={choisirFichier} hidden />
                  </label>
                </div>
                <div className="am-offcanvas-footer">
                  <button type="button" className="am-btn am-btn--secondary" disabled={enEnvoi} onClick={fermerPreuve}>Annuler</button>
                  <button type="button" className="am-btn am-btn--primary" disabled={!selectedProofFile || enEnvoi} onClick={() => envoyerPreuve(task.id)}>
                    {enEnvoi ? 'Envoi…' : 'Valider la tâche'}
                  </button>
                </div>
              </FeuilleHaute>
            )}

            {/* Signaler un échec */}
            {!estTelephone && active && expandedFailureTask === task.id && (
              <div className="vc-task-panel vc-panel-ko">
                {failureAlert && <div className={`vc-alert vc-alert-${failureAlert.type}`} role="alert">{failureAlert.message}</div>}
                <label htmlFor={`echec-${task.id}`}>Pourquoi cette tâche n'a-t-elle pas pu être réalisée ?</label>
                <textarea
                  id={`echec-${task.id}`}
                  rows={3}
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  placeholder="Ex. : accès bloqué par la montée des eaux, matériel manquant…"
                  autoFocus
                  disabled={failureSaving}
                />
                <div className="vc-panel-actions">
                  <button type="button" className="vd-btn vd-btn-g vd-btn-s" disabled={failureSaving} onClick={() => { setExpandedFailureTask(null); setFailureReason(''); setFailureAlert(null); }}>
                    Annuler
                  </button>
                  <button type="button" className="vd-btn vd-btn-s vc-btn-ko" onClick={() => failureReason.trim() && markTaskFailed(task.id, failureReason.trim())} disabled={!failureReason.trim() || failureSaving}>
                    {failureSaving ? <><Spin size={12} />Envoi…</> : <><Danger size={14} variant="Bold" color="currentColor" />Marquer comme échouée</>}
                  </button>
                </div>
              </div>
            )}

            {/* Terminer avec une preuve */}
            {!estTelephone && active && expandedProofTask === task.id && (
              <div className="vc-task-panel">
                <b>Terminer la tâche avec une preuve</b>
                <p>Image, vidéo ou document (PDF, Word, Excel…) qui atteste de la réalisation.</p>
                {proofUploadError && <div className="vc-alert vc-alert-danger" role="alert">{proofUploadError}</div>}
                {proofUploadSuccess && <div className="vc-alert vc-alert-success" role="status">{proofUploadSuccess}</div>}

                {(proofPreviewUrl || selectedProofFile) && (
                  <div className="vc-preview">
                    {proofPreviewType === 'image' ? (
                      <BlurryImage src={proofPreviewUrl} alt="Aperçu de la preuve" />
                    ) : proofPreviewType === 'video' ? (
                      <video src={proofPreviewUrl} controls />
                    ) : (
                      <span className="vc-preview-doc">
                        <DocumentUpload size={22} variant="Bold" color="currentColor" />
                        <span><b>{selectedProofFile?.name}</b>{selectedProofFile?.size ? <small>{(selectedProofFile.size / 1024).toFixed(1)} Ko</small> : null}</span>
                      </span>
                    )}
                    <button type="button" className="vc-preview-x" onClick={viderFichier} disabled={enEnvoi} aria-label="Retirer le fichier">
                      <CloseCircle size={20} variant="Bold" color="currentColor" />
                    </button>
                  </div>
                )}

                <div className="vc-panel-actions">
                  <label className={`vd-btn vd-btn-g vd-btn-s ${enEnvoi ? 'is-off' : ''}`}>
                    <DocumentUpload size={14} color="currentColor" />
                    {selectedProofFile ? 'Changer de fichier' : 'Choisir un fichier'}
                    <input type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" disabled={enEnvoi} onChange={choisirFichier} hidden />
                  </label>
                  <span className="vc-spacer" />
                  <button type="button" className="vd-btn vd-btn-g vd-btn-s" disabled={enEnvoi} onClick={fermerPreuve}>Annuler</button>
                  <button type="button" className="vd-btn vd-btn-p vd-btn-s" disabled={!selectedProofFile || enEnvoi} onClick={() => envoyerPreuve(task.id)}>
                    {enEnvoi ? <><Spin size={12} />Envoi…</> : <><TickCircle size={14} variant="Bold" color="currentColor" />Valider la tâche</>}
                  </button>
                </div>
              </div>
            )}

            {/* Preuve d'une tâche terminée */}
            {task.completed && (preuve ? (
              <div className="vc-task-proof">
                <button type="button" className="vd-link vc-proof-toggle" onClick={() => toggleCompletedProof(task.id)} aria-expanded={preuveOuverte}>
                  <ArrowDown2 size={13} color="currentColor" className={`vd-caret ${preuveOuverte ? 'is-open' : ''}`} />
                  {preuveOuverte ? 'Masquer la preuve' : 'Voir la preuve'}
                </button>
                {preuveOuverte && <Preuve preuve={preuve} onZoomImage={onZoomImage} onVideo={setActiveProofPreview} />}
              </div>
            ) : !lectureSeule && (
              <div className="vc-task-proof">
                <label className="vd-btn vd-btn-g vd-btn-s">
                  <DocumentUpload size={14} color="currentColor" />Ajouter une preuve
                  <input type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" onChange={(e) => e.target.files[0] && handleProofUpload(task.id, e.target.files[0])} hidden />
                </label>
              </div>
            ))}
          </li>
        );
      })}
      {menuTache && (
        <FeuilleActions titre={menuTache.title} actions={actionsTache(menuTache)} onClose={() => setMenuTache(null)} />
      )}
    </ul>
  );
};

export default ListeTaches;
