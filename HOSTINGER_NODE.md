# Déployer Progressed Pédago sur Hostinger Node.js

Cette version utilise PostgreSQL pour les données et un bucket Supabase privé pour les documents. Elle ne dépend plus de Cloudflare D1, R2 ou Workers à l’exécution.

## 1. Préparer Supabase

1. Créer ou ouvrir le projet Supabase.
2. Dans l’éditeur SQL, exécuter `deployment/supabase-storage.sql` pour créer le bucket privé `progressed-pedago`.
3. Récupérer l’URL PostgreSQL du **Session pooler** (port 5432), adaptée aux hébergeurs IPv4 comme Hostinger.
4. Récupérer l’URL du projet et une clé serveur secrète dans les réglages API. Ne jamais placer cette clé dans le code ou dans une variable commençant par `NEXT_PUBLIC_`.

## 2. Variables Hostinger

Ajouter dans **Variables d’environnement** :

- `DATABASE_URL` : URL PostgreSQL du Session pooler Supabase ;
- `DATABASE_POOL_SIZE` : `5` ;
- `SUPABASE_URL` : URL du projet ;
- `SUPABASE_SECRET_KEY` : clé serveur secrète Supabase ;
- `SUPABASE_STORAGE_BUCKET` : `progressed-pedago` ;
- `MASTER_ENCRYPTION_KEY`, `SECURITY_PEPPER`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_BOOTSTRAP_TOKEN` ;
- `OPENAI_API_KEY` et `OPENAI_MODEL` ;
- `NEXT_PUBLIC_SITE_URL` : adresse publique finale du site ;
- les variables facultatives Resend, Google, Microsoft et Canva seulement si ces connexions sont utilisées.

## 3. Initialiser la base

Depuis un terminal disposant des mêmes variables :

```bash
npm install
npm run db:migrate
```

La première migration crée les 63 tables de l’application. Les tables publiques ont la sécurité RLS activée ; l’application y accède uniquement depuis le serveur avec la connexion PostgreSQL privée.

## 4. Réglages de déploiement Hostinger

- Préréglage : `Other` ;
- Branche : `main` ;
- Node.js : `22.x` ;
- Gestionnaire : `npm` ;
- Commande de compilation : `npm run build` ;
- Commande de démarrage : `npm run start`.

`vinext start` écoute automatiquement sur `0.0.0.0` et utilise le port fourni par `process.env.PORT`.

## 5. Mettre le site à jour

Chaque modification validée dans Codex peut être envoyée sur la branche `main`. Si le dépôt est connecté à l’application Node.js Hostinger, chaque push déclenche normalement un nouveau déploiement. La version créée dans Hostinger Horizons reste une application distincte : elle se modifie dans Horizons puis se remet en ligne avec **Publier**.

## Données existantes

Le changement de moteur ne copie pas automatiquement les données de Cloudflare D1/R2. Avant de désactiver l’ancienne version, exporter D1 et R2, importer les enregistrements dans PostgreSQL et transférer les objets dans le bucket Supabase en conservant leurs `object_key`. Conserver l’ancienne plateforme en lecture seule jusqu’à validation des comptes, parcours, résultats et documents.
