import React, { useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { CloseCircle, SearchNormal1 } from 'iconsax-react';
import { ShimmerThumbnail, ShimmerText } from 'react-shimmer-effects';
import { useMesInterventionsModalContext } from '../mesInterventionsModalContexte';
import { assignIncidentToAgentService, getIncidentAssignmentsService } from '../../incident/service/incident_service';
import { getTousLesAgentsService } from '../../agents/service/members_service';
import { getRoleConfig, roleDepuisApi } from '../../agents/roles';
import { authService } from '../../auth/services/authService';
import { Dialogue } from '../../../components/molecules/Dialogue';
import { ChampDate } from '../../collaboration-detail/modal/ChampDate';
import { aujourdhui, dateLongue } from '../../collaboration-detail/modal/dates';
import { AVATAR_COLORS, AVATAR_COULEUR_DEFAUT } from '../../../utils/couleursAvatar';
import { logger } from '../../../utils/logger';

const EMPTY_ARRAY = [];

const initiales = (nom = '') =>
  nom.split(/\s+/).filter(Boolean).slice(0, 2).map((m) => m[0].toUpperCase()).join('') || '?';

const couleur = (id) => {
  const n = [...String(id ?? '')].reduce((h, c) => h + c.charCodeAt(0), 0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length] || AVATAR_COULEUR_DEFAUT;
};

const IcoAssigner = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="10" cy="8" r="4" /><path d="M3 21c0-4 3-6 7-6s7 2 7 6M19 8v6M16 11h6" />
  </svg>
);

const IcoInfo = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16v.5" />
  </svg>
);

// Message lisible à partir d'une réponse d'erreur du serveur.
const messageServeur = (donnees) => {
  if (!donnees) return null;
  if (typeof donnees === 'string') return donnees;
  const brut = donnees.non_field_errors || donnees.detail || donnees.message || donnees.error
    || donnees.agent || donnees.deadline || Object.values(donnees)[0];
  return Array.isArray(brut) ? brut[0] : (brut ? String(brut) : null);
};

