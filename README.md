# Progressed Pédago

Plateforme pédagogique multi-formateurs de Progressed Solution. L’application permet de créer manuellement ou avec OpenAI quatre formats essentiels — quiz interactif, glisser-déposer, vrai ou faux et mise en situation —, d’importer des documents privés, d’imprimer en A4 et de suivre les résultats.

## Démarrage local

1. Installer Node.js 22.13 ou plus récent et pnpm.
2. Copier `.dev.vars.example` vers `.dev.vars` et remplacer toutes les valeurs de sécurité.
3. Générer `MASTER_ENCRYPTION_KEY` avec `openssl rand -base64 32`.
4. Installer les dépendances avec `pnpm install`.
5. Générer les migrations avec `pnpm db:generate`, puis appliquer dans l’ordre les fichiers SQL du dossier `drizzle/` avec `pnpm exec wrangler d1 execute DB --local --config wrangler.local.jsonc --file=<migration.sql>`.
6. Lancer `pnpm dev` puis ouvrir l’adresse affichée.

## Administrateur initial

Définir `INITIAL_ADMIN_EMAIL` avec l’adresse du propriétaire du Site. Lors de la première inscription, l’identité Sites authentifiée doit correspondre à cette adresse : le compte administrateur est alors créé, activé et connecté automatiquement. L’opération est verrouillée dès qu’un administrateur existe.

`INITIAL_ADMIN_BOOTSTRAP_TOKEN` reste une solution de secours réservée à l’exploitation locale ou à une récupération contrôlée. Il n’est jamais demandé ni exposé dans l’interface.

## Vérifications

- `pnpm typecheck` : vérification TypeScript.
- `pnpm test` : tests unitaires de sécurité et des 27 mécaniques.
- `node tests/e2e-smoke.mjs` : parcours local complet sur un serveur déjà lancé.
- `pnpm lint` : analyse statique.
- `pnpm build` : compilation de production Cloudflare/Sites.

## Déploiement

Le projet utilise Sites, D1 pour les données relationnelles, R2 pour les documents et les routes serveur pour OpenAI. Configurez les variables de `ENVIRONMENT.md` dans l’environnement d’hébergement, appliquez les migrations, puis lancez la publication Sites.
