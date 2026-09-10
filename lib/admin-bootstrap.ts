import { timingSafeEqual } from './security.ts';

type InitialAdminEligibilityInput = {
  email: string;
  configuredEmail?: string;
  adminExists: boolean;
  platformUserId?: string | null;
  platformEmail?: string | null;
  submittedToken?: string;
  configuredToken?: string;
};

export type InitialAdminEligibility = {
  wantsAdmin: boolean;
  allowed: boolean;
  method: 'platform_identity' | 'bootstrap_token' | null;
  reason: 'not_configured_email' | 'already_initialized' | 'identity_required' | null;
};

export function getInitialAdminEligibility(input: InitialAdminEligibilityInput): InitialAdminEligibility {
  const configuredEmail = input.configuredEmail?.trim().toLowerCase() ?? '';
  const platformEmail = input.platformEmail?.trim().toLowerCase() ?? '';
  const wantsAdmin = Boolean(configuredEmail) && input.email === configuredEmail;

  if (!wantsAdmin) return { wantsAdmin: false, allowed: false, method: null, reason: 'not_configured_email' };
  if (input.adminExists) return { wantsAdmin: true, allowed: false, method: null, reason: 'already_initialized' };

  const platformIdentityMatches = Boolean(input.platformUserId) && platformEmail === input.email;
  if (platformIdentityMatches) return { wantsAdmin: true, allowed: true, method: 'platform_identity', reason: null };

  const tokenMatches = Boolean(input.configuredToken) && timingSafeEqual(input.submittedToken ?? '', input.configuredToken ?? '');
  if (tokenMatches) return { wantsAdmin: true, allowed: true, method: 'bootstrap_token', reason: null };

  return { wantsAdmin: true, allowed: false, method: null, reason: 'identity_required' };
}
