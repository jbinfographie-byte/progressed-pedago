import { env } from 'cloudflare:workers';
import { and, eq, gt } from 'drizzle-orm';
import { getDb } from '@/db';
import { helpArticles, publicSubmissionEvents } from '@/db/schema';
import { requestFingerprint } from '@/lib/auth';
import { AppError, cleanEmail } from '@/lib/http';

export const SUPPORT_CATEGORIES = ['technical','pedagogical','billing','voice','documents','account','privacy','security','commercial','other'] as const;
export const TICKET_STATUSES = ['new','waiting','in_progress','answered','resolved','urgent','closed'] as const;
export const LEAD_STATUSES = ['new','callback','demo','quote','proposal','follow_up','accepted','refused'] as const;

export const defaultHelpArticles = [
  ['creer-une-activite','Créer une activité','Création','Depuis le tableau de bord, choisissez « Ouvrir le studio IA » pour partir d’un prompt ou d’un document, ou « Créer manuellement » pour construire chaque élément vous-même.','creation'],
  ['importer-un-document','Importer un PDF, une image ou un document','Documents','Ouvrez « Ma base documentaire », choisissez vos fichiers puis attendez la fin de l’import. Les formats et signatures sont contrôlés avant l’enregistrement dans votre espace privé.','documents'],
  ['ajouter-au-parcours','Ajouter une activité à un parcours','Parcours','Ouvrez un grand thème, sélectionnez la formation puis utilisez le bouton d’ajout depuis la bibliothèque. Vous pouvez ensuite réorganiser les étapes sans supprimer les activités.','paths'],
  ['partager-lien-qr','Partager par lien ou QR code','Partage','Dans une formation, ouvrez « Partager avec les apprenants », choisissez travail à domicile ou direct, puis copiez le lien ou affichez le QR code. L’apprenant n’a pas besoin d’un compte ChatGPT.','sharing'],
  ['resultats-corrections','Consulter les résultats et corrections','Résultats','La rubrique « Résultats » affiche les scores, les réponses, le corrigé détaillé et permet l’export PDF ou Excel selon vos droits.','results'],
  ['microphone-coach-vocal','Autoriser le microphone pour le Coach vocal','Coach vocal','Au démarrage de la séance, acceptez l’autorisation du navigateur. Si elle a été refusée, ouvrez les réglages du site dans le navigateur, réactivez le microphone puis rechargez la page.','voice'],
  ['quota-abonnement','Vérifier la formule et les quotas','Abonnement','Le tableau de bord affiche votre formule, vos crédits et votre consommation vocale. Si une limite est atteinte, les contenus déjà créés restent accessibles.','billing'],
  ['compte-bloque','Compte en attente ou bloqué','Compte','Un nouveau compte formateur doit recevoir un code de l’administrateur. Si votre compte est suspendu ou si le code ne fonctionne plus, créez un ticket en indiquant votre adresse de connexion. Ne transmettez jamais votre mot de passe ni une clé API.','account'],
] as const;

export async function ensureDefaultHelpArticles(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  for (const [slug,title,category,content,feature] of defaultHelpArticles) {
    await getDb().insert(helpArticles).values({ id: crypto.randomUUID(), slug, title, category, summary: content.slice(0, 180), content, keywordsJson: JSON.stringify([title,category,feature]), feature, published: true, createdAt: now, updatedAt: now }).onConflictDoNothing();
  }
}

export function cleanText(value: unknown, max: number, label: string, required = true): string {
  const text = String(value ?? '').trim().replace(/\u0000/g, '');
  if (required && !text) throw new AppError(400, `${label} est requis.`, 'FIELD_REQUIRED');
  if (text.length > max) throw new AppError(400, `${label} est trop long.`, 'FIELD_TOO_LONG');
  return text;
}

export function cleanSupportEmail(value: unknown): string { return cleanEmail(value); }

export function uniqueReference(prefix: 'PP' | 'COM'): string {
  const day = new Date().toISOString().slice(0,10).replaceAll('-','');
  return `${prefix}-${day}-${crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase()}`;
}

export async function assertPublicSubmissionLimit(request: Request, kind: 'support' | 'sales'): Promise<string> {
  const fingerprint = await requestFingerprint(request);
  const now = Math.floor(Date.now() / 1000);
  const recent = await getDb().select({ id: publicSubmissionEvents.id }).from(publicSubmissionEvents).where(and(eq(publicSubmissionEvents.fingerprint, fingerprint), gt(publicSubmissionEvents.createdAt, now - 3600))).limit(6);
  if (recent.length >= 5) throw new AppError(429, 'Trop de demandes ont été envoyées. Réessayez dans une heure.', 'CONTACT_RATE_LIMIT');
  await getDb().insert(publicSubmissionEvents).values({ id: crypto.randomUUID(), fingerprint, kind, createdAt: now });
  return fingerprint;
}

export function supportAdminEmail(): string { return env.INITIAL_ADMIN_EMAIL ?? ''; }
