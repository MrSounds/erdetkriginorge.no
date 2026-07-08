import { describe, expect, it } from "vitest";
import { getConflictCountries } from "@/lib/conflicts";
import {
  OWID_CONFLICTS_CSV_URL,
  OWID_CONFLICTS_METADATA_URL,
  UCDP_ORGANIZED_VIOLENCE_API_URL,
} from "@/lib/sources";

const now = new Date("2026-07-08T10:00:00.000Z");
const owidCsv = `Entity,Code,Year,Country where conflict took place - Conflict type: all
Norway,NOR,2024,0
Ukraine,UKR,2024,1
Norway,NOR,2025,0
Ukraine,UKR,2025,1
Yemen,YEM,2025,1
`;
const owidMetadata = JSON.stringify({
  columns: {
    "Country where conflict took place - Conflict type: all": {
      lastUpdated: "2026-06-10",
      nextUpdate: "2027-06-10",
    },
  },
});

function response(body: string, status = 200): Response {
  return new Response(body, { status });
}

describe("conflict countries", () => {
  it("uses OWID CSV when no UCDP token is configured", async () => {
    const result = await getConflictCountries({
      now,
      token: "",
      fetcher: async (input) => {
        const url = String(input);

        if (url === OWID_CONFLICTS_CSV_URL) {
          return response(owidCsv);
        }

        if (url === OWID_CONFLICTS_METADATA_URL) {
          return response(owidMetadata);
        }

        throw new Error(`Unexpected URL: ${url}`);
      },
    });

    expect(result.state).toBe("ok");
    expect(result.source).toBe("owid");
    expect(result.year).toBe(2025);
    expect(result.lastUpdated).toBe("2026-06-10");
    expect(result.countries.map((country) => country.name)).toEqual([
      "Ukraine",
      "Yemen",
    ]);
  });

  it("uses UCDP when a token is configured", async () => {
    const result = await getConflictCountries({
      now,
      token: "test-token",
      currentYear: 2026,
      fetcher: async (input, init) => {
        const url = String(input);
        expect((init?.headers as Record<string, string>)["x-ucdp-access-token"]).toBe(
          "test-token",
        );

        if (url === `${UCDP_ORGANIZED_VIOLENCE_API_URL}?pagesize=500&Year=2026`) {
          return response(JSON.stringify({ Result: [] }));
        }

        if (url === `${UCDP_ORGANIZED_VIOLENCE_API_URL}?pagesize=500&Year=2025`) {
          return response(
            JSON.stringify({
              Result: [
                { country: "Norway", country_id: 385, sb_exist: 0, ns_exist: 0, os_exist: 0 },
                { country: "Ukraine", country_id: 369, sb_exist: 1, ns_exist: 0, os_exist: 0 },
              ],
            }),
          );
        }

        throw new Error(`Unexpected URL: ${url}`);
      },
    });

    expect(result.source).toBe("ucdp");
    expect(result.year).toBe(2025);
    expect(result.countries).toEqual([{ name: "Ukraine", code: "369" }]);
  });

  it("falls back to OWID when UCDP fails", async () => {
    const result = await getConflictCountries({
      now,
      token: "test-token",
      currentYear: 2026,
      fetcher: async (input) => {
        const url = String(input);

        if (url.startsWith(UCDP_ORGANIZED_VIOLENCE_API_URL)) {
          throw new Error("ucdp unavailable");
        }

        if (url === OWID_CONFLICTS_CSV_URL) {
          return response(owidCsv);
        }

        if (url === OWID_CONFLICTS_METADATA_URL) {
          return response(owidMetadata);
        }

        throw new Error(`Unexpected URL: ${url}`);
      },
    });

    expect(result.source).toBe("owid");
    expect(result.warning).toContain("UCDP API feilet");
    expect(result.countries).toHaveLength(2);
  });
});
