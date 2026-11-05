import React from 'react';
import { CloseCircle, ArrowDown2 } from 'iconsax-react';
import { useOrganisationsContext } from '../context/OrganisationsContext';
import { SECTORS, TYPES, COUNTRIES } from '../data/organisations';
import { Dialogue } from '../../../components/molecules/Dialogue';
import { PastilleOrganisation } from '../PastilleOrganisation';
import { COULEURS_ORGANISATION } from '../libelles';

const IcoBatiment = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 10h.01M15 10h.01" />
  </svg>
);

const IcoInfo = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16v.5" />
  </svg>
);

const Erreur = ({ id, children }) => (children ? <span id={id} className="dg-erreur"><IcoInfo />{children}</span> : null);

/** Liste déroulante native, habillée comme un champ du dialogue. */
const Choix = ({ id, libelle, valeur, onChange, options, erreur, disabled }) => (
  <label className="dg-champ" htmlFor={id}>
    {libelle}
    <span className={`of-choix ${erreur ? 'is-ko' : ''} ${valeur ? '' : 'is-vide'}`}>
      <select id={id} value={valeur} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-invalid={Boolean(erreur)} aria-describedby={erreur ? `${id}-err` : undefined}>
        <option value="">Choisir</option>
        {options.map((o) => <option key={o.en} value={o.en}>{o.fr}</option>)}
      </select>
      <ArrowDown2 size={14} color="currentColor" aria-hidden="true" />
    </span>
    <Erreur id={`${id}-err`}>{erreur}</Erreur>
  </label>
);

