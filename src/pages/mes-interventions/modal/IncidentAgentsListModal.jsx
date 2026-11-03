import React, { useState } from 'react';
import useSWR from 'swr';
import { Danger, People } from 'iconsax-react';
import { ShimmerThumbnail, ShimmerText } from 'react-shimmer-effects';
import { useMesInterventionsModalContext } from '../mesInterventionsModalContexte';
import { getIncidentAssignmentsService } from '../../incident/service/incident_service';
import { Dialogue } from '../../../components/molecules/Dialogue';
import { AVATAR_COLORS, AVATAR_COULEUR_DEFAUT } from '../../../utils/couleursAvatar';
import { formatTelephone, telLien } from '../../agents/format';
import { ETATS_ASSIGNATION, dateFr } from '../format';

const initiales = (nom = '') =>
  nom.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0].toUpperCase()).join('') || '?';

const couleur = (id) => {
  const n = [...String(id ?? '')].reduce((h, c) => h + c.charCodeAt(0), 0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length] || AVATAR_COULEUR_DEFAUT;
};

const IcoEquipe = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.2.6 3.5 2.6 3.5 6" />
  </svg>
);

/** Les agents assignés à une intervention, chargés à l'ouverture. */
const FenetreEquipe = () => {
  const { agentsModal, closeAgentsModal, openAssignModal } = useMesInterventionsModalContext();
  const incident = agentsModal.incident;

  const { data, error, isLoading } = useSWR(
    `incident_assignments_${incident.id}`,
    () => getIncidentAssignmentsService(incident.id),
  );

  // Figé à l'ouverture : la fenêtre ne reste pas ouverte des heures.
  const [maintenant] = useState(() => Date.now());
  const agents = (data || []).map((a) => {
    const id = a.agent?.id ?? a.agent ?? a.id;
    const etat = ETATS_ASSIGNATION[a.status];
    const echeance = a.deadline ? new Date(a.deadline) : null;
    return {
      id: a.id ?? id,
      nom: a.agent_name || 'Agent sans nom',
      email: a.agent_email || '',
      tel: a.agent_phone || '',
      couleur: couleur(id),
      etat,
      echeance: dateFr(a.deadline),
      enRetard: Boolean(echeance && echeance.getTime() < maintenant && a.status !== 'resolved'),
      par: a.assigned_by_name || '',
    };
  });

  const sousTitre = [
    incident.title || 'Sans titre',
    !isLoading && !error ? `${agents.length} agent${agents.length > 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Dialogue
      onClose={closeAgentsModal}
      titre="Équipe sur le terrain"
      sousTitre={sousTitre}
      icone={<IcoEquipe />}
      pied={({ close }) => (
        <>
          <span className="dg-espace" />
          <button type="button" className="dg-btn dg-btn-g" onClick={close}>Fermer</button>
          <button
            type="button"
            className="dg-btn dg-btn-p"
            onClick={() => { closeAgentsModal(); openAssignModal(incident); }}
          >
            Assigner un agent
          </button>
        </>
      )}
    >
      {isLoading ? (
        <ul className="me-liste" aria-busy="true">
          {[0, 1, 2].map((n) => <li key={n} className="me-agent"><ShimmerThumbnail height={40} width={40} rounded className="m-0" /><div style={{ flex: 1 }}><ShimmerText line={3} gap={8} /></div></li>)}
        </ul>
      ) : error ? (
        <div className="dg-alerte dg-alerte-ko" role="alert">
          <Danger size={18} variant="Bold" color="currentColor" />
          <span>L’équipe n’a pas pu être chargée. Vérifiez votre connexion puis rouvrez cette fenêtre.</span>
        </div>
      ) : agents.length === 0 ? (
        <div className="me-vide">
          <span className="me-vide-ic"><People size={22} color="currentColor" /></span>
          <b>Personne sur le terrain</b>
          <p>Aucun agent n’est encore assigné à cette intervention.</p>
        </div>
      ) : (
        <ul className="me-liste">
          {agents.map((a) => (
            <li key={a.id} className="me-agent">
              <span className="me-av" style={{ backgroundColor: a.couleur }} aria-hidden="true">{initiales(a.nom)}</span>
              <div className="me-infos">
                <div className="me-ligne">
                  <b>{a.nom}</b>
                  {a.etat && <span className={`mi-statut ${a.etat.classe}`}><i aria-hidden="true" />{a.etat.libelle}</span>}
                </div>
                {(a.tel || a.email) && (
                  <div className="me-ligne me-contact">
                    {a.tel && <a href={telLien(a.tel)}>{formatTelephone(a.tel)}</a>}
                    {a.email && <span>{a.email}</span>}
                  </div>
                )}
                {(a.echeance || a.par) && (
                  <div className="me-ligne me-meta">
                    {a.echeance && <span>À finir avant le <b className={a.enRetard ? 'is-retard' : ''}>{a.echeance}</b>{a.enRetard ? ' (dépassé)' : ''}</span>}
                    {a.par && <span>Assigné par {a.par}</span>}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Dialogue>
  );
};

export const IncidentAgentsListModal = () => {
  const { agentsModal } = useMesInterventionsModalContext();
  return agentsModal.open && agentsModal.incident ? <FenetreEquipe /> : null;
};

export default IncidentAgentsListModal;
