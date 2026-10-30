import React from 'react';
import { BlurryImage } from '../../components/atoms/BlurryImage';
import { initialesOrganisation } from './libelles';

/** Pastille d'une organisation : son logo, sinon son sigle sur sa couleur. */
export const PastilleOrganisation = ({ org, taille = 40 }) => (
  <span
    className="og-pastille"
    style={{ width: taille, height: taille, fontSize: Math.round(taille / 3), backgroundColor: org.logo_url ? 'transparent' : org.color }}
    aria-hidden="true"
  >
    {org.logo_url ? <BlurryImage src={org.logo_url} alt="" /> : initialesOrganisation(org)}
  </span>
);

export default PastilleOrganisation;
