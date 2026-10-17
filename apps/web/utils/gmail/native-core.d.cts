import type { gmail_v1 } from "@googleapis/gmail";
import type { MailboxSource } from "@inboxzero/mail-core/ports/mailbox-source";
import type { OperationExecutor } from "@inboxzero/mail-core/ports/operation-executor";
import type { SyncPosition } from "@inboxzero/mail-core/sync";
import type { EmailProvider, MailboxSyncPage } from "@/utils/email/types";

export const RATE: 75;
export const LIVE_SCOPE: "primary-live";
type Context = { priority?: number; metadataOnly?: boolean; signal?: AbortSignal };
type ContextReader = () => Context | null | undefined;
type RequestInput = string | URL | Request;
type Pace = {
  (input: RequestInput, options?: RequestInit): Promise<void>;
  cooldown(milliseconds: number): void;
  congestion?(): number;
};
export function requestCost(input: RequestInput, options?: RequestInit): number;
export function createPacer(options?: {
  now?: () => number;
  sleep?: (delay: number, signal?: AbortSignal) => Promise<void>;
  unitsPerSecond?: number;
  context?: ContextReader;
}): Pace & { stats(): { grantedUnits: number; grantedRequests: number; maxWaitMs: number; queuedRequests: number; unitsPerSecond: number; byPriority: Record<string, { units: number; requests: number }> } };
export function createGmailTransport(pace: Pace, options?: { cooldownMs?: number; log?: (message: string) => void; context?: ContextReader }): (fetchImplementation: typeof fetch, input: RequestInput, options?: RequestInit) => Promise<Response>;
export function metadataRead(input: RequestInput, options?: RequestInit): { input: RequestInput; options: RequestInit };
export function requestDetails(url: string, method: string): { url: string; metadataOnly?: boolean; priority: number };
export function historyPosition(position: SyncPosition): SyncPosition;
export function createHistoryPager(options?: { now?: () => number; ttlMs?: number; maxStates?: number; maxPendingIds?: number }): (
  provider: Pick<EmailProvider, "getMessagesBatch" | "getMessage" | "getMailboxSyncPage"> & { client: gmail_v1.Gmail },
  accountId: string,
  input: Parameters<EmailProvider["getMailboxSyncPage"]>[0],
) => Promise<MailboxSyncPage>;
export function decorateMailboxSource<T extends MailboxSource>(source: T, provider: Pick<EmailProvider, "name">, options?: { runMetadata?: <R>(operation: () => R) => R }): T;
export function decorateMailboxProvider<T extends Pick<EmailProvider, "name" | "getMessagesBatch" | "getMessage" | "getMailboxSyncPage"> & { client: gmail_v1.Gmail }>(provider: T, accountId: string, historyPager: ReturnType<typeof createHistoryPager>): T;
export function decorateOperationExecutor(executor: OperationExecutor, provider: Pick<EmailProvider, "name">, options?: { runMetadata?: <R>(operation: () => R) => R }): OperationExecutor;
