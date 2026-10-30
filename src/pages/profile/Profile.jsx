import React, { useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { Camera, Eye, EyeSlash, CloseCircle } from 'iconsax-react';
import { useSidebarState } from '../../hooks/useSidebarState';
import { Header, Sidebar } from '../../components/layout';
import { BlurryImage } from '../../components/atoms/BlurryImage';
import { BandeauErreur } from '../../components/molecules/BandeauErreur';
import { authService } from '../auth/services/authService';
import { getUserProfileService, updateUserProfileService } from './service/profile_service';
import { getRoleConfig, roleDepuisApi } from '../agents/roles';
import { logger } from '../../utils/logger';
import './profil.css';

const LONGUEUR_MIN = 8;

const lireSession = () => {
  try {
    return JSON.parse(sessionStorage.getItem('user') || 'null') || {};
  } catch {
    return {};
  }
};

const dateLongue = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Rôle en français, ou null : une valeur inconnue n'est pas affichée brute. */
const libelleRole = (p) => {
  if (['field_agent', 'bureau_agent', 'org_admin'].includes(p.org_role)) return getRoleConfig(roleDepuisApi(p.org_role)).label;
  if (p.web_role === 'super_admin') return 'Super-administrateur';
  return null;
};

/** Premier message lisible d'une réponse d'erreur du serveur. */
const messageServeur = (donnees) => {
  if (!donnees) return null;
  if (typeof donnees === 'string') return donnees;
  const brut = donnees.error || donnees.detail || donnees.message || donnees.non_field_errors || Object.values(donnees)[0];
  if (Array.isArray(brut)) return brut[0] ? String(brut[0]) : null;
  return brut && typeof brut !== 'object' ? String(brut) : null;
};

const IcoInfo = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16v.5" />
  </svg>
);

const ErreurChamp = ({ id, children }) => (children ? <span id={id} className="pf-erreur"><IcoInfo />{children}</span> : null);

const AlerteServeur = ({ children }) => (children ? (
  <div className="pf-alerte" role="alert"><CloseCircle size={18} variant="Bold" color="currentColor" /><span>{children}</span></div>
) : null);

/** Une ligne de réglage : libellé, valeur et lien « Modifier ». */
const Ligne = ({ libelle, valeur, onModifier, masque = false }) => (
  <div className="pf-ligne">
    <span className="pf-libelle">{libelle}</span>
    <span className={`pf-valeur ${masque ? 'is-masque' : ''} ${valeur ? '' : 'is-vide'}`}>{valeur || 'Non renseignée'}</span>
    {onModifier && <button type="button" className="pf-modifier" onClick={onModifier} aria-label={`Modifier ${libelle.toLowerCase()}`}>Modifier</button>}
  </div>
);

/** Boutons d'une ligne ouverte. */
const Boutons = ({ envoi, onAnnuler, libelle = 'Enregistrer' }) => (
  <div className="pf-boutons">
    <button type="button" className="pf-btn pf-btn-g" onClick={onAnnuler} disabled={envoi}>Annuler</button>
    <button type="submit" className="pf-btn pf-btn-p" disabled={envoi}>
      {envoi ? <><span className="pf-spin" aria-hidden="true" />Enregistrement…</> : libelle}
    </button>
  </div>
);

const ChampMotDePasse = ({ id, libelle, valeur, onChange, autoComplete, erreur }) => {
  const [visible, setVisible] = useState(false);
  return (
    <label className="pf-champ" htmlFor={id}>
      {libelle}
      <span className={`pf-mdp ${erreur ? 'is-ko' : ''}`}>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={Boolean(erreur)}
          aria-describedby={erreur ? `${id}-err` : undefined}
        />
        <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
          {visible ? <EyeSlash size={18} color="currentColor" /> : <Eye size={18} color="currentColor" />}
        </button>
      </span>
      <ErreurChamp id={`${id}-err`}>{erreur}</ErreurChamp>
    </label>
  );
};

