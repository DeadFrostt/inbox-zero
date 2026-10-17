import { afterEach, describe, expect, it, vi } from "vitest";
import { getBatch } from "./batch";
import { getGoogleGmailBatchUrl } from "@/utils/gmail/oauth";
import { withGmailMetadata } from "@/utils/gmail/native-runtime";

vi.mock("@/utils/gmail/oauth", () => ({
  getGoogleGmailBatchUrl: vi.fn(() => "https://example.com/batch/gmail/v1"),
}));

describe("getBatch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(getGoogleGmailBatchUrl).mockReturnValue("https://example.com/batch/gmail/v1");
  });

  it("sends metadata-only read batches of two through the shared budget", async () => {
    vi.mocked(getGoogleGmailBatchUrl).mockReturnValue("https://www.googleapis.com/batch/gmail/v1");
    const bodies: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: unknown, options: RequestInit) => {
      const body = String(options.body);
      bodies.push(body);
      const ids = [...body.matchAll(/messages\/([^?\s]+)/g)].map(match => match[1]);
      return new Response(ids.map(id => `--response\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ id })}\r\n`).join("") + "--response--", { headers: { "content-type": "multipart/mixed; boundary=response" } });
    }));
    const result = await withGmailMetadata(() => getBatch(["a", "b", "c"], "/gmail/v1/users/me/messages", "synthetic", "format=full"));
    expect(bodies.map(body => [...body.matchAll(/^GET /gm)].length)).toEqual([2, 1]);
    expect(bodies.every(body => !body.includes("format=full") && body.includes("format=metadata"))).toBe(true);
    expect(result.map(item => item.id)).toEqual(["a", "b", "c"]);
  });

  it("prevents message IDs from injecting multipart subrequests", async () => {
    const validId = "18f4c6b280d6f124";
    const injectedId =
      "message-id\r\n\r\n--batch_boundary\r\nContent-Type: application/http\r\n\r\nGET /gmail/v1/users/me/messages/injected";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        '--response_boundary\r\nContent-Type: application/http\r\n\r\nHTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"id":"18f4c6b280d6f124"}\r\n--response_boundary--',
        {
          headers: {
            "Content-Type": "multipart/mixed; boundary=response_boundary",
          },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getBatch(
      [validId, injectedId],
      "/gmail/v1/users/me/messages",
      "access-token",
    );

    const requestBody = fetchMock.mock.calls[0]?.[1]?.body as string;

    expect(requestBody).toContain(
      `GET /gmail/v1/users/me/messages/${validId}\n\n`,
    );
    expect(requestBody).toContain(
      `GET /gmail/v1/users/me/messages/${encodeURIComponent(injectedId)}\n\n`,
    );
    expect(requestBody.match(/^GET /gm)).toHaveLength(2);
    expect(requestBody).not.toContain(
      "\r\nGET /gmail/v1/users/me/messages/injected",
    );
  });
});
