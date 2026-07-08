import { parse } from "csv-parse/sync";
import { errorMessage, fetchText, type FetchLike } from "@/lib/fetching";
import {
  OWID_CONFLICTS_CHART_URL,
  OWID_CONFLICTS_CSV_URL,
  OWID_CONFLICTS_METADATA_URL,
  UCDP_API_DOCS_URL,
  UCDP_ORGANIZED_VIOLENCE_API_URL,
} from "@/lib/sources";

export type ConflictCountry = {
  name: string;
  code: string;
};

export type ConflictCountriesResult = {
  state: "ok" | "error";
  source: "ucdp" | "owid";
  sourceLabel: string;
  sourceUrl: string;
  year: number | null;
  lastUpdated: string | null;
  nextUpdate: string | null;
  checkedAt: string;
  countries: ConflictCountry[];
  note: string;
  warning?: string;
  error?: string;
};

type GetConflictCountriesOptions = {
  fetcher?: FetchLike;
  token?: string;
  currentYear?: number;
  now?: Date;
  timeoutMs?: number;
};

type OwidRow = {
  Entity: string;
  Code: string;
  Year: string;
  [key: string]: string;
};

type OwidMetadata = {
  columns?: Record<
    string,
    {
      lastUpdated?: string;
      nextUpdate?: string;
      descriptionKey?: string[];
    }
  >;
};

export async function getConflictCountries(
  options: GetConflictCountriesOptions = {},
): Promise<ConflictCountriesResult> {
  const checkedAt = (options.now ?? new Date()).toISOString();
  const token = options.token ?? process.env.UCDP_API_TOKEN;
  let ucdpWarning: string | undefined;

  if (token) {
    try {
      return await getUcdpConflictCountries({
        ...options,
        checkedAt,
        token,
      });
    } catch (error) {
      ucdpWarning = `UCDP API feilet, bruker OWID fallback: ${errorMessage(error)}`;
    }
  }

  try {
    const result = await getOwidConflictCountries({
      ...options,
      checkedAt,
    });

    return {
      ...result,
      warning: ucdpWarning,
    };
  } catch (error) {
    return {
      state: "error",
      source: "owid",
      sourceLabel: "Our World in Data / UCDP",
      sourceUrl: OWID_CONFLICTS_CHART_URL,
      year: null,
      lastUpdated: null,
      nextUpdate: null,
      checkedAt,
      countries: [],
      note: "Klarte ikke hente global konfliktliste akkurat nå.",
      warning: ucdpWarning,
      error: errorMessage(error),
    };
  }
}

async function getOwidConflictCountries(
  options: GetConflictCountriesOptions & { checkedAt: string },
): Promise<ConflictCountriesResult> {
  const [csv, metadata] = await Promise.all([
    fetchText(OWID_CONFLICTS_CSV_URL, {
      fetcher: options.fetcher,
      timeoutMs: options.timeoutMs,
    }),
    fetchOwidMetadata(options).catch(() => null),
  ]);

  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
  }) as OwidRow[];
  const valueColumn = findConflictValueColumn(rows[0]);

  if (!valueColumn) {
    throw new Error("OWID-data mangler konfliktkolonne");
  }

  const latestYear = Math.max(
    ...rows.map((row) => Number(row.Year)).filter(Number.isFinite),
  );

  const countries = dedupeCountries(
    rows
      .filter(
        (row) =>
          Number(row.Year) === latestYear && Number(row[valueColumn]) === 1,
      )
      .map((row) => ({
        name: row.Entity,
        code: row.Code,
      })),
  );

  const metadataColumn = metadata?.columns?.[valueColumn];

  return {
    state: "ok",
    source: "owid",
    sourceLabel: "Our World in Data / UCDP",
    sourceUrl: OWID_CONFLICTS_CHART_URL,
    year: latestYear,
    lastUpdated: metadataColumn?.lastUpdated ?? null,
    nextUpdate: metadataColumn?.nextUpdate ?? null,
    checkedAt: options.checkedAt,
    countries,
    note:
      "Listen viser land med registrerte væpnede konflikthendelser i seneste tilgjengelige UCDP/OWID-år. Dette er ikke en sanntidsvarsling.",
  };
}

async function fetchOwidMetadata(
  options: GetConflictCountriesOptions,
): Promise<OwidMetadata> {
  const text = await fetchText(OWID_CONFLICTS_METADATA_URL, {
    fetcher: options.fetcher,
    timeoutMs: options.timeoutMs,
  });

  return JSON.parse(text) as OwidMetadata;
}

async function getUcdpConflictCountries(
  options: GetConflictCountriesOptions & { checkedAt: string; token: string },
): Promise<ConflictCountriesResult> {
  const currentYear = options.currentYear ?? new Date().getUTCFullYear();
  const candidateYears = [...new Set([currentYear, currentYear - 1, currentYear - 2])];

  for (const year of candidateYears) {
    const url = `${UCDP_ORGANIZED_VIOLENCE_API_URL}?pagesize=500&Year=${year}`;
    const text = await fetchText(url, {
      fetcher: options.fetcher,
      timeoutMs: options.timeoutMs,
      headers: {
        "x-ucdp-access-token": options.token,
      },
    });
    const payload = JSON.parse(text) as { Result?: Record<string, unknown>[] };
    const rows = Array.isArray(payload.Result) ? payload.Result : [];

    if (rows.length === 0) {
      continue;
    }

    const countries = dedupeCountries(
      rows.filter(rowHasConflict).map((row) => ({
        name: toStringField(row.country ?? row.Country),
        code: toStringField(row.country_id ?? row.Country_Id),
      })),
    );

    return {
      state: "ok",
      source: "ucdp",
      sourceLabel: "UCDP API",
      sourceUrl: UCDP_API_DOCS_URL,
      year,
      lastUpdated: null,
      nextUpdate: null,
      checkedAt: options.checkedAt,
      countries,
      note:
        "Listen viser land med organisert vold registrert i UCDP Country-Year Dataset. Dette er ikke en sanntidsvarsling.",
    };
  }

  throw new Error("UCDP API returnerte ingen country-year rader");
}

function findConflictValueColumn(row: OwidRow | undefined): string | null {
  if (!row) {
    return null;
  }

  return (
    Object.keys(row).find(
      (key) => !["Entity", "Code", "Year"].includes(key),
    ) ?? null
  );
}

function rowHasConflict(row: Record<string, unknown>): boolean {
  return ["sb_exist", "ns_exist", "os_exist", "Sb_exist", "Ns_exist", "Os_exist"].some(
    (key) => Number(row[key]) === 1,
  );
}

function dedupeCountries(countries: ConflictCountry[]): ConflictCountry[] {
  const seen = new Map<string, ConflictCountry>();

  for (const country of countries) {
    if (!country.name) {
      continue;
    }

    const key = country.code || country.name;
    seen.set(key, country);
  }

  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "nb"));
}

function toStringField(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}
