import React, { useState, useMemo, useEffect } from 'react';
import { useRechercheDebouncee } from '../../hooks/useRechercheDebouncee';
import { FiltersBar } from '../../components/molecules/FiltersBar';
import useSWR from 'swr';
import { useSidebarState } from '../../hooks/useSidebarState';
import { Header, Sidebar } from '../../components/layout';
import {
  SearchNormal1, ArrowDown2, Add, Edit2, Trash,
  Buildings2, People, CloseCircle, TickCircle,
  Global, Call, Sms, Briefcase, ArrowLeft2, ArrowRight2
} from 'iconsax-react';
import {
  SECTORS, TYPES, COUNTRIES
} from './data/organisations';
import {
  createOrganisationService,
  deleteOrganisationService,
  updateOrganisationService,
  getOrganisationsService,
  getOrganisationStatsService
} from './service/organisation_service';
import './organisations.css';
import OrganisationsContext from './context/OrganisationsContext';
import FormOrganisationModal from './modal/FormOrganisationModal';
import DeleteOrganisationModal from './modal/DeleteOrganisationModal';
import { BlurryImage } from '../../components/atoms/BlurryImage';
import Pagination from '../../components/molecules/Pagination';

import { ResponsiveTable } from '../../components/molecules/ResponsiveTable';
import { COLONNES_ORGANISATIONS, mediaOrganisation, libellePays } from './colonnes';
import { TableActionsMenu } from '../../components/molecules/TableActionsMenu';
import { AVATAR_COLORS, AVATAR_COULEUR_DEFAUT } from '../../utils/couleursAvatar';
import { BandeauErreur } from '../../components/molecules/BandeauErreur';
const EMPTY_FORM = {
  name: '',
  acronym: '',
  color: 'var(--color-primary-text)',
  sector: '',
  type: '',
  country: '',
  city: '',
  phone: '',
  email: '',
  website: '',
  description: '',
  status: 'active',
  logo_url: null,
  logo: null,
};

