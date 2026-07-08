import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MilitaryExerciseNotice } from "@/lib/military-exercises";
import type { WarStatusResult } from "@/lib/status";

vi.mock("@/lib/military-exercises", () => ({
  getMilitaryExerciseNotices: vi.fn(async () => []),
}));

vi.mock("@/lib/status", () => ({
  nodvarselCredit: {
    text: "Data om aktive nødvarsler kommer fra Nødvarsel.no.",
  },
  getWarStatus: vi.fn(),
}));

const { getMilitaryExerciseNotices } = await import("@/lib/military-exercises");
const { getWarStatus } = await import("@/lib/status");
const { default: Home } = await import("@/app/page");

const baseStatus: Omit<WarStatusResult, "status" | "label" | "message"> = {
  tone: "ok",
  question: "Er det krig i Norge nå?",
  checkedAt: "2026-07-08T10:00:00.000Z",
  source: {
    name: "Nødvarsel",
    url: "https://www.nodvarsel.no/",
    feedUrl: "https://www.nodvarsel.no/rss/rss-aktive-nodvarsler/",
    state: "ok",
  },
  activeAlerts: [],
  triggeredAlerts: [],
  matchedAlerts: [],
  aiReviews: [],
  notifications: [],
};

describe("Home page", () => {
  it("shows the assume-no explanation below the status answer", async () => {
    vi.mocked(getWarStatus).mockResolvedValueOnce({
      ...baseStatus,
      status: "assume-no",
      label: "Anta NEI",
      tone: "unknown",
      message: "venter på kontakt fra pålitelige kilder",
    });

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain("Anta NEI");
    expect(html).toContain("venter på kontakt fra pålitelige kilder");
    expect(html).toContain('class="statusExplanation"');
  });

  it("shows the yes explanation below the status answer", async () => {
    vi.mocked(getWarStatus).mockResolvedValueOnce({
      ...baseStatus,
      status: "yes",
      label: "JA",
      tone: "danger",
      message:
        "Aktivt Nødvarsel tolkes som krig, væpnet angrep eller tilsvarende alvorlig militær hendelse.",
    });

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain("JA");
    expect(html).toContain(
      "Aktivt Nødvarsel tolkes som krig, væpnet angrep eller tilsvarende alvorlig militær hendelse.",
    );
    expect(html).toContain('class="statusExplanation"');
    expect(html).toContain("Følg rådene i aktivt Nødvarsel");
    expect(html).toContain(
      'href="https://www.nodvarsel.no/hva-betyr-radene/"',
    );
  });

  it("does not show a status explanation for regular NEI", async () => {
    vi.mocked(getWarStatus).mockResolvedValueOnce({
      ...baseStatus,
      status: "no",
      label: "NEI",
      message:
        "Ingen aktive Nødvarsler er tolket som krig eller væpnet angrep mot Norge.",
    });

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain("NEI");
    expect(html).not.toContain('class="statusExplanation"');
    expect(html).not.toContain("Følg rådene i aktivt Nødvarsel");
  });

  it("shows military exercise notices separately from war status", async () => {
    const notice: MilitaryExerciseNotice = {
      title: "Testøvelse 2026",
      url: "https://www.forsvaret.no/ovelser/test",
      summary: "Forsvaret gjennomfører øvelse.",
      location: "Nord-Norge",
      dateText: "8.–19. juli 2026.",
      sourceName: "Forsvaret",
      sourceUrl:
        "https://www.forsvaret.no/om-forsvaret/operasjoner-og-ovelser/ovelser",
    };

    vi.mocked(getWarStatus).mockResolvedValueOnce({
      ...baseStatus,
      status: "no",
      label: "NEI",
      message:
        "Ingen aktive Nødvarsler er tolket som krig eller væpnet angrep mot Norge.",
    });
    vi.mocked(getMilitaryExerciseNotices).mockResolvedValueOnce([notice]);

    const html = renderToStaticMarkup(await Home());

    expect(html).toContain("Forsvaret melder om pågående øvelse");
    expect(html).toContain("Testøvelse 2026");
    expect(html).toContain("Det påvirker ikke JA/NEI-statusen over.");
  });
});
