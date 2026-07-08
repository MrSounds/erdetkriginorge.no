import { XMLParser } from "fast-xml-parser";
import { errorMessage, fetchText, type FetchLike } from "@/lib/fetching";
import {
  NODVARSEL_ACTIVE_RSS_URL,
  NODVARSEL_HOME_URL,
  NODVARSEL_RSS_INFO_URL,
} from "@/lib/sources";

export type WarStatus = "yes" | "no" | "assume-no";
export type StatusTone = "danger" | "ok" | "unknown";

export type NodvarselAlert = {
  title: string;
  description: string;
  link: string;
  publishedAt: string | null;
};

export type WarStatusResult = {
  status: WarStatus;
  label: "JA" | "NEI" | "Anta NEI";
  tone: StatusTone;
  question: string;
  message: string;
  checkedAt: string;
  source: {
    name: string;
    url: string;
    feedUrl: string;
    state: "ok" | "error";
    error?: string;
  };
  activeAlerts: NodvarselAlert[];
  matchedAlerts: NodvarselAlert[];
};

type GetWarStatusOptions = {
  fetcher?: FetchLike;
  now?: Date;
  timeoutMs?: number;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

const WAR_PATTERNS = [
  /\bkrig\b/iu,
  /krigshandling/iu,
  /væpnet angrep/iu,
  /angrep mot norge/iu,
  /militært angrep/iu,
  /invasjon/iu,
  /luftangrep/iu,
  /missilangrep/iu,
  /rakettangrep/iu,
];

export async function getWarStatus(
  options: GetWarStatusOptions = {},
): Promise<WarStatusResult> {
  const checkedAt = (options.now ?? new Date()).toISOString();

  try {
    const xml = await fetchText(NODVARSEL_ACTIVE_RSS_URL, {
      fetcher: options.fetcher,
      timeoutMs: options.timeoutMs,
    });
    const activeAlerts = parseNodvarselRss(xml);
    const matchedAlerts = activeAlerts.filter(alertMatchesWar);

    if (matchedAlerts.length > 0) {
      return {
        status: "yes",
        label: "JA",
        tone: "danger",
        question: "Er det krig i Norge nå?",
        message:
          "Aktivt Nødvarsel tolkes som krig, væpnet angrep eller tilsvarende alvorlig militær hendelse.",
        checkedAt,
        source: buildSource("ok"),
        activeAlerts,
        matchedAlerts,
      };
    }

    return {
      status: "no",
      label: "NEI",
      tone: "ok",
      question: "Er det krig i Norge nå?",
      message:
        activeAlerts.length > 0
          ? "Det finnes aktive Nødvarsler, men ingen er tolket som krig eller væpnet angrep mot Norge."
          : "Ingen aktive Nødvarsler er tolket som krig eller væpnet angrep mot Norge.",
      checkedAt,
      source: buildSource("ok"),
      activeAlerts,
      matchedAlerts,
    };
  } catch (error) {
    return {
      status: "assume-no",
      label: "Anta NEI",
      tone: "unknown",
      question: "Er det krig i Norge nå?",
      message: "venter på kontakt fra pålitelige kilder",
      checkedAt,
      source: buildSource("error", errorMessage(error)),
      activeAlerts: [],
      matchedAlerts: [],
    };
  }
}

export function parseNodvarselRss(xml: string): NodvarselAlert[] {
  const parsed = parser.parse(xml.replace(/^\uFEFF/, ""));
  const channel = parsed?.rss?.channel;

  if (!channel) {
    throw new Error("RSS-feed mangler channel");
  }

  const rawItems = channel.item
    ? Array.isArray(channel.item)
      ? channel.item
      : [channel.item]
    : [];

  return rawItems.map((item: Record<string, unknown>) => ({
    title: toText(item.title),
    description: toText(item.description),
    link: toText(item.link),
    publishedAt: toText(item.pubDate) || null,
  }));
}

export function alertMatchesWar(alert: NodvarselAlert): boolean {
  const text = `${alert.title} ${alert.description}`.toLocaleLowerCase("nb-NO");

  return WAR_PATTERNS.some((pattern) => pattern.test(text));
}

function buildSource(
  state: "ok" | "error",
  error?: string,
): WarStatusResult["source"] {
  return {
    name: "Nødvarsel",
    url: NODVARSEL_HOME_URL,
    feedUrl: NODVARSEL_ACTIVE_RSS_URL,
    state,
    error,
  };
}

function toText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (value && typeof value === "object" && "#text" in value) {
    return toText((value as Record<string, unknown>)["#text"]);
  }

  return "";
}

export const nodvarselCredit = {
  text: "Data om aktive nødvarsler kommer fra Nødvarsel.no.",
  homeUrl: NODVARSEL_HOME_URL,
  rssInfoUrl: NODVARSEL_RSS_INFO_URL,
};
