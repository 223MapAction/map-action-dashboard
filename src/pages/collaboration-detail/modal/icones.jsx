// Pictogrammes des fenêtres du détail collaboration, dessinés au même trait
// (2 px, extrémités arrondies) que la maquette validée.

const Trait = ({ taille = 20, epaisseur = 2, children }) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={epaisseur} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const IcoTache = () => (
  <Trait><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8.5 12l2.5 2.5 4.5-5" /></Trait>
);

export const IcoCrayon = () => (
  <Trait taille={18}><path d="M4 20h4L19 9l-4-4L4 16v4z" /></Trait>
);

export const IcoInviter = () => (
  <Trait><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0112 0M18 8v6M15 11h6" /></Trait>
);

export const IcoRapport = () => (
  <Trait taille={19}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></Trait>
);

export const IcoBouclier = () => (
  <Trait><path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></Trait>
);

export const IcoCorbeille = () => (
  <Trait><path d="M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7V4h6v3" /></Trait>
);

export const IcoCroix = ({ taille = 16 }) => (
  <Trait taille={taille} epaisseur={2.2}><path d="M6 6l12 12M18 6L6 18" /></Trait>
);

export const IcoCoche = ({ taille = 16, epaisseur = 2.6 }) => (
  <Trait taille={taille} epaisseur={epaisseur}><path d="M5 12l5 5 9-10" /></Trait>
);

export const IcoInfo = () => (
  <Trait taille={13} epaisseur={2.4}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16v.5" /></Trait>
);

export const IcoAlerte = () => (
  <Trait taille={18}><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17v.5" /></Trait>
);

export const IcoLoupe = () => (
  <Trait taille={17}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Trait>
);

export const IcoAgrandir = () => (
  <Trait taille={12} epaisseur={2.2}><path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6" /></Trait>
);

export const IcoDepot = () => (
  <Trait taille={22}><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></Trait>
);
