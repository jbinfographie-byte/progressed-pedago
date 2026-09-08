# Variables d’environnement

| Variable | Obligatoire | Usage |
| --- | --- | --- |
| `MASTER_ENCRYPTION_KEY` | Oui | Clé AES-GCM de 32 octets en base64 pour chiffrer les clés OpenAI personnelles. |
| `SECURITY_PEPPER` | Oui | Secret long utilisé pour hacher les codes d’activation. |
| `INITIAL_ADMIN_EMAIL` | Initialisation | Adresse du premier administrateur, définie côté serveur. |
| `INITIAL_ADMIN_BOOTSTRAP_TOKEN` | Initialisation | Jeton à usage unique exigé pour créer le premier administrateur. |
| `OPENAI_MODEL` | Non | Modèle proposé par défaut, `gpt-5.5` si absent. |
| `OPENAI_API_KEY` | Non | Clé OpenAI gérée par la plateforme, uniquement côté serveur. Elle sert de solution centrale si un formateur n’a pas connecté sa propre clé. |
| `NEXT_PUBLIC_SITE_URL` | Production | Origine canonique utilisée pour les aperçus sociaux. |
| `RESEND_API_KEY` | Non | Active l’envoi automatique des autorisations par e-mail. |
| `RESEND_FROM_EMAIL` | Avec Resend | Adresse d’expédition vérifiée. |

Ne placez jamais de clé OpenAI de formateur dans ces variables : chaque clé personnelle est saisie par son propriétaire, testée côté serveur puis chiffrée en base. La clé `OPENAI_API_KEY`, lorsqu’elle est activée, appartient à la plateforme et ne doit jamais être préfixée par `NEXT_PUBLIC_`, renvoyée au navigateur, journalisée ou enregistrée dans Git.

Si `OPENAI_API_KEY` n’est pas configurée, la connexion chiffrée d’un administrateur actif peut servir de relais central côté serveur. Elle n’est jamais transmise au formateur ni à l’apprenant : le navigateur reçoit seulement une clé de session vocale éphémère, et les limites propres à la formule restent appliquées avant chaque session.
