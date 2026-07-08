import { XMLParser } from "fast-xml-parser";
import {
  classifyAlertWithAi,
  type AlertReview,
} from "@/lib/ai-classifier";
import { errorMessage, fetchText, type FetchLike } from "@/lib/fetching";
import {
  sendAlertNotification,
  shouldNotifyForReview,
  type NotificationResult,
} from "@/lib/notifications";
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
  triggeredAlerts: NodvarselAlert[];
  matchedAlerts: NodvarselAlert[];
  aiReviews: AlertReview[];
  notifications: NotificationResult[];
};

type GetWarStatusOptions = {
  fetcher?: FetchLike;
  now?: Date;
  timeoutMs?: number;
  classifier?: (alert: NodvarselAlert) => Promise<AlertReview>;
  notifier?: (
    alert: NodvarselAlert,
    review: AlertReview,
  ) => Promise<NotificationResult>;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true,
});

const STATUS_CACHE_TTL_MS = 60 * 1000;
let defaultStatusCache:
  | {
      expiresAt: number;
      result: WarStatusResult;
    }
  | null = null;

const AI_REVIEW_TRIGGER_PATTERNS = [
  /\bkrig\b/iu,
  /krigshandling/iu,
  /\binvasjon\b/iu,
  /\bangrep\b/iu,
  /\bvaepnet angrep\b/iu,
  /væpnet angrep/iu,
  /angrep mot norge/iu,
  /militært angrep/iu,
  /militaert angrep/iu,
  /luftangrep/iu,
  /missilangrep/iu,
  /rakettangrep/iu,
];

export async function getWarStatus(
  options: GetWarStatusOptions = {},
): Promise<WarStatusResult> {
  const cacheKeyApplies = usesDefaultRuntimeOptions(options);
  const nowMs = Date.now();

  if (
    cacheKeyApplies &&
    defaultStatusCache &&
    defaultStatusCache.expiresAt > nowMs
  ) {
    return defaultStatusCache.result;
  }

  const result = await computeWarStatus(options);

  if (cacheKeyApplies) {
    defaultStatusCache = {
      expiresAt: nowMs + STATUS_CACHE_TTL_MS,
      result,
    };
  }

  return result;
}

async function computeWarStatus(
  options: GetWarStatusOptions,
): Promise<WarStatusResult> {
  const checkedAt = (options.now ?? new Date()).toISOString();

  try {
    const xml = await fetchText(NODVARSEL_ACTIVE_RSS_URL, {
      fetcher: options.fetcher,
      timeoutMs: options.timeoutMs,
    });
    const activeAlerts = parseNodvarselRss(xml);
    const triggeredAlerts = activeAlerts.filter(alertMatchesWar);
    const aiReviews = await reviewTriggeredAlerts(triggeredAlerts, options);
    const matchedAlerts = triggeredAlerts.filter(
      (_alert, index) => aiReviews[index]?.classification === "confirmed_yes",
    );
    const notifications = await sendReviewNotifications(
      triggeredAlerts,
      aiReviews,
      options,
    );

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
        triggeredAlerts,
        matchedAlerts,
        aiReviews,
        notifications,
      };
    }

    return {
      status: "no",
      label: "NEI",
      tone: "ok",
      question: "Er det krig i Norge nå?",
      message: statusNoMessage(activeAlerts.length, triggeredAlerts.length),
      checkedAt,
      source: buildSource("ok"),
      activeAlerts,
      triggeredAlerts,
      matchedAlerts,
      aiReviews,
      notifications,
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
      triggeredAlerts: [],
      matchedAlerts: [],
      aiReviews: [],
      notifications: [],
    };
  }
}

function usesDefaultRuntimeOptions(options: GetWarStatusOptions): boolean {
  return (
    !options.fetcher &&
    !options.now &&
    !options.timeoutMs &&
    !options.classifier &&
    !options.notifier
  );
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

  return AI_REVIEW_TRIGGER_PATTERNS.some((pattern) => pattern.test(text));
}

async function reviewTriggeredAlerts(
  triggeredAlerts: NodvarselAlert[],
  options: GetWarStatusOptions,
): Promise<AlertReview[]> {
  const classifier = options.classifier ?? classifyAlertWithAi;

  return Promise.all(
    triggeredAlerts.map(async (alert) => {
      try {
        return await classifier(alert);
      } catch (error) {
        return {
          classification: "uncertain",
          confidence: "low",
          appliesToNorwayNow: false,
          explicitWarOrArmedAttack: false,
          isTestOrExercise: false,
          reason:
            "AI-klassifisering kastet feil. Aktivt varsel med triggerord maa vurderes manuelt.",
          model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
          checkedAt: new Date().toISOString(),
          error: errorMessage(error),
        };
      }
    }),
  );
}

async function sendReviewNotifications(
  triggeredAlerts: NodvarselAlert[],
  aiReviews: AlertReview[],
  options: GetWarStatusOptions,
): Promise<NotificationResult[]> {
  const notifier = options.notifier ?? sendAlertNotification;
  const notifications: NotificationResult[] = [];

  for (const [index, review] of aiReviews.entries()) {
    if (!shouldNotifyForReview(review)) {
      continue;
    }

    notifications.push(await notifier(triggeredAlerts[index], review));
  }

  return notifications;
}

function statusNoMessage(activeAlertsCount: number, triggeredAlertsCount: number) {
  if (triggeredAlertsCount > 0) {
    return "Aktive Nødvarsler med krig/angrep-ord er AI-vurdert, men ikke bekreftet som krig eller væpnet angrep mot Norge.";
  }

  if (activeAlertsCount > 0) {
    return "Det finnes aktive Nødvarsler, men ingen er flagget for AI-vurdering av krig eller væpnet angrep mot Norge.";
  }

  return "Ingen aktive Nødvarsler er tolket som krig eller væpnet angrep mot Norge.";
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
