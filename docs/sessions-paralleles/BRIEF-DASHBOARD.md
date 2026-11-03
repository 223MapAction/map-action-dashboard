# Brief : refonte mobile native du dashboard

Lire d'abord `docs/sessions-paralleles/REGLES-COMMUNES.md`. Ce dossier : `../map-action-mobile-dashboard`, branche `feat/mobile-dashboard`, serveur de dev `npx vite --port 5201`.

## Objectif

Sur mobile (sous 640 px), le site doit se comporter comme une application native. Le bureau ne change pas.

## Écrans de la maquette à reproduire

1. Carte prioritaire : carte plein écran, sans barre de recherche. En haut : bloc de contexte (pays, type, état) à gauche ; à droite trois boutons ronds translucides : Statistiques, Activité, Notifications (pastille si non lues). Filtres rapides (Actifs/Résolus, type, pays), bouton du fond de carte, légende de gravité et « N · Charger plus » au-dessus des onglets.
2. Signalement touché sur la carte : aperçu en feuille basse.
3. Détail rapide : feuille plein écran.
4. Filtres de la carte : feuille.
5. Activité : écran ouvert par le bouton Activité, lien retour « Carte ».
7. Notifications : écran avec retour « Carte ».
8. Onglet Plus : reste du menu.
9. Statistiques : panneau ouvert par le bouton, avec indicateurs (Total, Pris en compte, Résolus), « À traiter en priorité », Par localité, Gravité.
TabBar : 5 onglets, Carte, Signalements (badge), Interventions, Collaborations, Plus.

## Ordre de travail

1. Barre d'onglets (`src/components/layout/`), rendue par `Sidebar` sous 640 px, et variable `--am-tabbar-h` (voir le contrat). Commit.
2. Dashboard mobile (`src/pages/dashboard/`). Commit.

## Repères techniques

- Les pages montent elles-mêmes `<Sidebar>` et `<Header>` ; `useSidebarState` gère le tiroir actuel.
- Carte : react-map-gl, MapLibre ou Mapbox selon `IS_MAPBOX`. Réglages à garder : minZoom 2, maxZoom 18, gestes coopératifs (`utils/gestesCarte`), fitBounds maxZoom 10 padding 80, flyTo zoom max(courant, 10).
- Gravité : `utils/gravite` (Élevée, Moyenne, Faible). Lieu : `utils/lieuIncident`.
- Fenêtres : `Dialogue` (centré, feuille basse sous 640 px, `pied`/`children` peuvent être des fonctions recevant `{close}`, `verrouille` bloque la fermeture).
- Données : SWR (`keepPreviousData`, `useSWRInfinite`). Ne reprendre que les champs existants des services du dashboard.
