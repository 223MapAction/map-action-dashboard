import React, { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { CloseCircle, ArrowDown2, Lock1 } from 'iconsax-react';
import { ROLES, roleVersApi } from '../roles';
import { useAgentsContext } from './AgentsModalContext';
import { createAgentSchema, editAgentSchema } from './agentSchemas';
import {
  createOrganisationAgentService,
  updateOrganisationMemberService,
  addOrganisationStaffMemberService,
} from '../service/members_service';
import { authService } from '../../auth/services/authService';
import { Dialogue } from '../../../components/molecules/Dialogue';

const PREFIXE = '+223';

const sansPrefixe = (phone) => {
  if (!phone) return '';
  const net = String(phone).replace(/\s/g, '');
  return net.startsWith(PREFIXE) ? net.slice(PREFIXE.length) : net;
};

const IcoAgent = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="10" cy="8" r="4" /><path d="M3 21c0-4 3-6 7-6s7 2 7 6M19 8v6M16 11h6" />
  </svg>
);

const IcoInfo = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16v.5" />
  </svg>
);

const Erreur = ({ id, children }) => (children ? <span id={id} className="dg-erreur"><IcoInfo />{children}</span> : null);

// Correspondance des champs renvoyés par le serveur vers ceux du formulaire.
const CHAMPS_SERVEUR = {
  first_name: 'firstName',
  last_name: 'lastName',
  email: 'email',
  phone: 'phone',
  address: 'address',
  org_role: 'role',
  organisation: 'organisationId',
};

/**
 * La fenêtre n'est montée qu'à l'ouverture : les valeurs initiales du
 * formulaire sont donc toujours celles de l'agent ouvert, sans
 * resynchronisation à la main.
 */
