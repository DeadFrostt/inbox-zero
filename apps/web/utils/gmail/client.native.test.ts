import { describe, expect, it, vi } from "vitest";
import { gmail } from "@googleapis/gmail";
import { createGmailTransport } from "@/utils/gmail/native-core.cjs";

describe("native transport at the real Google SDK boundary", () => {
  it("sends SDK message reads through the shared pacing transport", async () => {
    const pace = Object.assign(vi.fn(async () => {}), { cooldown: vi.fn() });
    const wire = vi.fn(async () => new Response(JSON.stringify({ id: "synthetic", threadId: "thread" }), {
      headers: { "content-type": "application/json" },
    }));
    const transport = createGmailTransport(pace, { log: () => {} });
    const client = gmail({ version: "v1", retry: false,
      fetchImplementation: (input, options) => transport(wire, input, options),
    });
    const result = await client.users.messages.get({ userId: "me", id: "synthetic" });
    expect(result.data.id).toBe("synthetic");
    expect(wire).toHaveBeenCalledTimes(1);
    expect(pace).toHaveBeenCalledTimes(1);
  });

  it("never replays an SDK mutation after a quota response", async () => {
    const pace = Object.assign(vi.fn(async () => {}), { cooldown: vi.fn() });
    const wire = vi.fn(async () => new Response(JSON.stringify({ error: { code: 429, message: "synthetic quota" } }), {
      status: 429, headers: { "content-type": "application/json" },
    }));
    const transport = createGmailTransport(pace, { log: () => {} });
    const client = gmail({ version: "v1", retry: false,
      fetchImplementation: (input, options) => transport(wire, input, options),
    });
    await expect(client.users.messages.modify({ userId: "me", id: "synthetic", requestBody: { addLabelIds: ["STARRED"] } })).rejects.toThrow();
    expect(wire).toHaveBeenCalledTimes(1);
    expect(pace.cooldown).toHaveBeenCalledTimes(1);
  });
});
