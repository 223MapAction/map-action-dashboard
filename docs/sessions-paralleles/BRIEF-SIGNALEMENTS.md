# Brief : refonte mobile native de la page Signalements

Lire d'abord `docs/sessions-paralleles/REGLES-COMMUNES.md`. Ce dossier : `../map-action-mobile-signalements`, branche `feat/mobile-signalements`, serveur de dev `npx vite --port 5202`.

## Objectif

Sur mobile (sous 640 px), la page Signalements et la fiche d'un signalement se comportent comme une application native. Le bureau ne change pas (le tableau à colonnes fixes avec la colonne Localisation reste tel quel).

Il n'y a pas de vue carte sur cette page ni de bascule Liste/Carte : la liste suffit, la carte vit sur le dashboard.

## Écrans de la maquette à reproduire

10. Liste : grand titre, recherche, onglets d'état (Tous avec total, Déclarés, Pris en compte, Résolus), cartes avec photo, gravité, état, titre, description, lieu, date, prise en charge, bouton « … » d'actions.
11. Actions d'un signalement : feuille d'actions.
12. Assigner un agent.
13. Fiche, haut de page.
14. Fiche, onglets.
15. Agir sur le signalement.
16. Assistant IA.
17. Chargement, erreur, vide.

## Ordre de travail

1. Liste mobile et actions (`src/pages/incident/components/IncidentList/`, `src/pages/incident/modale/`). Commit.
2. Fiche mobile (`src/pages/incident/IncidentDetailPage.jsx`, `components/IncidentDetail/`). Commit.

## Repères techniques

- Ne pas toucher `src/components/layout/**` : la barre d'onglets est faite par l'autre session. Réserver sa place avec `padding-bottom: calc(var(--am-tabbar-h, 0px) + 16px)`.
- Recherche : `useRechercheDebouncee` (`{saisie, setSaisie, recherche, reinitialiser}`, 250 ms). Remise à zéro : `useReinitialisationSurChangement(deps, fn)`.
- Gravité : `utils/gravite`. Lieu : `utils/lieuIncident`.
- Fenêtres : `Dialogue` (feuille basse sous 640 px). Erreurs : `BandeauErreur`. Menu d'actions bureau : `TableActionsMenu`. Images : `BlurryImage`, `ImageViewer`.
- Dans une fenêtre qui se ferme après envoi, capturer `fermerRef.current` avant `setEnvoi(true)` (sinon `verrouille` empêche la fermeture).
- Champ API mal orthographié : `lattitude`.