const FenetreAgent = () => {
  const currentUser = authService.getCurrentUser();
  const estSuperAdmin = currentUser?.web_role === 'super_admin';
  const { formModal, closeFormModal, mutateAgents, afficherToast, organisationsList } = useAgentsContext();
  const creation = formModal.mode === 'create';
  const agent = formModal.agent;

  const rawOrg = currentUser?.organisation;
  const nomOrgUtilisateur = currentUser?.organisation_name
    || (rawOrg && typeof rawOrg === 'object' ? rawOrg.name : '')
    || 'Mon organisation';
  const idOrgUtilisateur = currentUser?.organisation_member
    || (rawOrg && typeof rawOrg === 'object' ? rawOrg.id : rawOrg)
    || sessionStorage.getItem('organisation')
    || '';

  // Le super-administrateur choisit l'organisation à la création ; ailleurs
  // elle est imposée : la sienne, ou celle de l'agent modifié.
  const choixOrganisation = estSuperAdmin && creation;
  const nomOrgAffiche = creation
    ? nomOrgUtilisateur
    : (organisationsList.find((o) => String(o.id) === String(agent?.organisationId))?.name || agent?.organisationName || '—');

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(creation ? createAgentSchema : editAgentSchema),
    defaultValues: creation
      ? {
        firstName: '', lastName: '', email: '', phone: '', address: '',
        role: 'terrain',
        organisationId: estSuperAdmin ? '' : String(idOrgUtilisateur || ''),
        status: 'active',
      }
      : {
        firstName: agent?.firstName || '',
        lastName: agent?.lastName || '',
        email: agent?.email || '',
        phone: sansPrefixe(agent?.phone),
        address: agent?.address || '',
        role: agent?.role || 'terrain',
        organisationId: String(agent?.organisationId || ''),
        status: agent?.status || 'active',
      },
  });

  const [envoi, setEnvoi] = useState(false);
  const [alerte, setAlerte] = useState(null);
  // Fermeture animée du dialogue, reçue au rendu de son contenu.
  const fermerRef = useRef(null);

  const roleChoisi = watch('role');
  const statutChoisi = watch('status');
  // Un agent de bureau ne peut pas créer ni nommer un administrateur.
  const rolesProposes = ROLES.filter((r) => !(currentUser?.web_role === 'bureau_agent' && r.id === 'admin'));
  const nbErreurs = Object.keys(errors).length;

  const enregistrer = async (data) => {
    // Pris avant le verrouillage : le dialogue refuse de se fermer tant
    // qu'il est verrouillé, et la version suivante de `close` le serait.
    const fermer = fermerRef.current;
    setEnvoi(true);
    setAlerte(null);
    try {
      const telephone = `${PREFIXE}${data.phone.replace(/\s/g, '')}`;
      if (creation) {
        const payload = {
          first_name: data.firstName,
          last_name: data.lastName,
          email: data.email,
          phone: telephone,
          address: data.address || '',
          org_role: roleVersApi(data.role),
        };
        if (data.role === 'terrain') {
          await createOrganisationAgentService(data.organisationId, payload);
        } else {
          await addOrganisationStaffMemberService(data.organisationId, payload);
        }
        afficherToast(`${data.firstName} ${data.lastName} a rejoint l’équipe`);
      } else {
        await updateOrganisationMemberService(data.organisationId, agent.id, {
          org_role: roleVersApi(data.role),
          first_name: data.firstName,
          last_name: data.lastName,
          phone: telephone,
          address: data.address || '',
          status: data.status || 'active',
        });
        afficherToast('Modifications enregistrées');
      }
      mutateAgents();
      fermer?.();
    } catch (err) {
      const donnees = err?.response?.data;
      if (err?.response?.status === 400 && donnees && typeof donnees === 'object') {
        if (donnees.error) {
          // Le serveur renvoie parfois une phrase unique : on la rattache au
          // champ qu'elle nomme quand c'est reconnaissable.
          const texte = String(donnees.error);
          const bas = texte.toLowerCase();
          if (/t[ée]l[ée]phone|num[ée]ro/.test(bas)) setError('phone', { type: 'server', message: texte });
          else if (/mail|adresse/.test(bas)) setError('email', { type: 'server', message: texte });
          else setAlerte(texte);
        } else {
          Object.entries(donnees).forEach(([cle, msg]) => {
            setError(CHAMPS_SERVEUR[cle] || cle, { type: 'server', message: Array.isArray(msg) ? msg.join(' ') : String(msg) });
          });
          setAlerte('Le serveur a refusé certains champs : corrigez-les ci-dessous.');
        }
      } else {
        setAlerte(
          donnees?.detail || donnees?.message || donnees?.error
          || `L’agent n’a pas pu être ${creation ? 'créé' : 'modifié'}. Réessayez dans un instant.`,
        );
      }
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Dialogue
      onClose={closeFormModal}
      verrouille={envoi}
      taille="lg"
      titre={creation ? 'Nouvel agent' : 'Modifier l’agent'}
      sousTitre={creation ? 'Son code d’accès est créé à l’enregistrement.' : agent?.fullName}
      icone={<IcoAgent />}
      pied={({ close }) => (
        <>
          {nbErreurs > 0
            ? <span className="dg-pied-info is-ko" role="status"><IcoInfo />{nbErreurs} champ{nbErreurs > 1 ? 's' : ''} à corriger</span>
            : <span className="dg-espace" />}
          <button type="button" className="dg-btn dg-btn-g" onClick={close} disabled={envoi}>Annuler</button>
          <button type="submit" form="form-agent" className="dg-btn dg-btn-p" disabled={envoi}>
            {envoi
              ? <><span className="dg-spin" aria-hidden="true" />{creation ? 'Création…' : 'Enregistrement…'}</>
              : (creation ? 'Créer l’agent' : 'Enregistrer')}
          </button>
        </>
      )}
    >
      {({ close }) => {
        fermerRef.current = close;
        return (
      <>
        {alerte && (
          <div className="dg-alerte dg-alerte-ko" role="alert">
            <CloseCircle size={18} variant="Bold" color="currentColor" /><span>{alerte}</span>
          </div>
        )}

        <form id="form-agent" className="af-form" noValidate onSubmit={handleSubmit(enregistrer)}>
          <fieldset className="dg-fieldset">
            <legend>Rôle</legend>
            <div className="af-roles">
              {rolesProposes.map((r) => (
                <label key={r.id} className={`af-role ${roleChoisi === r.id ? 'is-on' : ''}`}>
                  <span className="af-role-t">
                    <input type="radio" value={r.id} disabled={envoi} {...register('role')} />
                    {r.id === 'admin' ? r.label : r.onglet}
                  </span>
                  <small>{r.description}</small>
                </label>
              ))}
            </div>
            <Erreur id="af-role-err">{errors.role?.message}</Erreur>
          </fieldset>

          <div className="dg-grille2">
            <label className="dg-champ" htmlFor="af-prenom">
              Prénom
              <input id="af-prenom" data-autofocus type="text" className="dg-input" autoComplete="off" placeholder="Ex. : Amadou" disabled={envoi}
                aria-invalid={Boolean(errors.firstName)} aria-describedby={errors.firstName ? 'af-prenom-err' : undefined} {...register('firstName')} />
              <Erreur id="af-prenom-err">{errors.firstName?.message}</Erreur>
            </label>
            <label className="dg-champ" htmlFor="af-nom">
              Nom
              <input id="af-nom" type="text" className="dg-input" autoComplete="off" placeholder="Ex. : Diallo" disabled={envoi}
                aria-invalid={Boolean(errors.lastName)} aria-describedby={errors.lastName ? 'af-nom-err' : undefined} {...register('lastName')} />
              <Erreur id="af-nom-err">{errors.lastName?.message}</Erreur>
            </label>

            <label className="dg-champ" htmlFor="af-mail">
              Adresse e-mail
              <input id="af-mail" type="email" className="dg-input" autoComplete="off" placeholder="prenom.nom@organisation.org" disabled={envoi || !creation}
                aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'af-mail-err' : 'af-mail-aide'} {...register('email')} />
              {errors.email
                ? <Erreur id="af-mail-err">{errors.email.message}</Erreur>
                : <small id="af-mail-aide">{creation ? 'Ne pourra plus être modifiée ensuite.' : 'L’adresse e-mail ne se modifie pas.'}</small>}
            </label>
            <label className="dg-champ" htmlFor="af-tel">
              Téléphone
              <span className={`af-tel ${errors.phone ? 'is-ko' : ''}`}>
                <span className="af-tel-prefixe" aria-hidden="true">{PREFIXE}</span>
                <input id="af-tel" type="tel" inputMode="numeric" autoComplete="off" placeholder="76 00 00 00" disabled={envoi}
                  aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'af-tel-err' : undefined} {...register('phone')} />
              </span>
              <Erreur id="af-tel-err">{errors.phone?.message}</Erreur>
            </label>
          </div>

          <label className="dg-champ" htmlFor="af-adresse">
            <span>Adresse <span className="dg-opt">(facultatif)</span></span>
            <input id="af-adresse" type="text" className="dg-input" placeholder="Quartier, ville" disabled={envoi} {...register('address')} />
          </label>

          <div className="dg-grille2">
            {choixOrganisation ? (
              <label className="dg-champ" htmlFor="af-org">
                Organisation
                <span className={`af-choix ${errors.organisationId ? 'is-ko' : ''}`}>
                  <select id="af-org" disabled={envoi} aria-invalid={Boolean(errors.organisationId)} aria-describedby={errors.organisationId ? 'af-org-err' : undefined} {...register('organisationId')}>
                    <option value="">Choisir</option>
                    {organisationsList.map((o) => <option key={o.id} value={String(o.id)}>{o.name}</option>)}
                  </select>
                  <ArrowDown2 size={14} color="currentColor" aria-hidden="true" />
                </span>
                <Erreur id="af-org-err">{errors.organisationId?.message}</Erreur>
              </label>
            ) : (
              <div className="dg-champ">
                <span id="af-org-l">Organisation</span>
                <span className="af-verrou" aria-labelledby="af-org-l" role="textbox" aria-readonly="true">
                  <Lock1 size={14} color="currentColor" aria-hidden="true" />{nomOrgAffiche}
                </span>
                <input type="hidden" {...register('organisationId')} />
                <Erreur id="af-org-err">{errors.organisationId?.message}</Erreur>
              </div>
            )}

            <div className="dg-champ">
              <span id="af-statut-l">Statut</span>
              <div className="dg-segment af-statut" role="radiogroup" aria-labelledby="af-statut-l">
                {[{ v: 'active', l: 'Actif' }, { v: 'inactive', l: 'Inactif' }].map((s) => (
                  <label key={s.v} className={statutChoisi === s.v ? 'is-on' : ''}>
                    <input type="radio" value={s.v} disabled={envoi} {...register('status')} />
                    {s.l}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </form>
      </>
        );
      }}
    </Dialogue>
  );
};

export const AgentFormModal = () => {
  const { formModal } = useAgentsContext();
  return formModal.open ? <FenetreAgent /> : null;
};

export default AgentFormModal;
