import { describe, expect, it } from "vitest";
import {
  alertMatchesWar,
  getWarStatus,
  parseNodvarselRss,
  type NodvarselAlert,
} from "@/lib/status";

const now = new Date("2026-07-08T10:00:00.000Z");

function response(body: string, status = 200): Response {
  return new Response(body, { status });
}

describe("Nødvarsel status", () => {
  it("returns NEI when the active RSS feed has no items", async () => {
    const rss = `<?xml version="1.0" encoding="utf-8"?><rss><channel><title>RSS Aktive Nødvarsler</title></channel></rss>`;

    const result = await getWarStatus({
      now,
      fetcher: async () => response(rss),
    });

    expect(result.status).toBe("no");
    expect(result.label).toBe("NEI");
    expect(result.activeAlerts).toHaveLength(0);
  });

  it("returns JA when an active alert matches war wording", async () => {
    const rss = `<?xml version="1.0" encoding="utf-8"?>
      <rss><channel><item>
        <title>Nødvarsel: Væpnet angrep mot Norge</title>
        <description>Søk dekning og følg råd fra myndighetene.</description>
        <link>https://www.nodvarsel.no/varsler/test</link>
        <pubDate>Wed, 08 Jul 2026 10:00:00 GMT</pubDate>
      </item></channel></rss>`;

    const result = await getWarStatus({
      now,
      fetcher: async () => response(rss),
    });

    expect(result.status).toBe("yes");
    expect(result.label).toBe("JA");
    expect(result.matchedAlerts).toHaveLength(1);
  });

  it("keeps NEI for active alerts that are not war alerts", async () => {
    const rss = `<?xml version="1.0" encoding="utf-8"?>
      <rss><channel><item>
        <title>Nødvarsel: Ekstremvær</title>
        <description>Hold deg innendørs.</description>
      </item></channel></rss>`;

    const result = await getWarStatus({
      now,
      fetcher: async () => response(rss),
    });

    expect(result.status).toBe("no");
    expect(result.activeAlerts).toHaveLength(1);
    expect(result.matchedAlerts).toHaveLength(0);
  });

  it("returns Anta NEI when the source cannot be fetched", async () => {
    const result = await getWarStatus({
      now,
      fetcher: async () => {
        throw new Error("network down");
      },
    });

    expect(result.status).toBe("assume-no");
    expect(result.label).toBe("Anta NEI");
    expect(result.message).toBe("venter på kontakt fra pålitelige kilder");
    expect(result.source.state).toBe("error");
  });

  it("parses one RSS item into an alert", () => {
    const alerts = parseNodvarselRss(
      `<rss><channel><item><title>Test</title><description>Beskrivelse</description><link>https://example.com</link></item></channel></rss>`,
    );

    expect(alerts).toEqual([
      {
        title: "Test",
        description: "Beskrivelse",
        link: "https://example.com",
        publishedAt: null,
      },
    ]);
  });

  it("matches Norwegian war terms", () => {
    const alert: NodvarselAlert = {
      title: "Militært angrep registrert",
      description: "",
      link: "",
      publishedAt: null,
    };

    expect(alertMatchesWar(alert)).toBe(true);
  });
});
