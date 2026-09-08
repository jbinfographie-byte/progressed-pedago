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

## Formules, quotas et maîtrise des coûts

L’administration comporte trois formules initiales entièrement modifiables : Essentiel, Coach et Intensif. Le prix, les minutes vocales quotidiennes et mensuelles, les crédits, le budget API interne et chaque droit fonctionnel sont enregistrés en base. L’administrateur peut attribuer une formule, programmer ses dates, ajouter ou retirer des crédits, personnaliser les limites et créer des exceptions de droits par utilisateur.

Les contrôles sensibles sont effectués côté serveur avant les appels IA. Les événements d’usage enregistrent la fonctionnalité, le modèle, les jetons disponibles, la durée audio, le coût estimé ou réel et les crédits débités. Les compteurs quotidiens et mensuels sont remis à zéro automatiquement à leur échéance. Une limite atteinte suspend uniquement la fonction coûteuse concernée : les contenus déjà créés et les activités de base restent accessibles.

Le compte administrateur initial reçoit un accès Intensif illimité pour les essais. Les autres comptes commencent avec la formule Essentiel ; le Coach vocal y reste disponible avec un quota limité, tandis que les dialogues professionnels, jeux de rôle et corrections personnalisées dépendent des formules supérieures ou d’une exception individuelle.

La migration `0011_rare_wolfpack.sql` ajoute les tables de formules, abonnements, exceptions, consommation IA, mouvements de crédits et historique sans modifier ni supprimer les données pédagogiques existantes.
