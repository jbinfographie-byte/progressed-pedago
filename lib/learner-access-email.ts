export function learnerAccessUrl(requestUrl: string, configuredSiteUrl?: string): string {
  const base = new URL(configuredSiteUrl?.trim() || new URL(requestUrl).origin);
  const url = new URL('/', base);
  url.searchParams.set('access', 'learner');
  return url.toString();
}

export function learnerAccessEmail(input: {
  firstName: string | null;
  accessUrl: string;
  invitationUrl?: string;
  invitationDays?: number;
}) {
  const greeting = input.firstName?.trim() ? `Bonjour ${input.firstName.trim()},` : 'Bonjour,';
  const activation = input.invitationUrl
    ? `\n\nPour votre première connexion, confirmez votre compte et choisissez votre mot de passe avec ce lien sécurisé :\n${input.invitationUrl}\n\nCe lien d’activation expire dans ${Math.max(1, Math.round(input.invitationDays ?? 7))} jour(s).`
    : '\n\nVotre compte apprenant est déjà actif.';
  return {
    subject: input.invitationUrl ? 'Votre accès apprenant à Progressed Pédago' : 'Retrouvez votre espace apprenant Progressed Pédago',
    text: `${greeting}${activation}\n\nPour toutes vos prochaines connexions, conservez ce lien permanent :\n${input.accessUrl}\n\nConnectez-vous avec votre adresse e-mail et votre mot de passe. Ce lien ne contient aucun mot de passe ni code secret et peut être ajouté à vos favoris.\n\nAprès la connexion, utilisez « Installer l’application » pour placer l’icône Progressed Pédago sur l’écran d’accueil de votre téléphone, de votre tablette ou de votre ordinateur.\n\nSi vous avez oublié votre mot de passe, choisissez « Mot de passe oublié ? » sur l’écran de connexion.\n\nÀ bientôt,\nL’équipe Progressed Pédago`,
  };
}
