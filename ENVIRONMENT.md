# Variables d’environnement

| Variable | Obligatoire | Usage |
| --- | --- | --- |
| `MASTER_ENCRYPTION_KEY` | Oui | Clé AES-GCM de 32 octets en base64 pour chiffrer les clés OpenAI personnelles. |
| `SECURITY_PEPPER` | Oui | Secret long utilisé pour hacher les codes d’activation. |
| `INITIAL_ADMIN_EMAIL` | Initialisation | Adresse du premier administrateur, définie côté serveur. |
| `INITIAL_ADMIN_BOOTSTRAP_TOKEN` | Initialisation | Jeton à usage unique exigé pour créer le premier administrateur. |
| `OPENAI_MODEL` | Non | Modèle proposé par défaut, `gpt-5.5` si absent. |
| `NEXT_PUBLIC_SITE_URL` | Production | Origine canonique utilisée pour les aperçus sociaux. |
| `RESEND_API_KEY` | Non | Active l’envoi automatique des autorisations par e-mail. |
| `RESEND_FROM_EMAIL` | Avec Resend | Adresse d’expédition vérifiée. |

Ne placez jamais de clé OpenAI de formateur dans ces variables : chaque clé est saisie par son propriétaire, testée côté serveur puis chiffrée en base.
