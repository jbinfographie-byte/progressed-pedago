# Progressed Pédago

Progressed Pédago est une plateforme pédagogique multi-formateurs permettant de créer des cours et des activités, d’organiser des parcours, d’accompagner les apprenants, d’exploiter le coach vocal IA et de suivre les résultats.

## Architecture

- Vinext `1.0.0-beta.3` avec compatibilité Next.js App Router ;
- Next.js `16.2.6`, React `19.2.6` et TypeScript `5.9.3` ;
- Vite `8` et Tailwind CSS `4` ;
- Drizzle ORM avec une base SQLite compatible Cloudflare D1 ;
- stockage documentaire compatible Cloudflare R2 ;
- exécution serveur actuelle sous forme de Cloudflare Worker.

Node.js `22.13.0` ou une version 22 plus récente est requis. Le gestionnaire de paquets du projet est pnpm `11.19.0`.

## Installation locale

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .dev.vars
```

Renseigner ensuite les valeurs privées dans `.dev.vars`. Ce fichier est exclu de Git et ne doit jamais être envoyé dans le dépôt.

Générer les deux secrets principaux avec des valeurs différentes :

```bash
openssl rand -base64 32
openssl rand -hex 32
```

Utiliser la première valeur pour `MASTER_ENCRYPTION_KEY` et la seconde pour `SECURITY_PEPPER`.

## Administrateur initial

Définir `INITIAL_ADMIN_EMAIL` avec l’adresse du propriétaire. Lors de la première inscription, l’identité Sites authentifiée doit correspondre à cette adresse : le compte administrateur est alors créé, activé et connecté automatiquement. L’opération est verrouillée dès qu’un administrateur existe.

`INITIAL_ADMIN_BOOTSTRAP_TOKEN` reste une solution de secours réservée à l’exploitation locale ou à une récupération contrôlée. Il n’est jamais demandé ni exposé dans l’interface.

## Commandes

| Action | Commande |
| --- | --- |
| Développement | `pnpm dev` |
| Vérification TypeScript | `pnpm typecheck` |
| Tests unitaires | `pnpm test` |
| Analyse statique | `pnpm lint` |
| Construction de production | `pnpm build` |
| Démarrage local de la version construite (Worker) | `pnpm start` |
| Génération de migrations | `pnpm db:generate` |

La construction produit le dossier `dist/`. Le point d’entrée serveur est `dist/server/index.js` et les ressources publiques compilées se trouvent dans `dist/client/`.

## Variables d’environnement

Le fichier [`.env.example`](.env.example) contient la liste complète sans aucune valeur confidentielle.

| Variable | Obligatoire | Usage |
| --- | --- | --- |
| `MASTER_ENCRYPTION_KEY` | Oui | Clé AES-GCM de 32 octets en base64 pour chiffrer les clés personnelles. |
| `SECURITY_PEPPER` | Oui | Secret long utilisé pour sécuriser les codes d’activation. |
| `INITIAL_ADMIN_EMAIL` | Initialisation | Adresse du premier administrateur. |
| `INITIAL_ADMIN_BOOTSTRAP_TOKEN` | Initialisation | Jeton de secours à usage contrôlé. |
| `OPENAI_MODEL` | Non | Modèle OpenAI proposé par défaut. |
| `OPENAI_API_KEY` | Selon usage | Connexion IA centrale, exclusivement côté serveur. |
| `NEXT_PUBLIC_SITE_URL` | Production | Adresse HTTPS publique canonique du site. |
| `RESEND_API_KEY` | Selon usage | Envoi des e-mails transactionnels. |
| `RESEND_FROM_EMAIL` | Avec Resend | Adresse d’expédition vérifiée. |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Non | Connexion Microsoft. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Non | Connexion Google. |
| `CANVA_CLIENT_ID` / `CANVA_CLIENT_SECRET` | Non | Connexion Canva. |

Les liaisons `DB` et `FILES` sont actuellement fournies par Cloudflare D1 et R2. Elles ne sont pas des secrets texte et ne doivent pas être remplacées par de fausses variables dans le navigateur.

## Formules, quotas et maîtrise des coûts

L’administration comporte trois formules initiales entièrement modifiables : Essentiel, Coach et Intensif. Le prix, les minutes vocales quotidiennes et mensuelles, les crédits, le budget API interne et chaque droit fonctionnel sont enregistrés en base. L’administrateur peut attribuer une formule, programmer ses dates, ajouter ou retirer des crédits, personnaliser les limites et créer des exceptions de droits par utilisateur.

Les contrôles sensibles sont effectués côté serveur avant les appels IA. Les événements d’usage enregistrent la fonctionnalité, le modèle, les jetons disponibles, la durée audio, le coût estimé ou réel et les crédits débités. Les compteurs quotidiens et mensuels sont remis à zéro automatiquement à leur échéance. Une limite atteinte suspend uniquement la fonction coûteuse concernée : les contenus déjà créés et les activités de base restent accessibles.

Le compte administrateur initial reçoit un accès Intensif illimité pour les essais. Les autres comptes commencent avec la formule Essentiel ; le Coach vocal y reste disponible avec un quota limité, tandis que les dialogues professionnels, jeux de rôle et corrections personnalisées dépendent des formules supérieures ou d’une exception individuelle.

La migration `0011_rare_wolfpack.sql` ajoute les tables de formules, abonnements, exceptions, consommation IA, mouvements de crédits et historique sans modifier ni supprimer les données pédagogiques existantes.

## Base de données locale

Les migrations versionnées se trouvent dans `drizzle/`. Pour une base locale D1, les appliquer dans l’ordre :

```bash
pnpm exec wrangler d1 execute DB --local --config wrangler.local.jsonc --file=drizzle/0000_rainy_flatman.sql
```

Répéter la commande pour chaque migration suivante. Les fichiers locaux de base, les sauvegardes et le contenu envoyé par les utilisateurs sont exclus du dépôt GitHub.

## Déploiement sur Hostinger

L’application dépend actuellement de l’environnement Cloudflare Workers ainsi que de D1 et R2. Un hébergement Node.js mutualisé ne fournit pas directement ces services. Pour conserver toutes les fonctionnalités sans refonte, utiliser un VPS Hostinger avec Node.js 22 et garder D1/R2 accessibles par une couche compatible, ou maintenir l’exécution du Worker chez Cloudflare et utiliser le domaine géré chez Hostinger.

Procédure générale :

1. créer ou connecter le dépôt GitHub privé depuis l’interface officielle Hostinger ;
2. sélectionner Node.js 22 et pnpm ;
3. configurer toutes les variables de `.env.example` dans le gestionnaire de secrets Hostinger, sans ajouter de fichier `.env` au dépôt ;
4. appliquer les migrations de base de données dans l’environnement cible ;
5. installer avec `pnpm install --frozen-lockfile` ;
6. construire avec `pnpm build` ;
7. utiliser `pnpm start` pour vérifier localement le Worker construit ; sur Hostinger, conserver le Worker chez Cloudflare ou fournir une couche d’exécution Workers compatible ;
8. placer l’application derrière HTTPS et configurer `NEXT_PUBLIC_SITE_URL` avec le domaine final.

Une migration vers MySQL/PostgreSQL et un stockage S3 peut être envisagée pour un hébergement Hostinger entièrement autonome, mais elle constitue une évolution d’architecture distincte et ne doit pas être improvisée pendant la sauvegarde du code.

## Vérifications après mise en ligne

- ouvrir la page de connexion et créer un compte de test ;
- vérifier l’activation administrateur et les droits des formateurs ;
- créer un cours, un quiz et un parcours ;
- tester un lien et un QR code en navigation privée ;
- vérifier le coach vocal et le décompte des minutes ;
- déposer puis télécharger un document d’apprenant ;
- vérifier les e-mails d’invitation et de réinitialisation ;
- exporter un PDF A4 ;
- contrôler les journaux serveur sans y exposer de secret ni de donnée personnelle.

## Sécurité du dépôt

Le dépôt doit rester strictement privé. Les fichiers `.env`, `.dev.vars`, bases locales, sauvegardes, journaux, clés privées et documents utilisateurs sont exclus par `.gitignore`. Les clés de production doivent être gérées uniquement dans le coffre de secrets de l’hébergeur et renouvelées immédiatement si elles ont été exposées ailleurs.
