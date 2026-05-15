/**
 * NextAuth v5 module augmentation — D.2 skeleton.
 *
 * Phase D.4 will extend Session['user'] with tier / superTokens /
 * bonusRemaining / quotaPhase once the session callback lands. Kept
 * minimal here to keep D.2's surface area to wiring only.
 *
 * Augmentation form is constrained by @auth/core@0.41.2:
 * - node_modules/@auth/core/types.d.ts:204-210 declares
 *   `interface Session extends DefaultSession {}`
 * - node_modules/next-auth/index.d.ts:78 re-exports DefaultSession
 *
 * See docs/adr/0005-v1-auth-shape.md §6.
 */

import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}
