# Refonte mobile native : règles communes aux deux sessions

Deux sessions Claude Code travaillent en même temps, chacune dans son propre dossier (git worktree) et sur sa propre branche :

| Session | Dossier | Branche | Port de dev | Brief |
|---|---|---|---|---|
| Dashboard | `../map-action-mobile-dashboard` | `feat/mobile-dashboard` | 5201 | `docs/sessions-paralleles/BRIEF-DASHBOARD.md` |
| Signalements | `../map-action-mobile-signalements` | `feat/mobile-signalements` | 5202 | `docs/sessions-paralleles/BRIEF-SIGNALEMENTS.md` |

Les deux branches partent de `feat/refonte-collaborations` (commit de ce document). Elles seront fusionnées dans `feat/refonte-collaborations` à la fin.

## Règles du projet (non négociables)

1. Toute refonte part de la maquette validée. Le code est identique à la maquette.
2. N'afficher que des données renvoyées par l'API. Ne rien inventer (pas de compteur, de date ou de champ absent de l'API).
3. Les alertes et messages réutilisent les composants de l'application (`BandeauErreur`, toasts existants, `Dialogue`).
4. Toutes les fenêtres sont centrées ; sous 640 px elles deviennent des feuilles qui montent du bas (`Dialogue` le fait déjà).
5. Ne jamais modifier les jetons globaux de `src/index.css`.
6. La carte reste au centre des décisions.
7. Un commit par page terminée, message en français au format `feat(...)` / `fix(...)`.
8. Écrans testés à 390 px de large avant commit (`npm run lint`, `npm test`, `npm run build` doivent passer).

## Maquette

- Lien : https://claude.ai/artifact/9emTrNZKvXrS7rY8kn7cWW (la lire avec l'outil Artifact, action `read`).
- Écrans 1 à 9 et composant TabBar : session Dashboard.
- Écrans 10 à 17 : session Signalements.
- Chaque session ne republie que ses propres écrans. Si la publication est refusée parce que l'autre session a publié entre-temps, fusionner sur la version renvoyée et republier ; ne jamais forcer.

## Qui possède quels fichiers (pour éviter les conflits)

| Zone | Propriétaire | L'autre session |
|---|---|---|
| `src/components/layout/**` (Sidebar, Header, future barre d'onglets) | Dashboard | lecture seule |
| `src/App.jsx` (routes) | Dashboard | lecture seule |
| `src/pages/dashboard/**` | Dashboard | lecture seule |
| `src/pages/incident/**` | Signalements | lecture seule |
| `src/components/**` hors layout, `src/utils/**`, `src/hooks/**`, `src/styles/**` | personne | lecture seule pour les deux |
| `src/index.css`, `package.json`, `package-lock.json` | personne | ne pas toucher |

Si une session a besoin d'un utilitaire partagé nouveau ou modifié, elle le crée dans son propre dossier de page. On le remontera dans `src/utils` après la fusion. Aucune installation de paquet npm sans accord de l'utilisateur.

## Contrat entre les deux sessions : la barre d'onglets

La session Dashboard construit la barre d'onglets mobile. Elle est rendue par le composant `Sidebar` sous 640 px, donc aucune page n'a besoin d'être modifiée pour l'afficher.

Elle définit, dans `src/components/layout/sidebar.css` uniquement :

```css
:root { --am-tabbar-h: 0px; }
@media (max-width: 640px) {
  :root { --am-tabbar-h: calc(50px + env(safe-area-inset-bottom, 0px)); }
}
```

La session Signalements ne dépend pas de ce travail. Pour réserver la place de la barre, elle écrit toujours :

```css
padding-bottom: calc(var(--am-tabbar-h, 0px) + 16px);
```

Les onglets sont, dans cet ordre : Carte (`/dashboard`), Signalements (`/signalements`), Interventions (`/mes-interventions`), Collaborations (`/collaboration`), Plus (le reste du menu).

## Fin de travail

1. Chaque session commite sur sa branche.
2. Dans le dossier principal : `git merge feat/mobile-dashboard` puis `git merge feat/mobile-signalements` sur `feat/refonte-collaborations`.
3. Supprimer les dossiers : `git worktree remove ../map-action-mobile-dashboard` et `git worktree remove ../map-action-mobile-signalements`.
