import { createHash } from "node:crypto";
import { errorMessage, type FetchLike } from "@/lib/fetching";
import type { AlertReview } from "@/lib/ai-classifier";
import type { NodvarselAlert } from "@/lib/status";

export type NotificationResult = {
  state: "sent" | "skipped" | "error";
  reason: string;
  key: string;
};

type SendAlertNotificationOptions = {
  apiKey?: string;
  from?: string;
  to?: string;
  fetcher?: FetchLike;
  dedupe?: boolean;
  now?: Date;
};

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const DEFAULT_TO = "lyder2@mac.com";
const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000;
const sentNotificationKeys = new Map<string, number>();

export async function sendAlertNotification(
  alert: NodvarselAlert,
  review: AlertReview,
  options: SendAlertNotificationOptions = {},
): Promise<NotificationResult> {
  const key = createNotificationKey(alert, review);
  const nowMs = (options.now ?? new Date()).getTime();

  if (options.dedupe !== false && isRecentlySent(key, nowMs)) {
    return {
      state: "skipped",
      reason: "Samme varsel/status er allerede varslet i denne serverprosessen.",
      key,
    };
  }

  const apiKey = options.apiKey ?? process.env.RESEND_API_KEY;
  const from = options.from ?? process.env.ALERT_EMAIL_FROM;
  const to = options.to ?? process.env.ALERT_EMAIL_TO ?? DEFAULT_TO;

  if (!apiKey) {
    return {
      state: "skipped",
      reason: "RESEND_API_KEY mangler, e-post ble ikke sendt.",
      key,
    };
  }

  if (!from) {
    return {
      state: "skipped",
      reason: "ALERT_EMAIL_FROM mangler, e-post ble ikke sendt.",
      key,
    };
  }

  try {
    const response = await (options.fetcher ?? fetch)(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: subjectForReview(review),
        text: textBody(alert, review),
        html: htmlBody(alert, review),
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend svarte med HTTP ${response.status}`);
    }

    markSent(key, nowMs);

    return {
      state: "sent",
      reason: `E-post sendt til ${to}.`,
      key,
    };
  } catch (error) {
    return {
      state: "error",
      reason: errorMessage(error),
      key,
    };
  }
}

export function shouldNotifyForReview(review: AlertReview): boolean {
  return (
    review.classification === "confirmed_yes" ||
    review.classification === "uncertain"
  );
}

function subjectForReview(review: AlertReview): string {
  if (review.classification === "confirmed_yes") {
    return "erdetkriginorge.no har satt JA";
  }

  return "erdetkriginorge.no trenger manuell vurdering";
}

function textBody(alert: NodvarselAlert, review: AlertReview): string {
  return [
    subjectForReview(review),
    "",
    `AI-klassifisering: ${review.classification}`,
    `Tillit: ${review.confidence}`,
    `Gjelder Norge naa: ${review.appliesToNorwayNow ? "ja" : "nei"}`,
    `Eksplisitt krig/vaepnet angrep: ${
      review.explicitWarOrArmedAttack ? "ja" : "nei"
    }`,
    `Test/oevelse: ${review.isTestOrExercise ? "ja" : "nei"}`,
    `Modell: ${review.model}`,
    `Sjekket: ${review.checkedAt}`,
    "",
    `AI-begrunnelse: ${review.reason}`,
    review.error ? `Feil: ${review.error}` : "",
    "",
    "Varsel:",
    `Tittel: ${alert.title || "(tom)"}`,
    `Beskrivelse: ${alert.description || "(tom)"}`,
    `Lenke: ${alert.link || "(tom)"}`,
    `Publisert: ${alert.publishedAt || "(ukjent)"}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function htmlBody(alert: NodvarselAlert, review: AlertReview): string {
  return `<h1>${escapeHtml(subjectForReview(review))}</h1>
<p><strong>AI-klassifisering:</strong> ${escapeHtml(review.classification)}</p>
<p><strong>Tillit:</strong> ${escapeHtml(review.confidence)}</p>
<p><strong>Gjelder Norge naa:</strong> ${
    review.appliesToNorwayNow ? "ja" : "nei"
  }</p>
<p><strong>Eksplisitt krig/vaepnet angrep:</strong> ${
    review.explicitWarOrArmedAttack ? "ja" : "nei"
  }</p>
<p><strong>Test/oevelse:</strong> ${
    review.isTestOrExercise ? "ja" : "nei"
  }</p>
<p><strong>Modell:</strong> ${escapeHtml(review.model)}</p>
<p><strong>Sjekket:</strong> ${escapeHtml(review.checkedAt)}</p>
<p><strong>AI-begrunnelse:</strong> ${escapeHtml(review.reason)}</p>
${review.error ? `<p><strong>Feil:</strong> ${escapeHtml(review.error)}</p>` : ""}
<h2>Varsel</h2>
<p><strong>Tittel:</strong> ${escapeHtml(alert.title || "(tom)")}</p>
<p><strong>Beskrivelse:</strong> ${escapeHtml(alert.description || "(tom)")}</p>
<p><strong>Lenke:</strong> ${
    alert.link ? `<a href="${escapeHtml(alert.link)}">${escapeHtml(alert.link)}</a>` : "(tom)"
  }</p>
<p><strong>Publisert:</strong> ${escapeHtml(alert.publishedAt || "(ukjent)")}</p>`;
}

function createNotificationKey(
  alert: NodvarselAlert,
  review: AlertReview,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        classification: review.classification,
        title: alert.title,
        description: alert.description,
        link: alert.link,
        publishedAt: alert.publishedAt,
      }),
    )
    .digest("hex");
}

function isRecentlySent(key: string, nowMs: number): boolean {
  pruneOldKeys(nowMs);
  const sentAt = sentNotificationKeys.get(key);

  return sentAt !== undefined && nowMs - sentAt < DEDUPE_TTL_MS;
}

function markSent(key: string, nowMs: number): void {
  pruneOldKeys(nowMs);
  sentNotificationKeys.set(key, nowMs);
}

function pruneOldKeys(nowMs: number): void {
  for (const [key, sentAt] of sentNotificationKeys.entries()) {
    if (nowMs - sentAt >= DEDUPE_TTL_MS) {
      sentNotificationKeys.delete(key);
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
