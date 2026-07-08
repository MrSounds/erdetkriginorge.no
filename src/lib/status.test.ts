import { describe, expect, it } from "vitest";
import type { AlertReview } from "@/lib/ai-classifier";
import type { NotificationResult } from "@/lib/notifications";
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

function review(
  classification: AlertReview["classification"],
): AlertReview {
  return {
    classification,
    confidence: classification === "confirmed_yes" ? "high" : "low",
    appliesToNorwayNow: classification === "confirmed_yes",
    explicitWarOrArmedAttack: classification === "confirmed_yes",
    isTestOrExercise: false,
    reason: `test ${classification}`,
    model: "test-model",
    checkedAt: now.toISOString(),
  };
}

function notification(state: NotificationResult["state"]): NotificationResult {
  return {
    state,
    reason: `test ${state}`,
    key: "test-key",
  };
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
    expect(result.triggeredAlerts).toHaveLength(0);
    expect(result.aiReviews).toHaveLength(0);
  });

  it("does not return JA for war wording unless AI confirms it", async () => {
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
      classifier: async () => review("uncertain"),
      notifier: async () => notification("sent"),
    });

    expect(result.status).toBe("no");
    expect(result.label).toBe("NEI");
    expect(result.triggeredAlerts).toHaveLength(1);
    expect(result.matchedAlerts).toHaveLength(0);
    expect(result.aiReviews).toHaveLength(1);
    expect(result.aiReviews[0].classification).toBe("uncertain");
    expect(result.notifications).toHaveLength(1);
  });

  it("returns JA and sends notification when AI confirms war in Norway", async () => {
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
      classifier: async () => review("confirmed_yes"),
      notifier: async () => notification("sent"),
    });

    expect(result.status).toBe("yes");
    expect(result.label).toBe("JA");
    expect(result.triggeredAlerts).toHaveLength(1);
    expect(result.matchedAlerts).toHaveLength(1);
    expect(result.aiReviews[0].classification).toBe("confirmed_yes");
    expect(result.notifications).toEqual([notification("sent")]);
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
    expect(result.triggeredAlerts).toHaveLength(0);
    expect(result.matchedAlerts).toHaveLength(0);
  });

  it("keeps NEI when trigger words exist but OpenAI is not configured", async () => {
    const rss = `<?xml version="1.0" encoding="utf-8"?>
      <rss><channel><item>
        <title>Nødvarsel: Invasjon omtales i beredskapsråd</title>
        <description>Dette er ikke et varsel om krig i Norge.</description>
      </item></channel></rss>`;

    const result = await getWarStatus({
      now,
      fetcher: async () => response(rss),
      notifier: async () => notification("skipped"),
    });

    expect(result.status).toBe("no");
    expect(result.triggeredAlerts).toHaveLength(1);
    expect(result.matchedAlerts).toHaveLength(0);
    expect(result.aiReviews[0].classification).toBe("uncertain");
    expect(result.aiReviews[0].error).toContain("OPENAI_API_KEY");
    expect(result.notifications).toEqual([notification("skipped")]);
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
    expect(result.aiReviews).toHaveLength(0);
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

  it("uses Norwegian war terms as AI review triggers", () => {
    const alert: NodvarselAlert = {
      title: "Militært angrep registrert",
      description: "",
      link: "",
      publishedAt: null,
    };

    expect(alertMatchesWar(alert)).toBe(true);
  });
});
