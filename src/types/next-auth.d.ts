/**
 * NextAuth v5 module augmentation — business state on Session['user'].
 *
 * The session callback in src/lib/auth/auth.ts is the single write
 * site for the four business fields (ADR-0005 §6); QuotaPhase comes
 * from the pure quota engine.
 *
 * Augmentation form is constrained by @auth/core@0.41.2:
 * - node_modules/@auth/core/types.d.ts:204-210 declares
 *   `interface Session extends DefaultSession {}`
 * - node_modules/next-auth/index.d.ts:78 re-exports DefaultSession
 */

import type { DefaultSession } from 'next-auth';
import type { QuotaPhase } from '@/lib/quota/engine';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      tier: 'free' | 'paid';
      superTokens: number;
      bonusRemaining: number;
      quotaPhase: QuotaPhase;
    } & DefaultSession['user'];
  }
}
