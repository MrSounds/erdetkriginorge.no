import { describe, expect, it } from "vitest";
import {
  getMilitaryExerciseNotices,
  parseForsvaretExerciseDetail,
  parseForsvaretExerciseIndex,
} from "@/lib/military-exercises";

const now = new Date("2026-07-10T10:00:00.000Z");

function response(body: string, status = 200): Response {
  return new Response(body, { status });
}

describe("Forsvaret exercise crawler", () => {
  it("parses current exercise links before previous exercises", () => {
    const html = `
      <div id="part-1">
        <a href="/om-forsvaret/operasjoner-og-ovelser/ovelser/aktiv-2026">
          <span class="list-child__title underline-draw__target">Aktiv 2026</span>
        </a>
      </div>
      <div id="part-2">
        <h2>Tidligere øvelser</h2>
        <a href="/om-forsvaret/operasjoner-og-ovelser/ovelser/gammel-2025">
          <span class="list-child__title underline-draw__target">Gammel 2025</span>
        </a>
      </div>
    `;

    expect(parseForsvaretExerciseIndex(html)).toEqual([
      {
        title: "Aktiv 2026",
        url: "https://www.forsvaret.no/om-forsvaret/operasjoner-og-ovelser/ovelser/aktiv-2026",
      },
    ]);
  });

  it("returns a notice when an exercise date range includes today", () => {
    const html = `
      <meta property="og:title" content="Testøvelse 2026" />
      <meta name="description" content="Fra 8. til 19. juli gjennomføres en testøvelse." />
      <ul>
        <li><strong>Hvor: </strong>Troms og Nordland</li>
        <li><strong>Når: </strong>Hoveddelen vil foregå 8.–19. juli 2026.</li>
      </ul>
    `;

    const notice = parseForsvaretExerciseDetail(
      html,
      {
        title: "Fallback",
        url: "https://www.forsvaret.no/test",
      },
      now,
    );

    expect(notice).toMatchObject({
      title: "Testøvelse 2026",
      location: "Troms og Nordland",
      dateText: "Hoveddelen vil foregå 8.–19. juli 2026.",
    });
  });

  it("does not return a notice for exercises that are over", () => {
    const html = `
      <meta property="og:title" content="Ferdig øvelse" />
      <p class="preface">Øvelsen er over, men det vil fortsatt bli militærtrafikk.</p>
      <ul>
        <li><strong>Hvor: </strong>Troms</li>
        <li><strong>Når: </strong>Hoveddelen vil foregå 8.–19. juli 2026.</li>
      </ul>
    `;

    expect(
      parseForsvaretExerciseDetail(
        html,
        {
          title: "Ferdig øvelse",
          url: "https://www.forsvaret.no/test",
        },
        now,
      ),
    ).toBeNull();
  });

  it("fetches active notices without throwing when detail pages fail", async () => {
    const index = `
      <div id="part-1">
        <a href="/om-forsvaret/operasjoner-og-ovelser/ovelser/aktiv-2026">
          <span class="list-child__title underline-draw__target">Aktiv 2026</span>
        </a>
        <a href="/om-forsvaret/operasjoner-og-ovelser/ovelser/feil">
          <span class="list-child__title underline-draw__target">Feil</span>
        </a>
      </div>
      <div id="part-2"></div>
    `;
    const detail = `
      <meta property="og:title" content="Aktiv 2026" />
      <meta name="description" content="Forsvaret gjennomfører øvelse." />
      <ul>
        <li><strong>Hvor: </strong>Nord-Norge</li>
        <li><strong>Når: </strong>8.–19. juli 2026.</li>
      </ul>
    `;

    const notices = await getMilitaryExerciseNotices({
      now,
      fetcher: async (input) => {
        const url = String(input);

        if (url.endsWith("/ovelser")) {
          return response(index);
        }

        if (url.endsWith("/aktiv-2026")) {
          return response(detail);
        }

        return response("ikke funnet", 404);
      },
    });

    expect(notices).toHaveLength(1);
    expect(notices[0].title).toBe("Aktiv 2026");
  });
});
