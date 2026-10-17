import { expect, it, vi } from "vitest";
import type { gmail_v1 } from "@googleapis/gmail";
import { GmailProvider } from "@/utils/email/google";
import { getGmailMailboxSyncPage } from "@/utils/gmail/mailbox-sync";
import type { ParsedMessage } from "@/utils/types";

vi.mock("server-only", () => ({}));
vi.mock("@/utils/prisma");
vi.mock("@/utils/gmail/mailbox-sync", () => ({ getGmailMailboxSyncPage: vi.fn().mockResolvedValue({ cursor: "fallback", hasMore: false, reset: true, upsertedMessages: [], deletedMessageIds: [] }) }));

it("the real Gmail provider prioritizes arrivals over the retained label backlog", async () => {
  const list = vi.fn().mockResolvedValue({ data: { historyId: "20", history: [
    { labelsAdded: Array.from({ length: 15 }, (_, i) => ({ message: { id: `old-${i}` } })) },
    { messagesAdded: [{ message: { id: "new", labelIds: ["INBOX"] } }] },
  ] } });
  const client = { users: { history: { list } }, context: { _options: { auth: { credentials: { access_token: "synthetic" } } } } } as unknown as gmail_v1.Gmail;
  const provider = new GmailProvider(client, undefined, "synthetic-account");
  const batch = vi.spyOn(provider, "getMessagesBatch").mockImplementation(async ids => ids.map(id => ({ id, threadId: `t-${id}`, internalDate: "1000", headers: {}, labelIds: ["INBOX"] }) as ParsedMessage));
  const cursor = Buffer.from(JSON.stringify({ version: 1, provider: "google", phase: "delta", historyId: "10", after: "1970-01-01T00:00:00.000Z", pageToken: "legacy-label-page" })).toString("base64url");
  const page = await provider.getMailboxSyncPage({ cursor, limit: 50 });
  expect(list).toHaveBeenCalledWith(expect.objectContaining({ startHistoryId: "10", maxResults: 500 }));
  expect(batch.mock.calls[0][0][0]).toBe("new");
  expect(batch.mock.calls[0][0]).toHaveLength(10);
  expect(page.hasMore).toBe(true);
  expect(getGmailMailboxSyncPage).not.toHaveBeenCalled();
});
