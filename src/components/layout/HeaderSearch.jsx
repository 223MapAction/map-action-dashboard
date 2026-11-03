import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SearchNormal1 } from 'iconsax-react';
import { getIncidentsService } from '../../pages/incident/service/incident_service';
import { gravite, couleurGravite } from '../../utils/gravite';
import { titreIncident } from '../../utils/titreIncident';
import { logger } from '../../utils/logger';

const STATUTS = {
  declared: 'Déclaré',
  taken_into_account: 'Pris en compte',
  in_progress: 'En cours',
  resolved: 'Résolu',
};

/**
 * Recherche globale de signalements (Ctrl K).
 * Sur le dashboard, le résultat choisi s'ouvre sur la carte ; ailleurs, on
 * navigue vers sa fiche.
 */
export const HeaderSearch = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef(null);
  const [requete, setRequete] = useState('');
  const [resultats, setResultats] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [surligne, setSurligne] = useState(0);

  // Ctrl K / Cmd K place le curseur dans la recherche
  useEffect(() => {
    const surTouche = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, []);

  // Requête différée de 250 ms pour ne pas interroger l'API à chaque frappe
  useEffect(() => {
    const q = requete.trim();
    if (q.length < 2) return undefined;
    let annule = false;
    const minuteur = setTimeout(async () => {
      setChargement(true);
      try {
        const data = await getIncidentsService(1, 6, q);
        if (!annule) {
          setResultats(data?.results || (Array.isArray(data) ? data : []));
          setSurligne(0);
        }
      } catch (err) {
        logger.error('[HeaderSearch] Erreur de recherche:', err);
        if (!annule) setResultats([]);
      } finally {
        if (!annule) setChargement(false);
      }
    }, 250);
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, [requete]);

  const choisir = (incident) => {
    setOuvert(false);
    setRequete('');
    setResultats([]);
    inputRef.current?.blur();
    if (location.pathname === '/dashboard') {
      window.dispatchEvent(new CustomEvent('mapaction:focus-incident', { detail: { id: incident.id } }));
    } else {
      navigate(`/signalements/${incident.id}`);
    }
  };

  const surClavier = (e) => {
    if (e.key === 'Escape') {
      setOuvert(false);
      inputRef.current?.blur();
      return;
    }
    if (!resultats.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const pas = e.key === 'ArrowDown' ? 1 : -1;
      setSurligne((i) => (i + pas + resultats.length) % resultats.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choisir(resultats[surligne]);
    }
  };

  const q = requete.trim();
  const afficher = ouvert && q.length >= 2;

  return (
    <div className="header-search">
      <SearchNormal1 size={18} color="currentColor" className="header-search-icon" />
      <input
        ref={inputRef}
        type="search"
        value={requete}
        onChange={(e) => {
          setRequete(e.target.value);
          setOuvert(true);
        }}
        onFocus={() => setOuvert(true)}
        onBlur={() => setTimeout(() => setOuvert(false), 150)}
        onKeyDown={surClavier}
        placeholder="Rechercher un signalement, une commune…"
        aria-label="Rechercher un signalement"
        autoComplete="off"
      />
      <kbd className="header-search-kbd">Ctrl K</kbd>

      {afficher && (
        <div className="header-search-results" role="listbox">
          {chargement && resultats.length === 0 ? (
            <div className="header-search-empty">Recherche…</div>
          ) : resultats.length === 0 ? (
            <div className="header-search-empty">Aucun signalement ne correspond à « {q} ».</div>
          ) : (
            resultats.map((incident, i) => (
              <button
                key={incident.id}
                type="button"
                role="option"
                aria-selected={i === surligne}
                className={`header-search-item ${i === surligne ? 'is-highlighted' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setSurligne(i)}
                onClick={() => choisir(incident)}
              >
                <span className="header-search-dot" style={{ backgroundColor: couleurGravite(gravite(incident)) }} />
                <span className="header-search-text">
                  <b>{titreIncident(incident)}</b>
                  <small>
                    {[incident.zone, STATUTS[incident.etat] || 'Déclaré'].filter(Boolean).join(' · ')}
                  </small>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default HeaderSearch;
