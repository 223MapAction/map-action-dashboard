import * as yup from 'yup';

// Pas de mot de passe : l'API crée elle-même le code d'accès de l'agent, et le
// formulaire n'en a jamais envoyé (le champ était généré puis ignoré).

const champsCommuns = {
  firstName: yup
    .string()
    .trim()
    .required('Indiquez le prénom.')
    .min(2, 'Le prénom doit contenir au moins 2 caractères.'),

  lastName: yup
    .string()
    .trim()
    .required('Indiquez le nom.')
    .min(2, 'Le nom doit contenir au moins 2 caractères.'),

  phone: yup
    .string()
    .trim()
    .required('Indiquez le numéro de téléphone.')
    .test('huit-chiffres', (valeur, { createError }) => {
      const chiffres = (valeur || '').replace(/\s/g, '');
      if (!/^\d*$/.test(chiffres)) return createError({ message: 'Le numéro ne doit contenir que des chiffres.' });
      if (chiffres.length === 8) return true;
      const ecart = 8 - chiffres.length;
      return createError({
        message: ecart > 0
          ? `Il manque ${ecart === 1 ? 'un chiffre' : `${ecart} chiffres`} : le numéro en compte 8.`
          : 'Le numéro compte 8 chiffres, pas plus.',
      });
    }),

  address: yup.string().trim().optional(),

  role: yup
    .string()
    .oneOf(['admin', 'bureau', 'terrain'], 'Choisissez un rôle.')
    .required('Choisissez un rôle.'),

  organisationId: yup.string().required('Choisissez l’organisation.'),

  status: yup.string().oneOf(['active', 'inactive']).default('active'),
};

export const createAgentSchema = yup.object({
  ...champsCommuns,
  email: yup
    .string()
    .trim()
    .email('Cette adresse e-mail n’est pas valide.')
    .required('Indiquez l’adresse e-mail.'),
});

// En modification, l'e-mail n'est plus modifiable : il n'est pas revalidé.
export const editAgentSchema = yup.object({
  ...champsCommuns,
  email: yup.string().trim().optional(),
});
