import { fetchText, type FetchLike } from "@/lib/fetching";
import { FORSVARET_EXERCISES_URL } from "@/lib/sources";

export type MilitaryExerciseNotice = {
  title: string;
  url: string;
  summary: string;
  location: string | null;
  dateText: string | null;
  sourceName: "Forsvaret";
  sourceUrl: string;
};

type ExerciseCandidate = {
  title: string;
  url: string;
};

type GetMilitaryExerciseNoticesOptions = {
  fetcher?: FetchLike;
  now?: Date;
  timeoutMs?: number;
  maxDetailPages?: number;
};

const FORSVARET_BASE_URL = "https://www.forsvaret.no";
const CACHE_TTL_MS = 60 * 60 * 1000;
const DEFAULT_MAX_DETAIL_PAGES = 12;

const MONTHS: Record<string, number> = {
  januar: 1,
  februar: 2,
  mars: 3,
  april: 4,
  mai: 5,
  juni: 6,
  juli: 7,
  august: 8,
  september: 9,
  oktober: 10,
  november: 11,
  desember: 12,
};

const MONTH_PATTERN = Object.keys(MONTHS).join("|");

let defaultExerciseCache:
  | {
      expiresAt: number;
      notices: MilitaryExerciseNotice[];
    }
  | null = null;

export async function getMilitaryExerciseNotices(
  options: GetMilitaryExerciseNoticesOptions = {},
): Promise<MilitaryExerciseNotice[]> {
  const cacheKeyApplies = usesDefaultRuntimeOptions(options);
  const nowMs = Date.now();

  if (
    cacheKeyApplies &&
    defaultExerciseCache &&
    defaultExerciseCache.expiresAt > nowMs
  ) {
    return defaultExerciseCache.notices;
  }

  const notices = await fetchMilitaryExerciseNotices(options);

  if (cacheKeyApplies) {
    defaultExerciseCache = {
      expiresAt: nowMs + CACHE_TTL_MS,
      notices,
    };
  }

  return notices;
}

export function parseForsvaretExerciseIndex(html: string): ExerciseCandidate[] {
  const currentSection =
    html.match(/<div id="part-1"[\s\S]*?(?=<div id="part-2")/i)?.[0] ?? html;
  const candidates: ExerciseCandidate[] = [];
  const seenUrls = new Set<string>();
  const linkPattern =
    /<a\s+[^>]*href="([^"]+)"[^>]*>[\s\S]*?<span\s+class="[^"]*\blist-child__title\b[^"]*"[^>]*>([\s\S]*?)<\/span>/giu;

  for (const match of currentSection.matchAll(linkPattern)) {
    const url = absoluteForsvaretUrl(decodeHtml(match[1]));
    const title = stripHtml(match[2]);

    if (!url || !title || seenUrls.has(url)) {
      continue;
    }

    seenUrls.add(url);
    candidates.push({ title, url });
  }

  return candidates;
}

export function parseForsvaretExerciseDetail(
  html: string,
  candidate: ExerciseCandidate,
  now: Date,
): MilitaryExerciseNotice | null {
  const pageText = stripHtml(html).toLocaleLowerCase("nb-NO");
  const dateText = extractFact(html, "Når");

  if (!dateText || exerciseIsExplicitlyOver(pageText)) {
    return null;
  }

  const dateRanges = parseNorwegianDateRanges(dateText);
  const currentDay = osloDayKey(now);
  const activeRange = dateRanges.find(
    (range) => range.start <= currentDay && currentDay <= range.end,
  );

  if (!activeRange) {
    return null;
  }

  const title = extractMetaContent(html, "og:title") ?? candidate.title;
  const description =
    extractMetaContent(html, "description") ??
    extractMetaContent(html, "og:description") ??
    "Forsvaret har publisert informasjon om en militær øvelse.";

  return {
    title,
    url: candidate.url,
    summary: summarizeText(description),
    location: extractFact(html, "Hvor"),
    dateText,
    sourceName: "Forsvaret",
    sourceUrl: FORSVARET_EXERCISES_URL,
  };
}

async function fetchMilitaryExerciseNotices(
  options: GetMilitaryExerciseNoticesOptions,
): Promise<MilitaryExerciseNotice[]> {
  try {
    const indexHtml = await fetchText(FORSVARET_EXERCISES_URL, {
      fetcher: options.fetcher,
      timeoutMs: options.timeoutMs,
    });
    const candidates = parseForsvaretExerciseIndex(indexHtml).slice(
      0,
      options.maxDetailPages ?? DEFAULT_MAX_DETAIL_PAGES,
    );
    const now = options.now ?? new Date();
    const detailResults = await Promise.all(
      candidates.map(async (candidate) => {
        try {
          const detailHtml = await fetchText(candidate.url, {
            fetcher: options.fetcher,
            timeoutMs: options.timeoutMs,
          });

          return parseForsvaretExerciseDetail(detailHtml, candidate, now);
        } catch {
          return null;
        }
      }),
    );

    return detailResults.filter((notice) => notice !== null).slice(0, 3);
  } catch {
    return [];
  }
}