const FenetreAssigner = () => {
  const { assignModal, closeAssignModal, mutateIncidents, afficherToast } = useMesInterventionsModalContext();
  const incident = assignModal.incident;

  const currentUser = useMemo(() => authService.getCurrentUser(), []);
  const orgId = currentUser?.organisation || currentUser?.organisation_member || sessionStorage.getItem('organisation');

  const [recherche, setRecherche] = useState('');
  const [choisi, setChoisi] = useState('');
  const [echeance, setEcheance] = useState('');
  const [erreurs, setErreurs] = useState({});
  const [alerte, setAlerte] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  // Fermeture animée du dialogue, prise avant le verrouillage de l'envoi.
  const fermerRef = useRef(null);

  const { data: membres, isLoading: chargeMembres, error: erreurMembres } = useSWR(
    orgId ? ['membres_assignation', orgId] : null,
    async () => {
      const liste = await getTousLesAgentsService('', '', '', orgId);
      return liste.map((m) => ({
        id: m.id,
        nom: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email,
        email: m.email || '',
        role: getRoleConfig(roleDepuisApi(m.org_role)).label,
        couleur: couleur(m.id),
      }));
    },
    { revalidateOnFocus: false },
  );

  const { data: assignations, mutate: mutateAssignations } = useSWR(
    `incident_assignments_${incident.id}`,
    () => getIncidentAssignmentsService(incident.id),
    { revalidateOnFocus: false },
  );

  const dejaAssignes = useMemo(
    () => new Set((assignations || []).map((a) => String(a.agent?.id ?? a.agent))),
    [assignations],
  );

  const agents = membres || EMPTY_ARRAY;
  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((a) => a.nom.toLowerCase().includes(q) || a.email.toLowerCase().includes(q));
  }, [agents, recherche]);

  const agentChoisi = agents.find((a) => String(a.id) === choisi);

  const assigner = async () => {
    const nouvelles = {};
    if (!choisi) nouvelles.agent = 'Choisissez un agent.';
    setErreurs(nouvelles);
    if (Object.keys(nouvelles).length) return;

    const fermer = fermerRef.current;
    setEnvoi(true);
    setAlerte(null);
    try {
      await assignIncidentToAgentService(incident.id, {
        incident: incident.id,
        agent: choisi,
        status: 'pending',
        deadline: echeance ? new Date(echeance).toISOString() : null,
      });
      afficherToast(`${agentChoisi?.nom || 'L’agent'} rejoint l’équipe`);
      mutateAssignations();
      mutateIncidents?.();
      fermer?.();
    } catch (err) {
      logger.error('[MesInterventionsAssignModal] Erreur lors de l\'assignation:', err);
      const donnees = err?.response?.data;
      if (err?.response?.status === 400 && donnees && typeof donnees === 'object' && (donnees.agent || donnees.deadline)) {
        const texte = (v) => (Array.isArray(v) ? v[0] : v);
        setErreurs({ agent: texte(donnees.agent), deadline: texte(donnees.deadline) });
      } else {
        setAlerte(messageServeur(donnees) || 'L’agent n’a pas pu être assigné. Réessayez dans un instant.');
      }
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Dialogue
      onClose={closeAssignModal}
      verrouille={envoi}
      titre="Assigner un agent"
      sousTitre={incident.title || 'Sans titre'}
      icone={<IcoAssigner />}
      pied={({ close }) => (
        <>
          {erreurs.agent
            ? <span className="dg-pied-info is-ko" role="status"><IcoInfo />Choisissez un agent</span>
            : (
              <span className="dg-pied-info">
                {agentChoisi ? `${agentChoisi.nom}${echeance ? `, à finir avant le ${dateLongue(echeance, true).toLowerCase()}` : ''}` : ''}
              </span>
            )}
          <button type="button" className="dg-btn dg-btn-g" onClick={close} disabled={envoi}>Annuler</button>
          <button type="button" className="dg-btn dg-btn-p" onClick={assigner} disabled={envoi}>
            {envoi ? <><span className="dg-spin" aria-hidden="true" />Assignation…</> : 'Assigner'}
          </button>
        </>
      )}
    >
      {({ close }) => {
        fermerRef.current = close;
        return (
          <div className="ma-form">
            {alerte && (
              <div className="dg-alerte dg-alerte-ko" role="alert">
                <CloseCircle size={18} variant="Bold" color="currentColor" /><span>{alerte}</span>
              </div>
            )}

            <fieldset className="dg-fieldset">
              <legend>Agent de l’organisation</legend>
              <label className="ma-recherche">
                <SearchNormal1 size={16} color="currentColor" aria-hidden="true" />
                <input type="search" data-autofocus value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom ou e-mail" aria-label="Rechercher un agent" disabled={envoi} />
              </label>

              <div className={`ma-liste ${erreurs.agent ? 'is-ko' : ''}`} role="radiogroup" aria-label="Agents" aria-describedby={erreurs.agent ? 'ma-agent-err' : undefined}>
                {chargeMembres ? (
                  [0, 1, 2].map((n) => <div key={n} className="ma-agent"><ShimmerThumbnail height={34} width={34} rounded className="m-0" /><div style={{ flex: 1 }}><ShimmerText line={2} gap={6} /></div></div>)
                ) : erreurMembres ? (
                  <p className="ma-vide">Les agents n’ont pas pu être chargés. Fermez puis rouvrez cette fenêtre.</p>
                ) : filtres.length === 0 ? (
                  <p className="ma-vide">{recherche ? 'Aucun agent ne correspond à cette recherche.' : 'Votre organisation n’a encore aucun agent.'}</p>
                ) : filtres.map((a) => {
                  const deja = dejaAssignes.has(String(a.id));
                  const actif = choisi === String(a.id);
                  return (
                    <label key={a.id} className={`ma-agent ${actif ? 'is-on' : ''} ${deja ? 'is-deja' : ''}`}>
                      <input
                        type="radio"
                        name="ma-agent"
                        value={a.id}
                        checked={actif}
                        disabled={deja || envoi}
                        onChange={() => { setChoisi(String(a.id)); setErreurs((e) => ({ ...e, agent: undefined })); }}
                      />
                      <span className="ma-av" style={{ backgroundColor: a.couleur }} aria-hidden="true">{initiales(a.nom)}</span>
                      <span className="ma-nom">
                        <b>{a.nom}</b>
                        <span>{a.role}</span>
                      </span>
                      {deja && <span className="ma-note">Déjà dans l’équipe</span>}
                    </label>
                  );
                })}
              </div>
              {erreurs.agent && <span id="ma-agent-err" className="dg-erreur"><IcoInfo />{erreurs.agent}</span>}
            </fieldset>

            <ChampDate
              libelle="À finir avant le"
              valeur={echeance}
              onChange={(v) => { setEcheance(v); setErreurs((e) => ({ ...e, deadline: undefined })); }}
              min={aujourdhui()}
              disabled={envoi}
              invalide={Boolean(erreurs.deadline)}
              idErreur={erreurs.deadline ? 'ma-ech-err' : undefined}
              avecAnnee
            >
              {erreurs.deadline
                ? <span id="ma-ech-err" className="dg-erreur"><IcoInfo />{erreurs.deadline}</span>
                : <small>Facultatif.</small>}
            </ChampDate>
          </div>
        );
      }}
    </Dialogue>
  );
};

export const MesInterventionsAssignModal = () => {
  const { assignModal } = useMesInterventionsModalContext();
  return assignModal.open && assignModal.incident ? <FenetreAssigner /> : null;
};

export default MesInterventionsAssignModal;
