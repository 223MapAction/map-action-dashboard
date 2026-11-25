// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { BadgeGravite } from './BadgeGravite';

const classes = (element) => Array.from(element.classList);

// Sans nettoyage, les rendus s'empilent dans le meme document et getByText
// trouve plusieurs badges.
afterEach(cleanup);

describe('BadgeGravite', () => {
  it('affiche le niveau decide par le serveur', () => {
    render(<BadgeGravite incident={{ severity: 'medium' }} />);
    expect(screen.getByText('Gravité moyenne')).toBeTruthy();
  });

  it('donne a chaque niveau sa propre classe de couleur', () => {
    const { rerender } = render(<BadgeGravite incident={{ severity: 'high' }} />);
    const vus = new Set();

    ['high', 'medium', 'low'].forEach((niveau) => {
      rerender(<BadgeGravite incident={{ severity: niveau }} />);
      const modificateur = classes(screen.getByText(/^Gravité /))
        .find((c) => c.startsWith('badge-gravite--') && !c.endsWith('discret'));
      vus.add(modificateur);
    });

    // Le defaut d'origine : « moyenne » et « faible » se peignaient pareil.
    // Trois niveaux doivent produire trois classes distinctes.
    expect(vus.size).toBe(3);
  });

  it('ne peint jamais « faible » comme un incident resolu', () => {
    render(<BadgeGravite incident={{ severity: 'low' }} />);
    const badge = screen.getByText('Gravité faible');
    // Le vert et le bleu appartiennent aux etats « resolu » sur la carte : un
    // badge vert sur un signalement se lit « c'est regle », pas « peu grave ».
    expect(classes(badge)).toContain('badge-gravite--low');
    expect(classes(badge).join(' ')).not.toMatch(/success|primary|resolved/);
  });

  it('applique la variante demandee sans perdre le niveau', () => {
    render(<BadgeGravite incident={{ severity: 'high' }} variante="plein" />);
    const badge = screen.getByText('Gravité élevée');
    expect(classes(badge)).toEqual(
      expect.arrayContaining(['badge-gravite--plein', 'badge-gravite--high'])
    );
  });

  it('ne rend rien sans incident, plutot que de planter la liste', () => {
    const { container } = render(<BadgeGravite incident={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('retombe sur « faible » quand la gravite est absente', () => {
    render(<BadgeGravite incident={{ id: 'x' }} />);
    expect(screen.getByText('Gravité faible')).toBeTruthy();
  });
});
