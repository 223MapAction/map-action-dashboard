import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import useSWRInfinite from 'swr/infinite';
import debounce from 'lodash.debounce';
import { TickCircle, Danger } from 'iconsax-react';
import { useCollaborationDetail } from '../context/collaborationDetailContexte';
import { getOtherOrganisationsService } from '../service/collab_detail_service';
import { Dialogue } from '../../../components/molecules/Dialogue';
import { AVATAR_COULEUR_DEFAUT } from '../../../utils/couleursAvatar';
import { IcoInviter, IcoCroix, IcoInfo, IcoLoupe } from './icones';

const PAGE = 10;

const initiales = (org) => (org.acronym || org.name || 'OR').substring(0, 2).toUpperCase();
const couleur = (org) => org.primary_color || AVATAR_COULEUR_DEFAUT;

const Avatar = ({ org }) => (
  <span className="so-av" style={{ backgroundColor: couleur(org) }} aria-hidden="true">{initiales(org)}</span>
);

/**
 * Inviter (leader) ou suggérer (contributeur) des organisations partenaires.
 * Le leader invite directement ; un contributeur propose, le leader tranche.
 */
export const SuggestOrgModal = () => {
  const {
    collaboration,
    showSuggestModal,
    suggestModalClosing,
    closeSuggestModal,
    suggestSearch,
    setSuggestSearch,
    suggestedOrgs,
    toggleSuggestedOrg,
    updateSuggestedRole,
    updateSuggestedComment,
    suggestAlert,
    suggestSubmitting,
    handleSuggestSubmit,
    ROLE_OPTIONS,
  } = useCollaborationDetail();

  const zoneRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [listeOuverte, setListeOuverte] = useState(false);
  // Les explications manquantes ne s'affichent en erreur qu'après une tentative
  // d'envoi : signaler un champ vide qu'on n'a pas encore eu le temps de remplir
  // est une réprimande, pas une aide.
  const [tentative, setTentative] = useState(false);

  const debouncedSetSearch = useMemo(() => debounce((v) => setDebouncedSearch(v), 300), []);
  useEffect(() => {
    debouncedSetSearch(suggestSearch);
    return () => debouncedSetSearch.cancel();
  }, [suggestSearch, debouncedSetSearch]);

  // Modale fermée : aucune requête. Le `return null` du rendu n'empêche pas
  // les hooks de tourner, la liste se chargeait donc en pure perte.
  const getKey = useCallback((index, precedente) => {
    if (!showSuggestModal) return null;
    if (precedente && !precedente.next) return null;
    return ['other-organisations', debouncedSearch, index + 1];
  }, [showSuggestModal, debouncedSearch]);

  const fetcher = useCallback(([, recherche, page]) => {
    const params = { page, page_size: PAGE };
    if (recherche.trim()) params.search = recherche.trim();
    return getOtherOrganisationsService(params);
  }, []);

  const { data: pages, error, size, setSize, isLoading, isValidating } = useSWRInfinite(getKey, fetcher, {
    revalidateOnFocus: false,
    revalidateFirstPage: false,
    keepPreviousData: true,
  });

  useEffect(() => { setSize(1); }, [debouncedSearch, setSize]);

  const organisations = useMemo(() => {
    const vus = new Set();
    return (pages || []).flatMap((p) => p?.results ?? []).filter((o) => !vus.has(o.id) && vus.add(o.id));
  }, [pages]);

  const encore = Boolean(pages?.[pages.length - 1]?.next);
  const chargementInitial = isLoading && !pages;
  const chargementSuite = isLoading || (size > 0 && pages && typeof pages[size - 1] === 'undefined');

  // Fermer la liste au clic hors de la zone de recherche (pas au blur : sinon
  // « Afficher plus », qui prend le focus, refermait la liste).
  useEffect(() => {
    if (!listeOuverte) return undefined;
    const dehors = (e) => { if (zoneRef.current && !zoneRef.current.contains(e.target)) setListeOuverte(false); };
    document.addEventListener('mousedown', dehors);
    return () => document.removeEventListener('mousedown', dehors);
  }, [listeOuverte]);

  // Les organisations qui agissent déjà sur ce signalement.
  const dejaLa = useMemo(() => {
    const acting = collaboration?.incidentDetails?.acting_organisations || [];
    return {
      ids: new Set(acting.map((o) => String(o.id ?? o.organisation_id ?? '')).filter(Boolean)),
      noms: new Set(acting.map((o) => (o.name || '').toLowerCase()).filter(Boolean)),
    };
  }, [collaboration]);
  const estDejaLa = (org) => dejaLa.ids.has(String(org.id)) || dejaLa.noms.has((org.name || '').toLowerCase());

  if (!showSuggestModal) return null;

  const estLeader = collaboration?.role === 'leader' || collaboration?.userRole === 'leader';
  const choisies = new Set(suggestedOrgs.map((o) => o.id));
  const resultats = organisations.filter((o) => !choisies.has(o.id));
  const manquantes = suggestedOrgs.filter((o) => !(o.comment || '').trim());
  const nb = suggestedOrgs.length;

  const choisir = (org) => {
    toggleSuggestedOrg(org);
    setSuggestSearch('');
    setListeOuverte(false);
    // Le focus va au champ d'explication de l'organisation qu'on vient d'ajouter.
    setTimeout(() => document.getElementById(`motif-${org.id}`)?.focus(), 30);
  };

  const envoyer = () => {
    if (manquantes.length) {
      setTentative(true);
      document.getElementById(`motif-${manquantes[0].id}`)?.focus();
      return;
    }
    handleSuggestSubmit();
  };

  const verbe = estLeader ? 'Envoyer' : 'Suggérer';
  const libelleEnvoi = nb > 1 ? `${verbe} ${nb} ${estLeader ? 'invitations' : 'organisations'}` : `${verbe} ${estLeader ? "l'invitation" : "l'organisation"}`;

  return (
    <Dialogue
      onClose={closeSuggestModal}
      enFermeture={Boolean(suggestModalClosing)}
      verrouille={suggestSubmitting}
      taille="lg"
      titre={estLeader ? 'Inviter des organisations' : 'Suggérer des organisations'}
      sousTitre={estLeader
        ? "Vous êtes leader : l'invitation part directement à l'organisation."
        : 'Vos suggestions sont transmises au leader, qui décide de les inviter.'}
      icone={<IcoInviter />}
      pied={(
        <>
          {tentative && manquantes.length > 0 ? (
            <span className="dg-pied-info is-ko" role="status">
              <IcoInfo />
              Il manque {manquantes.length} explication{manquantes.length > 1 ? 's' : ''}
            </span>
          ) : (
            <span className="dg-pied-info">{nb ? `${nb} organisation${nb > 1 ? 's' : ''} sélectionnée${nb > 1 ? 's' : ''}` : 'Recherchez une organisation pour commencer'}</span>
          )}
          <button type="button" className="dg-btn dg-btn-g" onClick={closeSuggestModal} disabled={suggestSubmitting}>Annuler</button>
          <button type="button" className="dg-btn dg-btn-p" onClick={envoyer} disabled={nb === 0 || suggestSubmitting}>
            {suggestSubmitting ? <><span className="dg-spin" aria-hidden="true" />Envoi…</> : libelleEnvoi}
          </button>
        </>
      )}
    >
      {suggestAlert && (
        <div
          className={`dg-alerte ${suggestAlert.type === 'success' ? 'dg-alerte-ok' : suggestAlert.type === 'warning' ? 'dg-alerte-warn' : 'dg-alerte-ko'}`}
          role={suggestAlert.type === 'success' ? 'status' : 'alert'}
        >
          {suggestAlert.type === 'success' ? <TickCircle size={18} variant="Bold" color="currentColor" /> : <Danger size={18} variant="Bold" color="currentColor" />}
          <span>{suggestAlert.message}</span>
        </div>
      )}

      <div className="so-recherche" ref={zoneRef}>
        <label className="so-champ">
          <IcoLoupe />
          <input
            data-autofocus
            type="search"
            placeholder="Nom ou sigle de l'organisation"
            aria-label="Rechercher une organisation"
            aria-expanded={listeOuverte}
            aria-controls="so-resultats"
            value={suggestSearch}
            onChange={(e) => { setSuggestSearch(e.target.value); setListeOuverte(true); }}
            onFocus={() => setListeOuverte(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                zoneRef.current?.querySelector('.so-option:not([aria-disabled="true"])')?.focus();
              }
            }}
          />
          {suggestSearch && (
            <button type="button" className="dg-ico" onClick={() => setSuggestSearch('')} aria-label="Effacer la recherche">
              <IcoCroix taille={15} />
            </button>
          )}
        </label>

        {listeOuverte && (
          <div id="so-resultats" className="so-resultats" role="listbox" aria-label="Organisations trouvées">
            {chargementInitial ? (
              <p className="so-vide"><span className="dg-spin" aria-hidden="true" />Recherche…</p>
            ) : error ? (
              <p className="so-vide is-ko">La liste n'a pas pu être chargée. Réessayez dans un instant.</p>
            ) : resultats.length === 0 ? (
              <p className="so-vide">{suggestSearch ? `Aucune organisation pour « ${suggestSearch} »` : 'Aucune autre organisation disponible'}</p>
            ) : (
              resultats.map((org) => {
                const present = estDejaLa(org);
                return (
                  <button
                    key={org.id}
                    type="button"
                    role="option"
                    aria-selected="false"
                    aria-disabled={present}
                    className="so-option"
                    onClick={() => !present && choisir(org)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') { e.preventDefault(); e.currentTarget.nextElementSibling?.focus(); }
                      if (e.key === 'ArrowUp') { e.preventDefault(); (e.currentTarget.previousElementSibling || zoneRef.current?.querySelector('input'))?.focus(); }
                    }}
                  >
                    <Avatar org={org} />
                    <span className="so-nom">{org.name}</span>
                    {present ? <span className="so-tag">Déjà dans la collaboration</span> : <span className="so-ajout">Ajouter</span>}
                  </button>
                );
              })
            )}
            {encore && !chargementInitial && !error && (
              <button type="button" className="so-plus" onClick={() => !isValidating && setSize((s) => s + 1)} disabled={chargementSuite}>
                {chargementSuite ? <><span className="dg-spin" aria-hidden="true" />Chargement…</> : "Afficher plus d'organisations"}
              </button>
            )}
          </div>
        )}
      </div>

      {nb > 0 && (
        <section className="so-choix" aria-label={estLeader ? 'À inviter' : 'À suggérer'}>
          <div className="so-choix-tete">
            <b>{estLeader ? 'À inviter' : 'À suggérer'}</b>
            <span>{nb} organisation{nb > 1 ? 's' : ''}</span>
          </div>
          {suggestedOrgs.map((org) => {
            const role = ROLE_OPTIONS.find((r) => r.id === org.role) || ROLE_OPTIONS[0];
            const enErreur = tentative && !(org.comment || '').trim();
            return (
              <div key={org.id} className={`so-carte ${enErreur ? 'is-ko' : ''}`}>
                <div className="so-carte-tete">
                  <Avatar org={org} />
                  <b>{org.name}</b>
                  <div className="dg-segment" role="radiogroup" aria-label={`Rôle de ${org.name}`}>
                    {ROLE_OPTIONS.map((r) => (
                      <button key={r.id} type="button" role="radio" aria-checked={org.role === r.id} onClick={() => updateSuggestedRole(org.id, r.id)}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="dg-ico" onClick={() => toggleSuggestedOrg(org)} aria-label={`Retirer ${org.name}`}>
                    <IcoCroix taille={15} />
                  </button>
                </div>
                {role?.description && <p className="so-role">{role.label} : {role.description.charAt(0).toLowerCase() + role.description.slice(1)}.</p>}
                <label className="dg-champ" htmlFor={`motif-${org.id}`}>
                  Pourquoi cette organisation ?
                  <textarea
                    id={`motif-${org.id}`}
                    className="dg-textarea"
                    rows={2}
                    value={org.comment || ''}
                    onChange={(e) => updateSuggestedComment(org.id, e.target.value)}
                    aria-invalid={enErreur}
                    aria-describedby={`aide-${org.id}`}
                  />
                  <span id={`aide-${org.id}`} className={enErreur ? 'dg-erreur' : 'so-aide'}>
                    {enErreur ? 'Expliquez en une phrase pourquoi vous la sollicitez.' : `Visible par ${org.name}${estLeader ? ' dans son invitation' : ' et par le leader'}.`}
                  </span>
                </label>
              </div>
            );
          })}
        </section>
      )}
    </Dialogue>
  );
};

export default SuggestOrgModal;
