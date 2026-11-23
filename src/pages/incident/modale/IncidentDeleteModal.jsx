import { createPortal } from 'react-dom';
import { Trash } from 'iconsax-react';
import { useIncidentModalContext } from './IncidentModalContext';
import { deleteIncidentService } from '../service/incident_service';
import { OffcanvasModal } from '../../../components/molecules/OffcanvasModal';
import { logger } from '../../../utils/logger';
import { useEstTelephone } from '../mobile/useEstTelephone';
import '../mobile/mobile.css';

export const IncidentDeleteModal = () => {
  const estTelephone = useEstTelephone();
  const {
    deleteModal,
    deleteClosing,
    isDeleting,
    setIsDeleting,
    deleteAlert,
    setDeleteAlert,
    closeDeleteModal,
    mutateIncidents
  } = useIncidentModalContext();

  if (!deleteModal.open || !deleteModal.incident) return null;

  const verrouille = isDeleting || deleteAlert.type === 'success';

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setDeleteAlert({ type: null, message: null });
    try {
      await deleteIncidentService(deleteModal.incident.id);
      setDeleteAlert({ type: 'success', message: 'Signalement supprimé avec succès !' });
      mutateIncidents();
      setTimeout(() => closeDeleteModal(), 2000);
    } catch (err) {
      logger.error('[IncidentDeleteModal] Erreur lors de la suppression:', err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Une erreur est survenue lors de la suppression de l\'incident.';
      setDeleteAlert({ type: 'danger', message: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  if (estTelephone) {
    return createPortal(
      <div className="sgm-fond sgm-alerte-fond">
        <div className="sgm-alerte" role="alertdialog" aria-modal="true" aria-labelledby="sgm-suppr-titre">
          <div className="sgm-alerte-corps">
            <b id="sgm-suppr-titre">Supprimer le signalement ?</b>
            <span>« {deleteModal.incident.title || 'Sans titre'} » sera supprimé. Cette action est irréversible.</span>
            {deleteAlert.message && (
              <div className={`am-alert am-alert--${deleteAlert.type === 'success' ? 'success' : 'danger'}`} role="alert">
                <span className="am-alert__message">{deleteAlert.message}</span>
              </div>
            )}
          </div>
          <div className="sgm-alerte-boutons">
            {/* Le focus part sur Annuler : un double toucher ne supprime rien. */}
            <button type="button" onClick={closeDeleteModal} disabled={verrouille} ref={(el) => el?.focus({ preventScroll: true })}>Annuler</button>
            <button type="button" className="is-danger" onClick={handleConfirmDelete} disabled={verrouille}>Supprimer</button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <OffcanvasModal
      onClose={closeDeleteModal}
      isClosing={Boolean(deleteClosing)}
      title="Supprimer l'incident"
      role="alertdialog"
      tone="danger"
      size="sm"
      closeVariant="plain"
      closeDisabled={verrouille}
      footerLayout="col"
      footer={
        <>
          <button
            type="button"
            className="am-btn am-btn--danger"
            onClick={handleConfirmDelete}
            disabled={verrouille}
          >
            {isDeleting && <span className="am-spinner" aria-hidden="true" />}
            Supprimer définitivement
          </button>
          <button
            type="button"
            className="am-btn am-btn--outline"
            onClick={closeDeleteModal}
            disabled={verrouille}
          >
            Annuler
          </button>
        </>
      }
    >
      <div className="am-offcanvas-body am-offcanvas-body--centered">
        <div className="am-delete-icon-wrap" aria-hidden="true">
          <Trash size={32} variant="Bold" color="var(--color-danger)" />
        </div>

        <p className="am-delete-title">Confirmer la suppression</p>
        <p className="am-delete-text">
          Vous êtes sur le point de supprimer l&apos;incident{' '}
          <strong>&quot;{deleteModal.incident.title || 'Sans titre'}&quot;</strong>.
          Cette action est <strong>irréversible</strong>.
        </p>

        {deleteAlert.message && (
          <div className={`am-alert am-alert--${deleteAlert.type === 'success' ? 'success' : 'danger'}`} role="alert" style={{ width: '100%' }}>
            <span className="am-alert__message" style={{ textAlign: 'left' }}>{deleteAlert.message}</span>
          </div>
        )}
      </div>
    </OffcanvasModal>
  );
};

export default IncidentDeleteModal;
