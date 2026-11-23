import React, { useState, useMemo, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { Add, Edit2, Trash, SearchNormal1, ArrowDown2, Buildings2, Filter } from 'iconsax-react';
import { ShimmerThumbnail, ShimmerText } from 'react-shimmer-effects';
import { useRechercheDebouncee } from '../../hooks/useRechercheDebouncee';
import { useSidebarState } from '../../hooks/useSidebarState';
import { Header, Sidebar } from '../../components/layout';
import { SECTORS, TYPES } from './data/organisations';
import {
  createOrganisationService,
  deleteOrganisationService,
  updateOrganisationService,
  getOrganisationsService,
  getOrganisationStatsService,
} from './service/organisation_service';
import OrganisationsContext from './context/OrganisationsContext';
import FormOrganisationModal from './modal/FormOrganisationModal';
import DeleteOrganisationModal from './modal/DeleteOrganisationModal';
import { PastilleOrganisation } from './PastilleOrganisation';
import Pagination from '../../components/molecules/Pagination';
import { TableActionsMenu } from '../../components/molecules/TableActionsMenu';
import { BandeauErreur } from '../../components/molecules/BandeauErreur';
import { AVATAR_COULEUR_DEFAUT } from '../../utils/couleursAvatar';
import { libelleSecteur, libelleType, libellePays, nombreFr, COULEURS_ORGANISATION } from './libelles';
import { useEstTelephone } from '../incident/mobile/useEstTelephone';
import { FeuilleBasse } from '../collaboration/mobile/FeuilleBasse';
import './organisations.css';
import './organisations-liste.css';
import './mobile/annuaire-mobile.css';

const EMPTY_FORM = {
  name: '',
  acronym: '',
  color: AVATAR_COULEUR_DEFAUT,
  sector: '',
  type: '',
  country: '',
  phone: '',
  email: '',
  website: '',
  description: '',
  status: 'active',
  logo_url: null,
  logo: null,
};

const STATUTS = [
  { valeur: '', libelle: 'Toutes' },
  { valeur: 'active', libelle: 'Actives' },
  { valeur: 'inactive', libelle: 'Inactives' },
];

/** Liste déroulante de filtre, marquée quand elle filtre. */
const Filtre = ({ libelle, valeur, onChange, options }) => {
  const actif = Boolean(valeur);
  const choisi = options.find((o) => o.en === valeur);
  return (
    <label className={`og-filtre ${actif ? 'is-on' : ''}`}>
      <span aria-hidden="true">{libelle} : {choisi ? choisi.fr : 'tous'}</span>
      <ArrowDown2 size={14} color="currentColor" aria-hidden="true" />
      <select value={valeur} onChange={(e) => onChange(e.target.value)} aria-label={`Filtrer par ${libelle.toLowerCase()}`}>
        <option value="">{libelle} : tous</option>
        {options.map((o) => <option key={o.en} value={o.en}>{o.fr}</option>)}
      </select>
    </label>
  );
};

export const Organisations = () => {
  const {
    isOpen: sidebarOpen,
    setOpen: setSidebarOpen,
    isCollapsed: sidebarCollapsed,
    setCollapsed: setSidebarCollapsed,
  } = useSidebarState();

  const estTelephone = useEstTelephone();
  const [fiche, setFiche] = useState(null);
  const [filtresOuverts, setFiltresOuverts] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { saisie: searchInput, setSaisie: setSearchInput, recherche: search } = useRechercheDebouncee();
  const [sectorFilter, setSectorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767.98px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767.98px)');
    const maj = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', maj);
    return () => mq.removeEventListener('change', maj);
  }, []);

  // L'en-tête de la page reste collé sous celui de l'application au
  // défilement ; une ombre légère n'apparaît qu'une fois collé.
  // Le repère est un élément vide posé juste avant la barre : lui ne bouge pas
  // quand la barre se colle, sa position reste donc une référence fiable.
  const repereRef = useRef(null);
  const [colle, setColle] = useState(false);
  const surDefilement = (e) => {
    const repere = repereRef.current;
    if (repere) setColle(e.currentTarget.scrollTop > repere.offsetTop - 60);
  };

  // Retour à la première page dès qu'un filtre change.
  useEffect(() => {
    setPage(1);
  }, [search, sectorFilter, statusFilter, typeFilter]);

  // Tous les filtres sont appliqués par le serveur : le total qu'il renvoie
  // est donc celui de la recherche, pas celui de la page affichée.
  const { data: rawOrgs, error: erreurOrgs, isLoading: swrLoading, mutate: mutateOrgs } = useSWR(
    ['organisation_list', page, search, sectorFilter, statusFilter, typeFilter],
    () => getOrganisationsService(page, pageSize, true, search, sectorFilter, statusFilter, typeFilter),
    { keepPreviousData: true },
  );

  const { data: statsData, mutate: mutateStats } = useSWR('organisation_stats', getOrganisationStatsService);

  const mutateAll = () => {
    mutateOrgs();
    mutateStats();
  };

  const orgs = useMemo(() => {
    const results = rawOrgs?.results || (Array.isArray(rawOrgs) ? rawOrgs : []);
    return results.map((o) => ({
      id: o.id,
      name: o.name,
      acronym: o.acronym || '',
      color: o.primary_color || AVATAR_COULEUR_DEFAUT,
      sector: o.activity_sector || '',
      type: o.organisation_type || '',
      country: o.intervention_country || '',
      // ATTENTION — ce n'est pas une ville. L'API ne renvoie aucun champ de
      // localite ; `subdomain` a ete branche ici comme bouche-trou. La colonne
      // « Localisation » affiche donc un identifiant technique du genre
      // « direction_régionale_de_l'hydraulique_(ménaka) » a cote du pays.
      // A remplacer des qu'un vrai champ ville existe cote backend.
      city: o.subdomain || '',
      subdomain: o.subdomain || '',
      phone: o.phone || '',
      email: o.email || '',
      website: o.website_url || '',
      description: o.description || '',
      status: o.partner_status || 'active',
      logo_url: o.logo || null,
      membersCount: o.members_count ?? 0,
      // L'API renvoie `incidents_taken_count` ; `active_projects` n'existe pas
      // dans la réponse (vérifié le 29/10/2026), d'où une colonne toujours à 0.
      activeProjects: o.incidents_taken_count ?? o.active_projects ?? 0,
    }));
  }, [rawOrgs]);

  const total = rawOrgs?.count ?? orgs.length;
  const compteurs = {
    '': statsData?.total,
    active: statsData?.active,
    inactive: statsData ? (statsData.inactive ?? Math.max((statsData.total ?? 0) - (statsData.active ?? 0), 0)) : undefined,
  };

  // ── Fenêtres ─────────────────────────────────────────────
  const [formModal, setFormModal] = useState({ open: false, mode: 'create', org: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [modalAlert, setModalAlert] = useState({ type: null, message: null });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteModal, setDeleteModal] = useState({ open: false, org: null });
  const [deleteAlert, setDeleteAlert] = useState({ type: null, message: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const [toast, setToast] = useState(null);
  const afficherToast = (texte) => setToast({ texte, n: Date.now() });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalAlert({ type: null, message: null });
    setFormModal({ open: true, mode: 'create', org: null });
  };

  const openEdit = (org) => {
    setForm({
      name: org.name,
      acronym: org.acronym,
      color: org.color,
      sector: org.sector,
      type: org.type,
      country: org.country,
      phone: org.phone,
      email: org.email,
      website: org.website,
      description: org.description,
      status: org.status,
      logo_url: org.logo_url || null,
      logo: null,
    });
    setFormErrors({});
    setModalAlert({ type: null, message: null });
    setFormModal({ open: true, mode: 'edit', org });
  };

  const closeFormModal = () => {
    setFormModal({ open: false, mode: 'create', org: null });
    setModalAlert({ type: null, message: null });
  };

  const setField = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (formErrors[key]) setFormErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setField('logo', file);
    const reader = new FileReader();
    reader.onload = (ev) => setField('logo_url', ev.target.result);
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setField('logo_url', null);
    setField('logo', null);
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Indiquez le nom de l’organisation.';
    if (!form.sector) errs.sector = 'Choisissez un secteur.';
    if (!form.type) errs.type = 'Choisissez un type.';
    if (!form.country) errs.country = 'Choisissez le pays d’intervention.';
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Cette adresse e-mail n’est pas valide.';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const buildPayload = (formData) => {
    // Nettoyer et normaliser le sous-domaine
    const rawName = formData.name || '';
    const cleanSubdomain = rawName
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 50);

    // En édition, préserver le sous-domaine existant
    const subdomain = formModal.mode === 'edit' && (formModal.org?.subdomain || formModal.org?.city)
      ? (formModal.org.subdomain || formModal.org.city)
      : (cleanSubdomain || 'organisation');

    // Valider et normaliser l'URL du site web si saisie
    let formattedWebsite = null;
    if (formData.website && formData.website.trim()) {
      const site = formData.website.trim();
      formattedWebsite = site.startsWith('http://') || site.startsWith('https://')
        ? site
        : `https://${site}`;
    }

    // Valider que la couleur est un code hex valide (#RRGGBB)
    const validColor = formData.color && /^#[0-9A-Fa-f]{6}$/.test(formData.color)
      ? formData.color
      : AVATAR_COULEUR_DEFAUT;

    const payload = {
      name: formData.name.trim(),
      acronym: formData.acronym?.trim() || null,
      description: formData.description?.trim() || '',
      activity_sector: formData.sector,
      organisation_type: formData.type,
      intervention_country: formData.country,
      partner_status: formData.status || 'active',
      phone: formData.phone?.trim() || null,
      website_url: formattedWebsite,
      primary_color: validColor,
      is_premium: true,
      subdomain,
    };

    if (formData.email?.trim()) {
      payload.email = formData.email.trim();
    }

    if (formData.logo instanceof File || formData.logo instanceof Blob) {
      payload.logo = formData.logo;
    } else if (formData.logo_url === null) {
      payload.logo = null;
    }

    return payload;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    setModalAlert({ type: null, message: null });
    try {
      const payload = buildPayload(form);
      if (formModal.mode === 'create') {
        await createOrganisationService(payload);
        afficherToast(`${form.name} est créée`);
      } else {
        await updateOrganisationService(formModal.org.id, payload);
        afficherToast('Modifications enregistrées');
      }
      mutateAll();
      closeFormModal();
    } catch (err) {
      if (err?.response?.status === 400 && err?.response?.data && typeof err.response.data === 'object') {
        const correspondance = {
          activity_sector: 'sector',
          organisation_type: 'type',
          intervention_country: 'country',
          website_url: 'website',
          partner_status: 'status',
        };

        const fieldLabels = {
          name: 'Nom',
          acronym: 'Acronyme',
          sector: "Secteur d'activité",
          type: "Type d'organisation",
          country: 'Pays',
          website: 'Site web',
          phone: 'Téléphone',
          email: 'Email',
          description: 'Description',
          status: 'Statut',
          subdomain: 'Sous-domaine / Nom',
          primary_color: 'Couleur',
          logo: 'Logo',
        };

        const errorDetails = [];

        const erreurs = {};

        Object.keys(err.response.data).forEach((backendKey) => {
          const frontendKey = correspondance[backendKey] || backendKey;
          const rawErr = err.response.data[backendKey];
          const errorMsg = Array.isArray(rawErr)
            ? rawErr.join(' ')
            : typeof rawErr === 'object'
              ? JSON.stringify(rawErr)
              : String(rawErr);

          erreurs[frontendKey] = errorMsg;
          const label = fieldLabels[frontendKey] || frontendKey;
          errorDetails.push(`${label} : ${errorMsg}`);
        });

        setFormErrors(erreurs);

        const alertMessage = errorDetails.length > 0
          ? `Erreur de validation : ${errorDetails.join(' — ')}`
          : 'Veuillez corriger les erreurs de validation dans le formulaire.';

        setModalAlert({
          type: 'danger',
          message: alertMessage,
        });
      } else {
        const msg = err?.response?.data?.detail || err?.response?.data?.message
          || `L’organisation n’a pas pu être ${formModal.mode === 'create' ? 'créée' : 'modifiée'}. Réessayez dans un instant.`;
        setModalAlert({ type: 'danger', message: msg });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDelete = (org) => {
    setDeleteAlert({ type: null, message: null });
    setDeleteModal({ open: true, org });
  };

  const closeDeleteModal = () => setDeleteModal({ open: false, org: null });

  const confirmDelete = async (close) => {
    setIsDeleting(true);
    setDeleteAlert({ type: null, message: null });
    try {
      await deleteOrganisationService(deleteModal.org.id);
      afficherToast(`${deleteModal.org.name} est supprimée`);
      mutateAll();
      close();
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.message
        || 'L’organisation n’a pas pu être supprimée. Réessayez dans un instant.';
      setDeleteAlert({ type: 'danger', message: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  const contextValue = {
    formModal, closeFormModal, modalAlert, form, formErrors,
    setField, handlePhotoChange, removePhoto, isSubmitting, handleSubmit,
    deleteModal, isDeleting, deleteAlert, closeDeleteModal, confirmDelete, openEdit,
  };

  const actionsDe = (org) => (
    <TableActionsMenu
      ariaLabel={`Actions sur ${org.name || 'cette organisation'}`}
      actions={[
        { id: 'edit', label: 'Modifier', icon: Edit2, onSelect: () => openEdit(org) },
        { id: 'delete', label: 'Supprimer', icon: Trash, tone: 'danger', onSelect: () => openDelete(org) },
      ]}
    />
  );

  const filtreActif = Boolean(search || sectorFilter || typeFilter);
  const nomType = TYPES.find((t) => t.en === typeFilter)?.fr;
  const annonce = swrLoading
    ? 'Chargement…'
    : `${nombreFr(total)} ${nomType && !sectorFilter && !search ? nomType : `organisation${total > 1 ? 's' : ''}`}`;

  const vide = !swrLoading && orgs.length === 0;

  return (
    <OrganisationsContext.Provider value={contextValue}>
      <div className="orgs-layout">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />

        <div className={`orgs-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          {!estTelephone && <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} sidebarCollapsed={sidebarCollapsed} />}

          <main className="og" onScroll={surDefilement}>
            <BandeauErreur
              erreur={erreurOrgs}
              onReessayer={mutateOrgs}
              message="Impossible de charger les organisations. La liste affichée peut ne plus être à jour."
            />

            {/* L'en-tête de la page — titre, onglets, recherche et filtres — reste
                fixe au défilement : seul le tableau passe dessous. */}
            <div ref={repereRef} aria-hidden="true" className="og-repere" />
            <div className={`og-entete ${colle ? 'is-colle' : ''}`}>
              <div className="og-tete">
                <div>
                  <h1>Organisations</h1>
                  <p>Les partenaires qui interviennent sur les signalements de Map Action.</p>
                </div>
                <button type="button" className="og-btn-p" onClick={openCreate} aria-label={isMobile ? 'Nouvelle organisation' : undefined}>
                  <Add size={18} color="currentColor" />
                  {!isMobile && 'Nouvelle organisation'}
                </button>
              </div>

              <div className={isMobile ? 'og-statuts-pastilles' : 'og-statuts'} role="tablist" aria-label="Statut">
                {STATUTS.map((s) => {
                  const actif = statusFilter === s.valeur;
                  const n = compteurs[s.valeur];
                  return (
                    <button key={s.valeur || 'toutes'} type="button" role="tab" aria-selected={actif} className={actif ? 'is-on' : ''} onClick={() => setStatusFilter(s.valeur)}>
                      {s.libelle}
                      {n !== undefined && (isMobile ? ` · ${nombreFr(n)}` : <span className="og-n">{nombreFr(n)}</span>)}
                    </button>
                  );
                })}
              </div>

              <div className="og-outils">
                <label className="og-recherche">
                  <SearchNormal1 size={16} color="currentColor" aria-hidden="true" />
                  <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Nom ou sigle" aria-label="Rechercher une organisation" />
                </label>
                <Filtre libelle="Secteur" valeur={sectorFilter} onChange={setSectorFilter} options={SECTORS} />
                <Filtre libelle="Type" valeur={typeFilter} onChange={setTypeFilter} options={TYPES} />
                {estTelephone && (
                  <button type="button" className={`vlm-filtre ${sectorFilter || typeFilter ? 'is-on' : ''}`} onClick={() => setFiltresOuverts(true)} aria-label="Filtres">
                    <Filter size={18} color="currentColor" aria-hidden="true" />
                  </button>
                )}
                {(filtreActif || statusFilter) && <span className="og-annonce" role="status">{annonce}</span>}
              </div>
            </div>

            {vide ? (
              <div className="og-boite og-vide">
                <span className="og-vide-ic"><Buildings2 size={22} color="currentColor" /></span>
                <b>Aucune organisation</b>
                <p>{filtreActif ? 'Aucun résultat avec ces critères. Modifiez la recherche ou les filtres.' : 'Ajoutez la première organisation partenaire pour qu’elle puisse agir sur les signalements.'}</p>
                {!filtreActif && <button type="button" className="og-btn-p" onClick={openCreate}><Add size={18} color="currentColor" />Nouvelle organisation</button>}
              </div>
            ) : estTelephone ? (
              <ul className="anm-liste">
                {swrLoading && !orgs.length ? [0, 1, 2].map((n) => <li key={n} className="anm-squelette"><ShimmerText line={2} gap={8} /></li>) : orgs.map((o) => (
                  <li key={o.id}>
                    <button type="button" className={`anm-ligne ${o.status === 'active' ? '' : 'is-inactif'}`} onClick={() => setFiche(o)}>
                      <PastilleOrganisation org={o} taille={44} />
                      <span className="anm-t">
                        <b>{o.name}</b>
                        <span>{[libelleType(o.type), libelleSecteur(o.sector), libellePays(o.country)].filter(Boolean).join(' · ')}</span>
                        <span>{nombreFr(o.membersCount)} membres · {o.status === 'active' ? `${nombreFr(o.activeProjects)} signalements` : 'Inactive'}</span>
                      </span>
                      <span className="anm-chevron" aria-hidden="true">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : isMobile ? (
              <div className="og-cartes">
                {swrLoading && !orgs.length ? [0, 1, 2].map((n) => <div key={n} className="og-carte"><ShimmerText line={3} gap={8} /></div>) : orgs.map((o) => (
                  <article key={o.id} className="og-carte">
                    <div className="og-carte-tete">
                      <PastilleOrganisation org={o} taille={44} />
                      <span className="og-carte-t">
                        <b>{o.name}</b>
                        <span>{[libelleType(o.type), libelleSecteur(o.sector), libellePays(o.country)].filter(Boolean).join(' · ')}</span>
                      </span>
                      {actionsDe(o)}
                    </div>
                    <div className="og-carte-pied">
                      <span><b>{nombreFr(o.membersCount)}</b> membres</span>
                      <span><b>{nombreFr(o.activeProjects)}</b> signalements</span>
                      <span className={`og-statut is-${o.status}`}><i aria-hidden="true" />{o.status === 'active' ? 'Active' : 'Inactive'}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="og-boite og-tableau-boite">
                <table className="og-tableau">
                  <thead>
                    <tr>
                      <th scope="col">Organisation</th>
                      <th scope="col">Secteur</th>
                      <th scope="col">Pays d'intervention</th>
                      <th scope="col">Contact</th>
                      <th scope="col" className="is-num">Membres</th>
                      <th scope="col" className="is-num">Signalements pris en charge</th>
                      <th scope="col">Statut</th>
                      <th scope="col"><span className="og-masque">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {swrLoading && !orgs.length ? [0, 1, 2, 3, 4].map((n) => (
                      <tr key={n}><td colSpan={8}><div className="og-squelette"><ShimmerThumbnail height={40} width={40} rounded className="m-0" /><div style={{ flex: 1 }}><ShimmerText line={2} gap={8} /></div></div></td></tr>
                    )) : orgs.map((o) => (
                      <tr key={o.id} className="og-ligne">
                        <td>
                          <div className="og-org">
                            <PastilleOrganisation org={o} />
                            <div>
                              <b>{o.name}</b>
                              <span>{[o.acronym, libelleType(o.type)].filter(Boolean).join(' · ')}</span>
                            </div>
                          </div>
                        </td>
                        <td className="og-doux">{libelleSecteur(o.sector) || '—'}</td>
                        <td className="og-doux">{libellePays(o.country) || '—'}</td>
                        <td>
                          <div className="og-contact">
                            {o.email ? <a href={`mailto:${o.email}`}>{o.email}</a> : <span className="og-absent">Aucun e-mail</span>}
                            <span className="og-absent">{o.phone || '—'}</span>
                          </div>
                        </td>
                        <td className="is-num">{nombreFr(o.membersCount)}</td>
                        <td className="is-num">{nombreFr(o.activeProjects)}</td>
                        <td><span className={`og-statut is-${o.status}`}><i aria-hidden="true" />{o.status === 'active' ? 'Active' : 'Inactive'}</span></td>
                        <td className="og-actions">{actionsDe(o)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!vide && total > pageSize && (
              <div className="og-pied">
                <span>{`${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} sur ${nombreFr(total)}`}</span>
                <Pagination page={page} pageSize={pageSize} count={total} onChange={setPage} />
              </div>
            )}
          </main>
        </div>

        {fiche && (
          <FeuilleBasse ariaLabel={fiche.name} onClose={() => setFiche(null)}>
            <div className="anm-fiche">
              <div className="anm-fiche-tete">
                <PastilleOrganisation org={fiche} taille={52} />
                <div>
                  <h2>{fiche.name}</h2>
                  <span>{[fiche.acronym, fiche.status === 'active' ? 'Active' : 'Inactive'].filter(Boolean).join(' · ')}</span>
                </div>
              </div>
              <div className="anm-bloc">
                {[['Type', libelleType(fiche.type)], ['Secteur', libelleSecteur(fiche.sector)], ['Pays', libellePays(fiche.country)], ['Membres', nombreFr(fiche.membersCount)], ['Signalements pris en charge', nombreFr(fiche.activeProjects)]]
                  .filter(([, v]) => v)
                  .map(([k, v]) => <div key={k} className="anm-kv"><span>{k}</span><b>{v}</b></div>)}
              </div>
              {(fiche.email || fiche.phone || fiche.website) && (
                <div className="anm-bloc">
                  <h3>Contact</h3>
                  {fiche.email && <a href={`mailto:${fiche.email}`}>{fiche.email}</a>}
                  {fiche.phone && <a href={`tel:${fiche.phone}`}>{fiche.phone}</a>}
                  {fiche.website && <a href={fiche.website} target="_blank" rel="noreferrer">{fiche.website}</a>}
                </div>
              )}
              {fiche.description && <p className="anm-texte">{fiche.description}</p>}
              <div className="anm-duo">
                <button type="button" className="vlm-btn vlm-btn-g" onClick={() => { const o = fiche; setFiche(null); openEdit(o); }}>Modifier</button>
                <button type="button" className="vlm-btn vlm-btn-g anm-danger" onClick={() => { const o = fiche; setFiche(null); openDelete(o); }}>Supprimer</button>
              </div>
            </div>
          </FeuilleBasse>
        )}

        {filtresOuverts && (
          <FeuilleBasse ariaLabel="Filtres" onClose={() => setFiltresOuverts(false)}>
            <div className="vlm-filtres-tete">
              <button type="button" onClick={() => { setSectorFilter(''); setTypeFilter(''); }}>Tout effacer</button>
              <b>Filtres</b>
              <button type="button" onClick={() => setFiltresOuverts(false)}>Terminé</button>
            </div>
            <div className="vlm-filtres">
              <label className="vlm-champ">
                Secteur
                <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}>
                  <option value="">Tous</option>
                  {SECTORS.map((o) => <option key={o.en} value={o.en}>{o.fr}</option>)}
                </select>
              </label>
              <label className="vlm-champ">
                Type
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  <option value="">Tous</option>
                  {TYPES.map((o) => <option key={o.en} value={o.en}>{o.fr}</option>)}
                </select>
              </label>
            </div>
          </FeuilleBasse>
        )}

        <FormOrganisationModal />
        <DeleteOrganisationModal />
        {toast && <div key={toast.n} className="og-toast" role="status">{toast.texte}</div>}
      </div>
    </OrganisationsContext.Provider>
  );
};

export default Organisations;