export const Profile = () => {
  const {
    isOpen: sidebarOpen,
    setOpen: setSidebarOpen,
    isCollapsed: sidebarCollapsed,
    setCollapsed: setSidebarCollapsed,
  } = useSidebarState();

  const userId = sessionStorage.getItem('user_id');
  const { data, error, mutate } = useSWR(
    userId ? `/MapApi/user/${userId}/` : null,
    () => getUserProfileService(userId),
    { revalidateOnFocus: false },
  );

  // L'API a connu les deux orthographes de l'adresse.
  const profil = useMemo(() => {
    const p = data || lireSession();
    return { ...p, address: p.address || p.adress || '' };
  }, [data]);

  // Une seule ligne ouverte à la fois.
  const [ouverte, setOuverte] = useState(null);
  const [brouillon, setBrouillon] = useState({});
  const [erreurs, setErreurs] = useState({});
  const [alerte, setAlerte] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [toast, setToast] = useState(null);
  const afficherToast = (texte) => setToast({ texte, n: Date.now() });
  const fichierRef = useRef(null);

  const ouvrir = (ligne) => {
    setOuverte(ligne);
    setErreurs({});
    setAlerte(null);
    setBrouillon(ligne === 'mdp'
      ? { actuel: '', nouveau: '', confirmation: '' }
      : { first_name: profil.first_name || '', last_name: profil.last_name || '', email: profil.email || '', address: profil.address || '' });
  };
  const fermer = () => { setOuverte(null); setErreurs({}); setAlerte(null); };
  const champ = (cle) => (v) => {
    setBrouillon((b) => ({ ...b, [cle]: v }));
    if (erreurs[cle]) setErreurs((e) => ({ ...e, [cle]: undefined }));
  };

  /** Envoie le profil complet (l'API attend un PUT) avec les changements. */
  const enregistrerProfil = async (changements, confirmation) => {
    const payload = {
      first_name: profil.first_name || '',
      last_name: profil.last_name || '',
      email: profil.email || '',
      address: profil.address || '',
      ...changements,
    };
    payload.adress = payload.address;

    setEnvoi(true);
    setAlerte(null);
    try {
      const misAJour = await updateUserProfileService(userId, payload);
      const fusion = { ...(authService.getCurrentUser() || {}), ...misAJour, address: misAJour.address || misAJour.adress || '' };
      sessionStorage.setItem('user', JSON.stringify(fusion));
      if (fusion.first_name) sessionStorage.setItem('first_name', fusion.first_name);
      if (fusion.address) sessionStorage.setItem('zone', fusion.address);
      await mutate(fusion, { revalidate: false });
      fermer();
      afficherToast(confirmation);
      return true;
    } catch (err) {
      logger.error('[Profil] Enregistrement impossible :', err);
      const donnees = err?.response?.data;
      if (err?.response?.status === 400 && donnees && typeof donnees === 'object') {
        const parChamp = {};
        ['first_name', 'last_name', 'email'].forEach((c) => { if (donnees[c]) parChamp[c] = messageServeur({ x: donnees[c] }); });
        if (donnees.address || donnees.adress) parChamp.address = messageServeur({ x: donnees.address || donnees.adress });
        setErreurs(parChamp);
        if (!Object.keys(parChamp).length) setAlerte(messageServeur(donnees));
      } else {
        setAlerte(messageServeur(donnees) || 'Les modifications n’ont pas pu être enregistrées. Réessayez dans un instant.');
      }
      return false;
    } finally {
      setEnvoi(false);
    }
  };

  const soumettreNom = (e) => {
    e.preventDefault();
    const nouvelles = {};
    if (!brouillon.first_name.trim()) nouvelles.first_name = 'Indiquez votre prénom.';
    if (!brouillon.last_name.trim()) nouvelles.last_name = 'Indiquez votre nom.';
    setErreurs(nouvelles);
    if (Object.keys(nouvelles).length) return;
    enregistrerProfil({ first_name: brouillon.first_name.trim(), last_name: brouillon.last_name.trim() }, 'Nom mis à jour');
  };

  const soumettreEmail = (e) => {
    e.preventDefault();
    if (!/\S+@\S+\.\S+/.test(brouillon.email.trim())) {
      setErreurs({ email: 'Cette adresse e-mail n’est pas valide.' });
      return;
    }
    enregistrerProfil({ email: brouillon.email.trim() }, 'Adresse e-mail mise à jour');
  };

  const soumettreAdresse = (e) => {
    e.preventDefault();
    enregistrerProfil({ address: brouillon.address.trim() }, 'Adresse mise à jour');
  };

  const changerPhoto = (e) => {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (!fichier) return;
    const lecteur = new FileReader();
    lecteur.onload = (ev) => { enregistrerProfil({ avatar: ev.target?.result }, 'Photo mise à jour'); };
    lecteur.readAsDataURL(fichier);
  };

  const soumettreMotDePasse = async (e) => {
    e.preventDefault();
    const nouvelles = {};
    if (!brouillon.actuel) nouvelles.actuel = 'Indiquez votre mot de passe actuel.';
    if (brouillon.nouveau.length < LONGUEUR_MIN) nouvelles.nouveau = `Le mot de passe doit contenir au moins ${LONGUEUR_MIN} caractères.`;
    if (brouillon.confirmation !== brouillon.nouveau) nouvelles.confirmation = 'Les deux mots de passe ne correspondent pas.';
    setErreurs(nouvelles);
    if (Object.keys(nouvelles).length) return;

    setEnvoi(true);
    setAlerte(null);
    try {
      await authService.changePassword({ old_password: brouillon.actuel, new_password: brouillon.nouveau });
      fermer();
      afficherToast('Mot de passe mis à jour');
    } catch (err) {
      // changePassword renvoie déjà le corps de la réponse d'erreur.
      setAlerte(messageServeur(err) || 'Le mot de passe n’a pas pu être modifié. Réessayez dans un instant.');
    } finally {
      setEnvoi(false);
    }
  };

  const nomComplet = `${profil.first_name || ''} ${profil.last_name || ''}`.trim();
  const initiales = `${profil.first_name?.[0] ?? ''}${profil.last_name?.[0] ?? ''}`.toUpperCase() || '?';
  const role = libelleRole(profil);
  const photo = profil.avatar || null;

  return (
    <div className="pf-layout">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />

      <div className={`pf-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} sidebarCollapsed={sidebarCollapsed} />

        <main className="pf">
          <div className="pf-page">
            <BandeauErreur erreur={error} onReessayer={mutate} message="Impossible de charger votre profil. Les informations affichées peuvent ne plus être à jour." />

            {/* Identité */}
            <section className="pf-identite" aria-label="Identité">
              <span className="pf-avatar">{photo ? <BlurryImage src={photo} alt="" /> : <span className="pf-initiales" aria-hidden="true">{initiales}</span>}</span>
              <div className="pf-identite-texte">
                <h1>{nomComplet || 'Mon profil'}</h1>
                <span className="pf-identite-meta">
                  {role && <span className="pf-role">{role}</span>}
                  {profil.organisation_name}
                </span>
              </div>
              <button type="button" className="pf-btn pf-btn-g" onClick={() => fichierRef.current?.click()} disabled={envoi}>
                <Camera size={16} color="currentColor" aria-hidden="true" />Changer la photo
              </button>
              <input ref={fichierRef} type="file" accept="image/*" hidden onChange={changerPhoto} />
            </section>
            {alerte && !ouverte && <AlerteServeur>{alerte}</AlerteServeur>}

            {/* Informations personnelles */}
            <section className="pf-section" aria-labelledby="pf-h-perso">
              <h2 id="pf-h-perso">Informations personnelles</h2>
              <div className="pf-liste">
                {ouverte === 'nom' ? (
                  <form className="pf-ligne is-ouverte" onSubmit={soumettreNom} noValidate>
                    <span className="pf-libelle">Nom complet</span>
                    <div className="pf-edition">
                      <AlerteServeur>{alerte}</AlerteServeur>
                      <div className="pf-deux">
                        <label className="pf-champ" htmlFor="pf-prenom">Prénom
                          <input id="pf-prenom" type="text" autoFocus value={brouillon.first_name} onChange={(e) => champ('first_name')(e.target.value)} aria-invalid={Boolean(erreurs.first_name)} aria-describedby={erreurs.first_name ? 'pf-prenom-err' : undefined} />
                          <ErreurChamp id="pf-prenom-err">{erreurs.first_name}</ErreurChamp>
                        </label>
                        <label className="pf-champ" htmlFor="pf-nom">Nom
                          <input id="pf-nom" type="text" value={brouillon.last_name} onChange={(e) => champ('last_name')(e.target.value)} aria-invalid={Boolean(erreurs.last_name)} aria-describedby={erreurs.last_name ? 'pf-nom-err' : undefined} />
                          <ErreurChamp id="pf-nom-err">{erreurs.last_name}</ErreurChamp>
                        </label>
                      </div>
                      <Boutons envoi={envoi} onAnnuler={fermer} />
                    </div>
                  </form>
                ) : <Ligne libelle="Nom complet" valeur={nomComplet} onModifier={() => ouvrir('nom')} />}

                {ouverte === 'email' ? (
                  <form className="pf-ligne is-ouverte" onSubmit={soumettreEmail} noValidate>
                    <label className="pf-libelle" htmlFor="pf-email">Adresse e-mail</label>
                    <div className="pf-edition">
                      <AlerteServeur>{alerte}</AlerteServeur>
                      <span className="pf-champ">
                        <input id="pf-email" type="email" autoFocus value={brouillon.email} onChange={(e) => champ('email')(e.target.value)} aria-invalid={Boolean(erreurs.email)} aria-describedby={erreurs.email ? 'pf-email-err' : undefined} />
                        <ErreurChamp id="pf-email-err">{erreurs.email}</ErreurChamp>
                      </span>
                      <Boutons envoi={envoi} onAnnuler={fermer} />
                    </div>
                  </form>
                ) : <Ligne libelle="Adresse e-mail" valeur={profil.email} onModifier={() => ouvrir('email')} />}

                {ouverte === 'adresse' ? (
                  <form className="pf-ligne is-ouverte" onSubmit={soumettreAdresse} noValidate>
                    <label className="pf-libelle" htmlFor="pf-adresse">Adresse</label>
                    <div className="pf-edition">
                      <AlerteServeur>{alerte}</AlerteServeur>
                      <span className="pf-champ">
                        <input id="pf-adresse" type="text" autoFocus value={brouillon.address} onChange={(e) => champ('address')(e.target.value)} aria-invalid={Boolean(erreurs.address)} aria-describedby={erreurs.address ? 'pf-adresse-err' : undefined} />
                        <ErreurChamp id="pf-adresse-err">{erreurs.address}</ErreurChamp>
                      </span>
                      <Boutons envoi={envoi} onAnnuler={fermer} />
                    </div>
                  </form>
                ) : <Ligne libelle="Adresse" valeur={profil.address} onModifier={() => ouvrir('adresse')} />}
              </div>
            </section>

            {/* Organisation : lecture seule */}
            <section className="pf-section" aria-labelledby="pf-h-org">
              <h2 id="pf-h-org">Organisation</h2>
              <div className="pf-liste">
                <Ligne libelle="Organisation" valeur={profil.organisation_name} />
                {role && <Ligne libelle="Rôle" valeur={role} />}
                <Ligne libelle="Membre depuis" valeur={dateLongue(profil.date_joined)} />
              </div>
            </section>

            {/* Sécurité */}
            <section className="pf-section" aria-labelledby="pf-h-secu">
              <h2 id="pf-h-secu">Sécurité</h2>
              <div className="pf-liste">
                {ouverte === 'mdp' ? (
                  <form className="pf-ligne is-ouverte" onSubmit={soumettreMotDePasse} noValidate>
                    <span className="pf-libelle">Mot de passe</span>
                    <div className="pf-edition">
                      <AlerteServeur>{alerte}</AlerteServeur>
                      <ChampMotDePasse id="pf-mdp-actuel" libelle="Mot de passe actuel" valeur={brouillon.actuel} onChange={champ('actuel')} autoComplete="current-password" erreur={erreurs.actuel} />
                      <ChampMotDePasse id="pf-mdp-nouveau" libelle="Nouveau mot de passe" valeur={brouillon.nouveau} onChange={champ('nouveau')} autoComplete="new-password" erreur={erreurs.nouveau} />
                      <ChampMotDePasse id="pf-mdp-confirmation" libelle="Confirmer le nouveau mot de passe" valeur={brouillon.confirmation} onChange={champ('confirmation')} autoComplete="new-password" erreur={erreurs.confirmation} />
                      <span className="pf-aide">Au moins {LONGUEUR_MIN} caractères.</span>
                      <Boutons envoi={envoi} onAnnuler={fermer} libelle="Mettre à jour" />
                    </div>
                  </form>
                ) : <Ligne libelle="Mot de passe" valeur="••••••••" masque onModifier={() => ouvrir('mdp')} />}
              </div>
            </section>
          </div>
        </main>
      </div>

      {toast && <div key={toast.n} className="pf-toast" role="status">{toast.texte}</div>}
    </div>
  );
};

export default Profile;
