import { expect, it, vi } from "vitest";
import { createEmailProviderMailboxSource } from "./source";
import type { EmailProvider } from "@/utils/email/types";

it("starts an independent live scope before importing the archive", async () => {
  const source = createEmailProviderMailboxSource({
    accountId: "synthetic-account",
    provider: { name: "google" } as EmailProvider,
  });
  const result = await source.discoverScopes({
    session: { accountId: "synthetic-account", generation: "g" },
    requestId: "scopes",
    signal: new AbortController().signal,
  });
  expect(result).toMatchObject({ status: "ok", value: { scopes: [
    { id: "primary-live", priority: "high" },
    { id: "primary", priority: "low" },
  ] } });
});

it("finishes live bootstrap without enumerating or hydrating the archive", async () => {
  const checkpoint = Buffer.from(JSON.stringify({ version: 1, provider: "google", phase: "snapshot", historyId: "10", after: "1970-01-01T00:00:00.000Z", pageToken: "archive-next" })).toString("base64url");
  const getMessagesWithPagination = vi.fn();
  const provider = { name: "google", getMailboxSyncPage: vi.fn().mockResolvedValue({ cursor: checkpoint }), getMessagesWithPagination } as unknown as EmailProvider;
  const source = createEmailProviderMailboxSource({ accountId: "a", provider });
  const session = { accountId: "a", generation: "g" };
  const signal = new AbortController().signal;
  const boot = await source.beginBootstrap({ scope: { id: "primary-live", kind: "account", folderId: null }, session, requestId: "boot", signal });
  expect(boot.status).toBe("ok");
  if (boot.status !== "ok") throw new Error("Bootstrap failed");
  const result = await source.enumerate({ session, requestId: "enumerate", bootstrapId: boot.value.bootstrapId, page: boot.value.enumerationToken, pageSize: 50, signal });
  expect(result).toMatchObject({ status: "ok", value: { changes: [], requiredHydration: [], bodies: [], nextPage: null, catchUpFrom: { streamId: "primary-live" } } });
  expect(getMessagesWithPagination).not.toHaveBeenCalled();
  expect(JSON.parse(Buffer.from(boot.value.catchUpFrom!.checkpoint!, "base64url").toString())).toMatchObject({ phase: "delta", historyId: "10" });
});
