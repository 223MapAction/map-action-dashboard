import React from 'react';
import { CloseCircle } from 'iconsax-react';
import { useOrganisationsContext } from '../context/OrganisationsContext';
import { Dialogue } from '../../../components/molecules/Dialogue';

const IcoCorbeille = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7V4h6v3" />
  </svg>
);

const DeleteOrganisationModal = () => {
  const { deleteModal, isDeleting, deleteAlert, closeDeleteModal, confirmDelete } = useOrganisationsContext();

  if (!deleteModal.open) return null;

  const org = deleteModal.org;

  return (
    <Dialogue
      onClose={closeDeleteModal}
      role="alertdialog"
      taille="sm"
      ton="danger"
      pile
      verrouille={isDeleting}
      titre={`Supprimer « ${org?.name || 'cette organisation'} » ?`}
      icone={<IcoCorbeille />}
      pied={({ close }) => (
        <>
          <span className="dg-espace" />
          <button type="button" className="dg-btn dg-btn-g" onClick={close} disabled={isDeleting}>Garder l’organisation</button>
          <button type="button" className="dg-btn dg-btn-ko" onClick={() => confirmDelete(close)} disabled={isDeleting}>
            {isDeleting ? <><span className="dg-spin" aria-hidden="true" />Suppression…</> : 'Supprimer'}
          </button>
        </>
      )}
    >
      {deleteAlert.message && (
        <div className="dg-alerte dg-alerte-ko" role="alert">
          <CloseCircle size={18} variant="Bold" color="currentColor" /><span>{deleteAlert.message}</span>
        </div>
      )}
      <p className="od-texte">
        L’organisation disparaît de Map Action
        {org?.membersCount ? `, avec ses ${org.membersCount} membre${org.membersCount > 1 ? 's' : ''} rattaché${org.membersCount > 1 ? 's' : ''}` : ''}.
        Cette action ne peut pas être annulée.
      </p>
      {org?.status === 'active' && (
        <p className="od-conseil">
          Pour la retirer des invitations sans rien perdre, passez-la plutôt en <b>inactive</b> depuis « Modifier ».
        </p>
      )}
    </Dialogue>
  );
};

export default DeleteOrganisationModal;
