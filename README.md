# Progressed Pédago

Plateforme pédagogique multi-formateurs de Progressed Solution. L’application permet de créer manuellement ou avec OpenAI, d’importer des documents privés, d’animer 27 formats d’activités, d’imprimer en A4 et de suivre les résultats.

## Démarrage local

1. Installer Node.js 22.13 ou plus récent et pnpm.
2. Copier `.dev.vars.example` vers `.dev.vars` et remplacer toutes les valeurs de sécurité.
3. Générer `MASTER_ENCRYPTION_KEY` avec `openssl rand -base64 32`.
4. Installer les dépendances avec `pnpm install`.
5. Générer les migrations avec `pnpm db:generate`, puis appliquer dans l’ordre les fichiers SQL du dossier `drizzle/` avec `pnpm exec wrangler d1 execute DB --local --config wrangler.local.jsonc --file=<migration.sql>`.
6. Lancer `pnpm dev` puis ouvrir l’adresse affichée.

## Administrateur initial

Définir `INITIAL_ADMIN_EMAIL` et un `INITIAL_ADMIN_BOOTSTRAP_TOKEN` long et aléatoire. Lors de la première inscription avec cette adresse, fournir le jeton d’initialisation. Retirer ensuite le jeton de l’environnement. Aucun rôle administrateur n’est déduit d’un champ envoyé par le navigateur.

## Vérifications

- `pnpm typecheck` : vérification TypeScript.
- `pnpm test` : tests unitaires de sécurité et des 27 mécaniques.
- `node tests/e2e-smoke.mjs` : parcours local complet sur un serveur déjà lancé.
- `pnpm lint` : analyse statique.
- `pnpm build` : compilation de production Cloudflare/Sites.

## Déploiement

Le projet utilise Sites, D1 pour les données relationnelles, R2 pour les documents et les routes serveur pour OpenAI. Configurez les variables de `ENVIRONMENT.md` dans l’environnement d’hébergement, appliquez les migrations, puis lancez la publication Sites.
