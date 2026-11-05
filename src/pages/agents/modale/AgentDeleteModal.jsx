import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useEstTelephone } from '../../incident/mobile/useEstTelephone';
import { CloseCircle } from 'iconsax-react';
import { useAgentsContext } from './AgentsModalContext';
import { removeOrganisationMemberService } from '../service/members_service';
import { authService } from '../../auth/services/authService';
import { Dialogue } from '../../../components/molecules/Dialogue';

const IcoRetrait = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="10" cy="8" r="4" /><path d="M3 21c0-4 3-6 7-6s7 2 7 6M16 11h6" />
  </svg>
);

/**
 * L'API retire l'agent de l'organisation (DELETE …/members/<id>/) : c'est ce
 * que dit la fenêtre, plutôt qu'une « suppression » qui laisserait croire
 * que le compte disparaît.
 */
const FenetreRetrait = () => {
  const { deleteModal, closeDeleteModal, mutateAgents, afficherToast, openEdit } = useAgentsContext();
  const estTelephone = useEstTelephone();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const agent = deleteModal.agent;

  const retirer = async (close) => {
    setEnvoi(true);
    setErreur(null);
    try {
      const currentUser = authService.getCurrentUser();
      // Super-administrateur : l'organisation de l'agent ; sinon la sienne.
      const organisationId = currentUser?.web_role === 'super_admin'
        ? agent?.organisationId
        : (currentUser?.organisation_member || currentUser?.organisation_id || agent?.organisationId);
      if (!organisationId) throw new Error('L’organisation de cet agent est introuvable.');

      await removeOrganisationMemberService(organisationId, agent.id);
      afficherToast(`${agent.fullName} ne fait plus partie de l’équipe`);
      mutateAgents();
      close();
    } catch (err) {
      setErreur(
        err?.response?.data?.detail || err?.response?.data?.message || err?.message
        || 'L’agent n’a pas pu être retiré. Réessayez dans un instant.',
      );
    } finally {
      setEnvoi(false);
    }
  };

  if (estTelephone) {
    return createPortal(
      <div className="sgm-fond sgm-alerte-fond">
        <div className="sgm-alerte" role="alertdialog" aria-modal="true" aria-labelledby="ad-titre">
          <div className="sgm-alerte-corps">
            <b id="ad-titre">Retirer {agent?.fullName || 'cet agent'} de l’équipe ?</b>
            <span>
              {agent?.agentCode ? `Son code d’accès ${agent.agentCode} cessera de fonctionner : l’agent` : 'L’agent'}
              {' '}ne pourra plus se connecter au nom
              {agent?.organisationName ? ` de ${agent.organisationName}` : ' de l’organisation'}.
              Cette action ne peut pas être annulée.
            </span>
            {erreur && <div className="am-alert am-alert--danger" role="alert"><span className="am-alert__message">{erreur}</span></div>}
          </div>
          {agent?.status === 'active' && (
            <button type="button" className="vcm-alerte-lien" disabled={envoi} onClick={() => { closeDeleteModal(); openEdit(agent); }}>Le passer plutôt en inactif</button>
          )}
          <div className="sgm-alerte-boutons">
            <button type="button" onClick={closeDeleteModal} disabled={envoi}>Garder</button>
            <button type="button" className="is-danger" onClick={() => retirer(closeDeleteModal)} disabled={envoi}>Retirer</button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <Dialogue
      onClose={closeDeleteModal}
      role="alertdialog"
      taille="sm"
      ton="danger"
      pile
      verrouille={envoi}
      titre={`Retirer ${agent?.fullName || 'cet agent'} de l’équipe ?`}
      icone={<IcoRetrait />}
      pied={({ close }) => (
        <>
          <span className="dg-espace" />
          <button type="button" className="dg-btn dg-btn-g" onClick={close} disabled={envoi}>Garder l’agent</button>
          <button type="button" className="dg-btn dg-btn-ko" onClick={() => retirer(close)} disabled={envoi}>
            {envoi ? <><span className="dg-spin" aria-hidden="true" />Retrait…</> : 'Retirer de l’équipe'}
          </button>
        </>
      )}
    >
      {erreur && (
        <div className="dg-alerte dg-alerte-ko" role="alert">
          <CloseCircle size={18} variant="Bold" color="currentColor" /><span>{erreur}</span>
        </div>
      )}
      <p className="ad-texte">
        {agent?.agentCode
          ? <>Son code d’accès <b className="ad-code">{agent.agentCode}</b> cessera de fonctionner : l’agent</>
          : 'L’agent'}
        {' '}ne pourra plus se connecter au nom
        {agent?.organisationName ? ` de ${agent.organisationName}` : ' de l’organisation'}.
        Cette action ne peut pas être annulée.
      </p>
      {agent?.status === 'active' && (
        <p className="ad-conseil">
          Pour une absence temporaire, passez plutôt son compte en <b>inactif</b> depuis « Modifier » : vous pourrez le réactiver.
        </p>
      )}
    </Dialogue>
  );
};

export const AgentDeleteModal = () => {
  const { deleteModal } = useAgentsContext();
  return deleteModal.open ? <FenetreRetrait /> : null;
};

export default AgentDeleteModal;