const FormOrganisationModal = () => {
  const {
    formModal, closeFormModal, modalAlert, form, formErrors,
    setField, handlePhotoChange, removePhoto, isSubmitting, handleSubmit,
  } = useOrganisationsContext();

  if (!formModal.open) return null;

  const creation = formModal.mode === 'create';
  const nbErreurs = Object.values(formErrors).filter(Boolean).length;
  const couleurs = COULEURS_ORGANISATION.includes(form.color) ? COULEURS_ORGANISATION : [form.color, ...COULEURS_ORGANISATION];

  return (
    <Dialogue
      onClose={closeFormModal}
      verrouille={isSubmitting}
      taille="lg"
      titre={creation ? 'Nouvelle organisation' : 'Modifier l’organisation'}
      sousTitre={creation ? 'Elle pourra prendre en charge des signalements et être invitée en collaboration.' : form.name}
      icone={<IcoBatiment />}
      pied={({ close }) => (
        <>
          {nbErreurs > 0 ? (
            <span className="dg-pied-info is-ko" role="status"><IcoInfo />{nbErreurs} champ{nbErreurs > 1 ? 's' : ''} à compléter</span>
          ) : <span className="dg-espace" />}
          <button type="button" className="dg-btn dg-btn-g" onClick={close} disabled={isSubmitting}>Annuler</button>
          <button type="submit" form="form-organisation" className="dg-btn dg-btn-p" disabled={isSubmitting}>
            {isSubmitting
              ? <><span className="dg-spin" aria-hidden="true" />{creation ? 'Création…' : 'Enregistrement…'}</>
              : (creation ? 'Créer l’organisation' : 'Enregistrer')}
          </button>
        </>
      )}
    >
      {modalAlert.message && modalAlert.type !== 'success' && (
        <div className="dg-alerte dg-alerte-ko" role="alert">
          <CloseCircle size={18} variant="Bold" color="currentColor" /><span>{modalAlert.message}</span>
        </div>
      )}

      <form id="form-organisation" className="of-form" noValidate onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <fieldset className="dg-fieldset">
          <legend className="of-legende">Identité</legend>
          <div className="of-identite">
            <PastilleOrganisation org={{ ...form, name: form.name || '?' }} taille={64} />
            <div className="of-logo">
              <div className="of-logo-actions">
                <label className="dg-btn dg-btn-g dg-btn-s">
                  {form.logo_url ? 'Changer le logo' : 'Ajouter un logo'}
                  <input type="file" accept="image/*" className="dg-masque" onChange={handlePhotoChange} disabled={isSubmitting} />
                </label>
                {form.logo_url && <button type="button" className="dg-btn dg-btn-texte is-ko dg-btn-s" onClick={removePhoto} disabled={isSubmitting}>Retirer</button>}
              </div>
              <small>{form.logo_url ? 'JPG, PNG ou SVG, 2 Mo au plus.' : 'Sans logo, le sigle s’affiche sur cette couleur.'}</small>
            </div>
            {!form.logo_url && (
              <div className="of-couleurs" role="radiogroup" aria-label="Couleur de la pastille">
                {couleurs.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={form.color === c}
                    aria-label={`Couleur ${c}`}
                    className={form.color === c ? 'is-on' : ''}
                    style={{ backgroundColor: c }}
                    onClick={() => setField('color', c)}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="of-nom">
            <label className="dg-champ" htmlFor="of-nom">
              Nom complet
              <input
                id="of-nom" data-autofocus type="text" className="dg-input" value={form.name}
                onChange={(e) => setField('name', e.target.value)} placeholder="Ex. : Croix-Rouge sénégalaise"
                aria-invalid={Boolean(formErrors.name)} aria-describedby={formErrors.name ? 'of-nom-err' : undefined} disabled={isSubmitting}
              />
              <Erreur id="of-nom-err">{formErrors.name}</Erreur>
            </label>
            <label className="dg-champ" htmlFor="of-sigle">
              Sigle
              <input
                id="of-sigle" type="text" className="dg-input" value={form.acronym} maxLength={6}
                onChange={(e) => setField('acronym', e.target.value.toUpperCase())} placeholder="CRS"
                aria-invalid={Boolean(formErrors.acronym)} disabled={isSubmitting}
              />
              <Erreur id="of-sigle-err">{formErrors.acronym}</Erreur>
            </label>
          </div>
        </fieldset>

        <fieldset className="dg-fieldset">
          <legend className="of-legende">Activité</legend>
          <div className="of-grille3">
            <Choix id="of-secteur" libelle="Secteur" valeur={form.sector} onChange={(v) => setField('sector', v)} options={SECTORS} erreur={formErrors.sector} disabled={isSubmitting} />
            <Choix id="of-type" libelle="Type" valeur={form.type} onChange={(v) => setField('type', v)} options={TYPES} erreur={formErrors.type} disabled={isSubmitting} />
            <Choix id="of-pays" libelle="Pays d’intervention" valeur={form.country} onChange={(v) => setField('country', v)} options={COUNTRIES} erreur={formErrors.country} disabled={isSubmitting} />
          </div>
        </fieldset>

        <fieldset className="dg-fieldset">
          <legend className="of-legende">Contact <span className="dg-opt">facultatif</span></legend>
          <div className="dg-grille2">
            <label className="dg-champ" htmlFor="of-mail">
              E-mail
              <input id="of-mail" type="email" className="dg-input" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="contact@organisation.org" aria-invalid={Boolean(formErrors.email)} aria-describedby={formErrors.email ? 'of-mail-err' : undefined} disabled={isSubmitting} />
              <Erreur id="of-mail-err">{formErrors.email}</Erreur>
            </label>
            <label className="dg-champ" htmlFor="of-tel">
              Téléphone
              <input id="of-tel" type="tel" className="dg-input" value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+221 33 000 00 00" aria-invalid={Boolean(formErrors.phone)} disabled={isSubmitting} />
              <Erreur id="of-tel-err">{formErrors.phone}</Erreur>
            </label>
          </div>
          <label className="dg-champ" htmlFor="of-site">
            Site web
            <input id="of-site" type="url" className="dg-input" value={form.website} onChange={(e) => setField('website', e.target.value)} placeholder="https://www.organisation.org" aria-invalid={Boolean(formErrors.website)} disabled={isSubmitting} />
            <Erreur id="of-site-err">{formErrors.website}</Erreur>
          </label>
        </fieldset>

        <label className="dg-champ" htmlFor="of-desc">
          <span>Mandat et activités <span className="dg-opt">facultatif</span></span>
          <textarea id="of-desc" className="dg-textarea" rows={3} value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="Ce que fait l’organisation, ses zones et ses publics." disabled={isSubmitting} />
          <Erreur id="of-desc-err">{formErrors.description}</Erreur>
        </label>

        <label className="of-actif">
          <span>
            <b>Organisation active</b>
            <small>Une organisation inactive n’apparaît plus dans les invitations.</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="of-switch"
            checked={form.status === 'active'}
            onChange={(e) => setField('status', e.target.checked ? 'active' : 'inactive')}
            disabled={isSubmitting}
          />
        </label>
      </form>
    </Dialogue>
  );
};

export default FormOrganisationModal;