export const Organisations = () => {
  const {
    isOpen: sidebarOpen,
    setOpen: setSidebarOpen,
    isCollapsed: sidebarCollapsed,
    setCollapsed: setSidebarCollapsed,
  } = useSidebarState();

  const [page, setPage] = useState(1);
  const pageSize = 20;

  const {
    saisie: searchInput,
    setSaisie: setSearchInput,
    recherche: search,
    reinitialiser: reinitialiserRecherche,
  } = useRechercheDebouncee();
  const [sectorFilter, setSectorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');


  // Reset page to 1 on filter/search change
  useEffect(() => {
    setPage(1);
  }, [search, sectorFilter, statusFilter, typeFilter]);

  const { data: rawOrgs, error: erreurOrgs, isLoading: swrLoading, mutate: mutateOrgs } = useSWR(
    ['organisation_list', page, search, sectorFilter, statusFilter, typeFilter],
    () => getOrganisationsService(page, pageSize, true, search, sectorFilter, statusFilter, typeFilter)
  );

  const { data: statsData, mutate: mutateStats } = useSWR(
    'organisation_stats',
    getOrganisationStatsService
  );

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
      phone: o.phone || '',
      email: o.email || '',
      website: o.website_url || '',
      description: o.description || '',
      status: o.partner_status || 'active',
      logo_url: o.logo || null,
      membersCount: o.members_count ?? 0,
      activeProjects: o.active_projects ?? 0,
    }));
  }, [rawOrgs]);

  // Modal create/edit
  const [formModal, setFormModal] = useState({ open: false, mode: 'create', org: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});

  // Modal delete
  const [deleteModal, setDeleteModal] = useState({ open: false, org: null });

  // Toast

  // Alertes pour les modals
  const [modalAlert, setModalAlert] = useState({ type: null, message: null });
  const [deleteAlert, setDeleteAlert] = useState({ type: null, message: null });

  // Animations
  const [formAnimating, setFormAnimating] = useState(false);
  const [deleteAnimating, setDeleteAnimating] = useState(false);

  // Soumission en cours
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Suppression en cours
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Stats ───────────────────────────────────────────────
  const statsActive = statsData?.active ?? 0;
  const statsTotal = statsData?.total ?? 0;
  const statsProjects = statsData?.incidents_taken_total ?? 0;

  // ── Filtrage ────────────────────────────────────────────
  const filtered = useMemo(() => {
    return orgs.filter((o) => {
      const q = search.toLowerCase();
      const matchSearch = !q || o.name.toLowerCase().includes(q)
        || o.acronym.toLowerCase().includes(q)
        || o.city.toLowerCase().includes(q)
        || libellePays(o.country).toLowerCase().includes(q)
        || o.country.toLowerCase().includes(q);
      const matchSector = !sectorFilter || o.sector === sectorFilter;
      const matchStatus = !statusFilter || o.status === statusFilter;
      const matchType = !typeFilter || o.type === typeFilter;
      return matchSearch && matchSector && matchStatus && matchType;
    });
  }, [orgs, search, sectorFilter, statusFilter, typeFilter]);





  // ── Ouvrir modal création ────────────────────────────────
  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalAlert({ type: null, message: null });
    setFormAnimating('opening');
    setFormModal({ open: true, mode: 'create', org: null });
    setTimeout(() => setFormAnimating(false), 350);
  };

  // ── Ouvrir modal édition ─────────────────────────────────
  const openEdit = (org, e) => {
    e?.stopPropagation();
    setForm({
      name: org.name,
      acronym: org.acronym,
      color: org.color,
      sector: org.sector,
      type: org.type,
      country: org.country,
      city: org.city,
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
    setFormAnimating('opening');
    setFormModal({ open: true, mode: 'edit', org });
    setTimeout(() => setFormAnimating(false), 350);
  };

  // ── Gestion de la photo ──────────────────────────────────
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setField('logo', file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setField('logo_url', ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (e) => {
    e?.stopPropagation();
    setField('logo_url', null);
    setField('logo', null);
  };

  // ── Fermer le modal form ─────────────────────────────────
  const closeFormModal = () => {
    if (isSubmitting) return;
    setFormAnimating('closing');
    setTimeout(() => {
      setFormModal({ open: false, mode: 'create', org: null });
      setFormAnimating(false);
      setModalAlert({ type: null, message: null });
    }, 320);
  };

  // ── Validation ───────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Le nom est requis.';

    if (!form.sector) errs.sector = 'Le secteur est requis.';
    if (!form.type) errs.type = 'Le type est requis.';
    if (!form.country) errs.country = 'Le pays est requis.';
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Email invalide.';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Soumettre le formulaire ──────────────────────────────
  const buildPayload = (formData) => {
    const subdomainVal = formData.name
      ? formData.name.trim().toLowerCase().replace(/\s+/g, '_')
      : '';

    const payload = {
      name: formData.name,
      acronym: formData.acronym || null,
      description: formData.description || null,
      activity_sector: formData.sector || null,
      organisation_type: formData.type || null,
      intervention_country: formData.country || null,
      partner_status: formData.status || 'active',
      phone: formData.phone || null,
      website_url: formData.website || null,
      primary_color: formData.color || AVATAR_COULEUR_DEFAUT,
      is_premium: true,
      members_count: 0,
      subdomain: subdomainVal,
      email: formData.email || null,
    };

    if (formData.logo) {
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
        setModalAlert({ type: 'success', message: 'Organisation créée avec succès !' });
      } else {
        await updateOrganisationService(formModal.org.id, payload);
        setModalAlert({ type: 'success', message: 'Organisation mise à jour avec succès !' });
      }
      mutateAll();
      setTimeout(() => {
        closeFormModal();
      }, 2000);
    } catch (err) {
      if (err?.response?.status === 400 && err?.response?.data && typeof err.response.data === 'object') {
        const backendErrors = err.response.data;
        const mappedErrors = {};

        // Map backend field names to frontend field names
        const keyMapping = {
          activity_sector: 'sector',
          organisation_type: 'type',
          intervention_country: 'country',
          website_url: 'website',
          partner_status: 'status',
        };

        Object.keys(backendErrors).forEach((backendKey) => {
          const frontendKey = keyMapping[backendKey] || backendKey;
          const errorMsg = Array.isArray(backendErrors[backendKey])
            ? backendErrors[backendKey].join(' ')
            : backendErrors[backendKey];
          mappedErrors[frontendKey] = errorMsg;
        });

        setFormErrors(mappedErrors);
        setModalAlert({
          type: 'danger',
          message: 'Veuillez corriger les erreurs de validation dans le formulaire.'
        });
      } else {
        const msg = err?.response?.data?.detail
          || err?.response?.data?.message
          || `Erreur lors de la ${formModal.mode === 'create' ? 'création' : 'modification'}. Veuillez réessayer.`;
        setModalAlert({ type: 'danger', message: msg });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Supprimer ────────────────────────────────────────────
  const openDelete = (org, e) => {
    e?.stopPropagation();
    setDeleteAlert({ type: null, message: null });
    setDeleteAnimating('opening');
    setDeleteModal({ open: true, org });
    setTimeout(() => setDeleteAnimating(false), 350);
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setDeleteAnimating('closing');
    setTimeout(() => {
      setDeleteModal({ open: false, org: null });
      setDeleteAnimating(false);
    }, 320);
  };

  const confirmDelete = async (e) => {
    e?.stopPropagation();
    setIsDeleting(true);
    setDeleteAlert({ type: null, message: null });

    try {
      await deleteOrganisationService(deleteModal.org.id);
      mutateAll();
      setDeleteAlert({ type: 'success', message: 'Organisation supprimée avec succès !' });
      setTimeout(() => {
        closeDeleteModal();
      }, 2000);
    } catch (err) {
      const msg = err?.response?.data?.detail
        || err?.response?.data?.message
        || 'Erreur lors de la suppression. Veuillez réessayer.';
      setDeleteAlert({ type: 'danger', message: msg });
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Champ form helper ────────────────────────────────────
  const setField = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (formErrors[key]) setFormErrors((e) => ({ ...e, [key]: undefined }));
  };

  const contextValue = {
    formModal, formAnimating, closeFormModal, modalAlert, form, formErrors,
    setField, handlePhotoChange, removePhoto, isSubmitting, handleSubmit,
    deleteModal, setDeleteModal, deleteAnimating, isDeleting, deleteAlert,
    closeDeleteModal, confirmDelete
  };

  const actionsDe = (org) => (
    <div className="orgs-row-actions">
      <TableActionsMenu
        ariaLabel={`Actions sur ${org.name || 'cette organisation'}`}
        actions={[
          { id: 'edit', label: 'Modifier', icon: Edit2, onSelect: () => openEdit(org) },
          { id: 'delete', label: 'Supprimer', icon: Trash, tone: 'danger', onSelect: () => openDelete(org) },
        ]}
      />
    </div>
  );

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
          <Header
            onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
            sidebarCollapsed={sidebarCollapsed}
          />

          <main className="orgs-content">
            <div className="orgs-page">

              <BandeauErreur
                erreur={erreurOrgs}
                onReessayer={mutateOrgs}
                message="Impossible de charger les organisations. La liste affichée peut ne plus être à jour."
              />

              {/* ── En-tête ── */}
              <div className="orgs-page-header">
                <div className="orgs-header-left">
                  <h1 className="orgs-title">Organisations</h1>
                  <p className="orgs-subtitle">Gérez les organisations partenaires de Map Action.</p>
                </div>
                <button className="orgs-add-btn" onClick={openCreate}>
                  <Add size={18} color='var(--color-surface)' />
                  Nouvelle organisation
                </button>
              </div>

              {/* ── Statistiques ── */}
              <div className="orgs-stats">
                <div className="orgs-stat">
                  <div className="orgs-stat-icon orgs-stat-icon-primary">
                    <Buildings2 size={20} variant="Bold" color="var(--color-primary)" />
                  </div>
                  <div>
                    <div className="orgs-stat-value">{statsTotal}</div>
                    <div className="orgs-stat-label">Total</div>
                  </div>
                </div>
                <div className="orgs-stat">
                  <div className="orgs-stat-icon orgs-stat-icon-success">
                    <TickCircle size={20} variant="Bold" color="var(--color-success)" />
                  </div>
                  <div>
                    <div className="orgs-stat-value">{statsActive}</div>
                    <div className="orgs-stat-label">Actives</div>
                  </div>
                </div>
                <div className="orgs-stat">
                  <div className="orgs-stat-icon orgs-stat-icon-warning">
                    <Briefcase size={20} variant="Bold" color="var(--color-warning)" />
                  </div>
                  <div>
                    <div className="orgs-stat-value">{statsProjects}</div>
                    <div className="orgs-stat-label">Nombre de signalements</div>
                  </div>
                </div>
              </div>

              {/* ── Toolbar — fixe au defilement : voir .orgs-filtres-fixes. ── */}
              <div className="orgs-filtres-fixes">
              <FiltersBar
                recherche={searchInput}
                onRecherche={setSearchInput}
                placeholder="Rechercher un nom, un acronyme, une ville, un pays…"
                selects={[
                  { id: 'secteur', valeur: sectorFilter, onChange: setSectorFilter,
                    ariaLabel: 'Filtrer par secteur', tousLabel: 'Tous les secteurs',
                    options: SECTORS.map((o) => ({ value: o.en, label: o.fr })) },
                  { id: 'type', valeur: typeFilter, onChange: setTypeFilter,
                    ariaLabel: 'Filtrer par type', tousLabel: 'Tous les types',
                    options: TYPES.map((o) => ({ value: o.en, label: o.fr })) },
                  { id: 'statut', valeur: statusFilter, onChange: setStatusFilter,
                    ariaLabel: 'Filtrer par statut', tousLabel: 'Tous les statuts',
                    options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
                ]}
                onEffacer={() => {
                  reinitialiserRecherche();
                  setSectorFilter(''); setTypeFilter(''); setStatusFilter('');
                }}
                resultats={filtered.length}
                nomResultat="organisation"
              />
              </div>

              {/* ── Tableau ── */}
              {filtered.length === 0 && !swrLoading ? (
                <div className="orgs-empty">
                  <div className="orgs-empty-icon">
                    <Buildings2 size={48} variant="Linear" color="var(--color-border)" />
                  </div>
                  <p>Aucune organisation ne correspond à vos critères.</p>
                </div>
              ) : (
                <ResponsiveTable
                  colonnes={COLONNES_ORGANISATIONS}
                  media={mediaOrganisation}
                  donnees={filtered}
                  cleDe={(o) => o.id}
                  actions={actionsDe}
                  chargement={swrLoading}
                  classeTable="orgs-table"
                  classeWrap="orgs-table-wrap"
                  libelleListe="Organisations"
                />
              )}

              <Pagination
                page={page}
                pageSize={pageSize}
                count={rawOrgs?.count || 0}
                onChange={setPage}
              />

            </div>
          </main>
        </div>

        {/* ── Modals ── */}
        <FormOrganisationModal key={"FormOgrnasationKey"} />
        <DeleteOrganisationModal key={"DeleteOrganisationModalKey"} />

      </div>
    </OrganisationsContext.Provider>
  );
};

export default Organisations;
