import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // maplibre-gl 6 charge son worker depuis une URL relative à son module.
  // Pré-bundlé par Vite en dev, le module change de dossier et le worker
  // ne se charge plus (« Worker failed to load ») : on le laisse tel quel.
  optimizeDeps: { exclude: ['maplibre-gl'] },

  // Prefixe sous lequel l'application est servie.
  //
  // Par defaut `/` : c'est le cas en developpement et pour un deploiement
  // auto-heberge a la racine d'un domaine, qui doit rester le cas simple.
  //
  // GitHub Pages sert en revanche depuis un sous-chemin
  // (https://<org>.github.io/<depot>/). Sans prefixe, la page se charge mais
  // demande ses assets a la racine du domaine et n'obtient que des 404 :
  // l'application reste blanche. Le workflow de deploiement renseigne donc
  // VITE_BASE_PATH.
  base: process.env.VITE_BASE_PATH || '/',
})