function usesDefaultRuntimeOptions(
  options: GetMilitaryExerciseNoticesOptions,
): boolean {
  return (
    !options.fetcher &&
    !options.now &&
    !options.timeoutMs &&
    !options.maxDetailPages
  );
}

function extractFact(html: string, label: "Hvor" | "Når"): string | null {
  const factPattern = new RegExp(
    `<li[^>]*>\\s*<strong>\\s*${label}\\s*:?\\s*<\\/strong>([\\s\\S]*?)<\\/li>`,
    "iu",
  );
  const match = html.match(factPattern);

  return match ? stripHtml(match[1]) : null;
}

function extractMetaContent(
  html: string,
  nameOrProperty: "description" | "og:title" | "og:description",
): string | null {
  const metaPattern = new RegExp(
    `<meta\\s+(?:name|property)=["']${escapeRegExp(
      nameOrProperty,
    )}["']\\s+content=["']([^"']+)["']`,
    "iu",
  );
  const reversedMetaPattern = new RegExp(
    `<meta\\s+content=["']([^"']+)["']\\s+(?:name|property)=["']${escapeRegExp(
      nameOrProperty,
    )}["']`,
    "iu",
  );
  const match = html.match(metaPattern) ?? html.match(reversedMetaPattern);

  return match ? decodeHtml(match[1]).trim() : null;
}

function exerciseIsExplicitlyOver(text: string): boolean {
  return [
    "øvelsen er over",
    "øvelsen er avsluttet",
    "øvelsen ble avsluttet",
    "ble avsluttet",
  ].some((phrase) => text.includes(phrase));
}

function parseNorwegianDateRanges(text: string): Array<{
  start: number;
  end: number;
}> {
  const ranges: Array<{ start: number; end: number }> = [];
  const normalized = text.replace(/\u00a0/g, " ");
  const crossMonthPattern = new RegExp(
    `(\\d{1,2})\\.?\\s*(${MONTH_PATTERN})\\s*(?:til|[–—-])\\s*(\\d{1,2})\\.?\\s*(${MONTH_PATTERN})\\s*(\\d{4})`,
    "giu",
  );
  const sameMonthPattern = new RegExp(
    `(?:fra\\s+)?(\\d{1,2})\\.?\\s*(?:til|[–—-])\\s*(\\d{1,2})\\.?\\s*(${MONTH_PATTERN})\\s*(\\d{4})`,
    "giu",
  );
  const singleDatePattern = new RegExp(
    `(\\d{1,2})\\.?\\s*(${MONTH_PATTERN})\\s*(\\d{4})`,
    "giu",
  );

  for (const match of normalized.matchAll(crossMonthPattern)) {
    const start = dateKey(
      Number(match[5]),
      monthNumber(match[2]),
      Number(match[1]),
    );
    const end = dateKey(
      Number(match[5]),
      monthNumber(match[4]),
      Number(match[3]),
    );

    if (start && end) {
      ranges.push(normalizeRange(start, end));
    }
  }

  for (const match of normalized.matchAll(sameMonthPattern)) {
    const year = Number(match[4]);
    const month = monthNumber(match[3]);
    const start = dateKey(year, month, Number(match[1]));
    const end = dateKey(year, month, Number(match[2]));

    if (start && end) {
      ranges.push(normalizeRange(start, end));
    }
  }

  if (ranges.length === 0) {
    for (const match of normalized.matchAll(singleDatePattern)) {
      const singleDate = dateKey(
        Number(match[3]),
        monthNumber(match[2]),
        Number(match[1]),
      );

      if (singleDate) {
        ranges.push({ start: singleDate, end: singleDate });
      }
    }
  }

  return ranges;
}

function monthNumber(month: string): number {
  return MONTHS[month.toLocaleLowerCase("nb-NO")] ?? 0;
}

function dateKey(year: number, month: number, day: number): number | null {
  if (!year || !month || !day) {
    return null;
  }

  return Date.UTC(year, month - 1, day);
}

function normalizeRange(
  start: number,
  end: number,
): { start: number; end: number } {
  return start <= end ? { start, end } : { start: end, end: start };
}

function osloDayKey(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
  );
}

function absoluteForsvaretUrl(href: string): string | null {
  try {
    const url = new URL(href, FORSVARET_BASE_URL);

    return url.hostname === "www.forsvaret.no" ? url.toString() : null;
  } catch {
    return null;
  }
}

function summarizeText(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  return normalized.length > 220
    ? `${normalized.slice(0, 217).trimEnd()}...`
    : normalized;
}

function stripHtml(html: string): string {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/giu, " ")
      .replace(/<style[\s\S]*?<\/style>/giu, " ")
      .replace(/<[^>]+>/gu, " ")
      .replace(/\s+/gu, " ")
      .trim(),
  );
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&#(\d+);/gu, (_match, codePoint: string) =>
      String.fromCodePoint(Number(codePoint)),
    )
    .replace(/&#x([\da-f]+);/giu, (_match, codePoint: string) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16)),
    )
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
