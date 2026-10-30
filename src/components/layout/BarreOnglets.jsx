import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { authService } from '../../pages/auth/services/authService';
import './barre-onglets.css';

const Trait = ({ epaisseur = 1.8, taille = 24, children }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={epaisseur}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const ONGLETS = [
  {
    id: 'dashboard',
    libelle: 'Carte',
    chemin: '/dashboard',
    icone: <><path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z" /><path d="M9 4v13M15 6.5v13" /></>,
  },
  {
    id: 'incidents',
    libelle: 'Signalements',
    chemin: '/signalements',
    icone: <><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 12.5h18" /></>,
  },
  {
    id: 'mes-interventions',
    libelle: 'Interventions',
    chemin: '/mes-interventions',
    icone: <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  },
  {
    id: 'collaboration',
    libelle: 'Collaborations',
    chemin: '/collaboration',
    icone: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.2.6 3.5 2.6 3.5 6" /></>,
  },
];

const ICONE_PLUS = <><circle cx="5.5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18.5" cy="12" r="1.3" /></>;

const CheminPlus = () => (
  <svg className="plus-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

// Le reste du menu, dans l'ordre de la maquette. Chaque ligne n'apparaît que si
// le rôle de l'utilisateur y donne accès.
const GROUPES_PLUS = [
  {
    titre: 'Réseau',
    lignes: [
      { id: 'collaboration', libelle: 'Collaborations', chemin: '/collaboration', fond: '#0E7490', icone: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 0 1 0 7" /></> },
      { id: 'organisations', libelle: 'Organisations', chemin: '/organisations', fond: '#7C3AED', icone: <path d="M3 21h18M5 21V7l7-4 7 4v14" /> },
      { id: 'agents', libelle: 'Agents', chemin: '/agents', fond: '#15803D', icone: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></> },
    ],
  },
  {
    titre: 'Résultats',
    lignes: [
      { id: 'impact', libelle: 'Impact', chemin: '/impact', fond: '#B45309', icone: <><circle cx="12" cy="9" r="5" /><path d="M8.5 13 7 21l5-3 5 3-1.5-8" /></> },
    ],
  },
  {
    lignes: [
      { id: 'trash', libelle: 'Corbeille', chemin: '/trash', fond: '#64748B', icone: <path d="M5 7h14M7 7l1 13h8l1-13M9 7V4h6v3" /> },
    ],
  },
];

const initiales = (u) => {
  const lettres = (u?.first_name?.trim()[0] || '') + (u?.last_name?.trim()[0] || '');
  return (lettres || 'U').toUpperCase();
};

const EcranPlus = ({ idsAccessibles, onAller }) => {
  const navigate = useNavigate();
  const utilisateur = authService.getCurrentUser();

  return createPortal(
    <div className="ecran-plus">
      <h1>Plus</h1>

      <button type="button" className="plus-profil" onClick={() => onAller('/profile')}>
        <span className="plus-avatar">
          {utilisateur?.avatar ? <img src={utilisateur.avatar} alt="" /> : initiales(utilisateur)}
        </span>
        <span className="plus-profil-texte">
          <b>{utilisateur?.first_name || 'Utilisateur'}</b>
          {utilisateur?.email && <span>{utilisateur.email}</span>}
          {utilisateur?.organisation_name && <span className="plus-org">{utilisateur.organisation_name}</span>}
        </span>
        <CheminPlus />
      </button>

      {GROUPES_PLUS.map(({ titre, lignes }) => {
        const visibles = lignes.filter((l) => idsAccessibles.includes(l.id));
        if (visibles.length === 0) return null;
        return (
          <section key={titre || 'autres'} aria-label={titre || 'Autres'}>
            {titre && <h2>{titre}</h2>}
            <ul className="plus-groupe">
              {visibles.map((l) => (
                <li key={l.id}>
                  <button type="button" className="plus-ligne" onClick={() => onAller(l.chemin)}>
                    <span className="plus-icone" style={{ backgroundColor: l.fond }}>
                      <Trait taille={16} epaisseur={2.2}>{l.icone}</Trait>
                    </span>
                    <span className="plus-libelle">{l.libelle}</span>
                    <CheminPlus />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <button
        type="button"
        className="plus-deconnexion"
        onClick={() => {
          authService.logout();
          navigate('/login');
        }}
      >
        Se déconnecter
      </button>
    </div>,
    document.body
  );
};

/**
 * Barre d'onglets du mobile (sous 640 px), rendue par `Sidebar` : aucune page
 * n'a besoin d'être modifiée pour l'afficher. « Plus » est un écran posé sur la
 * page, sans adresse propre : changer de page le referme de lui-même.
 */
export const BarreOnglets = ({ idsAccessibles, aTraiter = 0 }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [plusOuvert, setPlusOuvert] = useState(false);

  const allerA = (chemin) => {
    setPlusOuvert(false);
    navigate(chemin);
  };

  const onglets = ONGLETS.filter((o) => idsAccessibles.includes(o.id));
  const dansOnglet = (o) =>
    pathname === o.chemin ||
    pathname.startsWith(`${o.chemin}/`) ||
    (o.chemin === '/collaboration' && pathname.startsWith('/collaboration-detail'));

  const actif = (o) => !plusOuvert && dansOnglet(o);
  const plusActif = plusOuvert || !onglets.some(dansOnglet);

  return (
    <>
      {plusOuvert && <EcranPlus idsAccessibles={idsAccessibles} onAller={allerA} />}
      <nav className="am-tabbar" aria-label="Navigation principale">
        {onglets.map((o) => (
          <button
            key={o.id}
            type="button"
            className={`am-onglet ${actif(o) ? 'is-actif' : ''}`}
            aria-current={actif(o) ? 'page' : undefined}
            onClick={() => allerA(o.chemin)}
          >
            <span className="am-onglet-icone">
              <Trait epaisseur={actif(o) ? 2.2 : 1.8}>{o.icone}</Trait>
              {o.id === 'incidents' && aTraiter > 0 && (
                <span className="am-onglet-badge" aria-label={`${aTraiter} à traiter`}>
                  {aTraiter > 99 ? '99+' : aTraiter}
                </span>
              )}
            </span>
            {o.libelle}
          </button>
        ))}
        <button
          type="button"
          className={`am-onglet ${plusActif ? 'is-actif' : ''}`}
          aria-current={plusActif ? 'page' : undefined}
          aria-expanded={plusOuvert}
          onClick={() => setPlusOuvert((o) => !o)}
        >
          <span className="am-onglet-icone">
            <Trait epaisseur={plusActif ? 2.2 : 1.8}>{ICONE_PLUS}</Trait>
          </span>
          Plus
        </button>
      </nav>
    </>
  );
};

export default BarreOnglets;
