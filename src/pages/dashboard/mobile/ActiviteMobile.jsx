import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { categorie, initiales, couleurPour, tempsRelatif, libelleJour } from '../components/activity/activite-utils';

const FILTRES = [
  { cle: 'all', libelle: 'Tout' },
  { cle: 'signalement', libelle: 'Signalements' },
  { cle: 'collaboration', libelle: 'Collaborations' },
];

const CATEGORIES = {
  signalement: { libelle: 'Signalement', classe: 'dm-cat-signalement' },
  collaboration: { libelle: 'Collaboration', classe: 'dm-cat-collaboration' },
};

/** Écran 5 : l'activité du réseau, ouverte par le bouton de la carte. */
export const ActiviteMobile = ({ activites, isLoading, nextUrl, onLoadMore, isLoadingMore, onRetour }) => {
  const navigate = useNavigate();
  const [filtre, setFiltre] = useState('all');

  const groupes = useMemo(() => {
    const parJour = [];
    (activites || []).forEach((act) => {
      const brut = act.created_at || act.timeStamp;
      const parsee = brut ? new Date(brut) : null;
      const date = parsee && !Number.isNaN(parsee.getTime()) ? parsee : null;
      const cat = categorie(act.action);
      if (filtre !== 'all' && cat !== filtre) return;
      const auteur = act.actor || act.user_name || act.organisation_name || '';
      const item = {
        id: act.id,
        incidentId: act.incident_id ?? act.incident?.id ?? (typeof act.incident === 'number' ? act.incident : null),
        auteur,
        action: act.action || '',
        date,
        cat,
        couleur: couleurPour(act.organisation_id, auteur),
      };
      const jour = date ? libelleJour(date) : 'Date inconnue';
      const dernier = parJour[parJour.length - 1];
      if (dernier?.jour === jour) dernier.items.push(item);
      else parJour.push({ jour, items: [item] });
    });
    return parJour;
  }, [activites, filtre]);

  return (
    <div className="dm-ecran">
      <header className="dm-ecran-entete">
        <button type="button" className="dm-retour" onClick={onRetour}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          Carte
        </button>
        <div className="dm-activite-titre">
          <div>
            <h1>Activité</h1>
            <span>Mises à jour de votre réseau</span>
          </div>
          <span className="dm-direct"><i />En direct</span>
        </div>
        <div className="dm-seg dm-seg-3" role="radiogroup" aria-label="Type d'activité">
          {FILTRES.map((f) => (
            <button key={f.cle} type="button" role="radio" aria-checked={filtre === f.cle} onClick={() => setFiltre(f.cle)}>
              {f.libelle}
            </button>
          ))}
        </div>
      </header>

      <div className="dm-ecran-corps">
        {isLoading ? (
          <p className="dm-vide">Chargement…</p>
        ) : groupes.length === 0 ? (
          <p className="dm-vide">{filtre === 'all' ? 'Aucune activité récente.' : 'Aucune activité de ce type pour le moment.'}</p>
        ) : (
          groupes.map((g) => (
            <section key={g.jour} className="dm-jour">
              <h2>{g.jour}</h2>
              <ul className="dm-liste">
                {g.items.map((a) => {
                  const contenu = (
                    <>
                      <span className="dm-avatar" style={{ backgroundColor: a.couleur }} aria-hidden="true">{initiales(a.auteur)}</span>
                      <span className="dm-activite-texte">
                        <span>{a.auteur && <b>{a.auteur}</b>} {a.action}</span>
                        <span className="dm-activite-meta">
                          <span className={CATEGORIES[a.cat].classe}>{CATEGORIES[a.cat].libelle}</span>
                          {a.date ? tempsRelatif(a.date) : ''}
                        </span>
                      </span>
                    </>
                  );
                  return (
                    <li key={a.id}>
                      {a.incidentId ? (
                        <button type="button" className="dm-activite" onClick={() => navigate(`/signalements/${a.incidentId}`, { state: { from: '/dashboard' } })}>
                          {contenu}
                          <svg className="plus-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                        </button>
                      ) : (
                        <div className="dm-activite">{contenu}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
        {nextUrl && (
          <button type="button" className="dm-plus" onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? 'Chargement…' : 'Afficher plus'}
          </button>
        )}
      </div>
    </div>
  );
};

export default ActiviteMobile;
