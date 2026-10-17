import { AsyncLocalStorage } from "node:async_hooks";
import { NextRequest } from "next/server";
import { createGmailTransport, createHistoryPager, createPacer, requestDetails } from "@/utils/gmail/native-core.cjs";

type RequestContext = { priority?: number; metadataOnly?: boolean; signal?: AbortSignal };

// Next may load the same module through multiple route chunks. All mailboxes
// must still reserve units on one timeline and share one history cache.
const processState = globalThis as typeof globalThis & { inboxzeroGmailBudget?: ReturnType<typeof createRuntime> };
const runtime = processState.inboxzeroGmailBudget ??= createRuntime();

export const readGmailHistory = runtime.history;

export const gmailFetch: typeof fetch = (input, options) => runtime.transport(globalThis.fetch, input, options);

export function capGmailRequest(request: NextRequest): NextRequest {
  const details = requestDetails(request.url, request.method);
  const url = new URL(details.url, request.url);
  return url.href === request.url ? request : new NextRequest(url, request);
}

export function withGmailMetadata<T>(operation: () => T): T {
  return runtime.storage.run({ ...runtime.storage.getStore(), metadataOnly: true }, operation);
}

export function withGmailRequest<T>(request: { url: string; method: string; signal: AbortSignal }, operation: () => T): T {
  const details = requestDetails(request.url, request.method);
  return runtime.storage.run({ priority: details.priority, metadataOnly: details.metadataOnly, signal: request.signal }, operation);
}

function createRuntime() {
  const storage = new AsyncLocalStorage<RequestContext>();
  const context = () => storage.getStore();
  const pace = createPacer({ context });
  if (process.env.NODE_ENV !== "test") {
    setInterval(() => {
      console.info("[gmail-guard] " + JSON.stringify({ event: "pacing-window", ...pace.stats() }));
    }, 60_000).unref();
  }
  return { storage, pace, transport: createGmailTransport(pace, { context }), history: createHistoryPager() };
}
