import { errorMessage, type FetchLike } from "@/lib/fetching";
import type { NodvarselAlert } from "@/lib/status";

export type AlertClassification = "confirmed_yes" | "uncertain" | "no";
export type AlertConfidence = "low" | "medium" | "high";

export type AlertReview = {
  classification: AlertClassification;
  confidence: AlertConfidence;
  appliesToNorwayNow: boolean;
  explicitWarOrArmedAttack: boolean;
  isTestOrExercise: boolean;
  reason: string;
  model: string;
  checkedAt: string;
  error?: string;
};

type ClassifyAlertOptions = {
  apiKey?: string;
  fetcher?: FetchLike;
  model?: string;
  now?: Date;
};

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

type ModelClassification = {
  classification: AlertClassification;
  confidence: AlertConfidence;
  applies_to_norway_now: boolean;
  explicit_war_or_armed_attack: boolean;
  is_test_or_exercise: boolean;
  reason: string;
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5.4-mini";

const CLASSIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "classification",
    "confidence",
    "applies_to_norway_now",
    "explicit_war_or_armed_attack",
    "is_test_or_exercise",
    "reason",
  ],
  properties: {
    classification: {
      type: "string",
      enum: ["confirmed_yes", "uncertain", "no"],
      description:
        "confirmed_yes only if the alert explicitly says Norway is now at war or under armed/military attack.",
    },
    confidence: {
      type: "string",
      enum: ["low", "medium", "high"],
    },
    applies_to_norway_now: {
      type: "boolean",
    },
    explicit_war_or_armed_attack: {
      type: "boolean",
    },
    is_test_or_exercise: {
      type: "boolean",
    },
    reason: {
      type: "string",
    },
  },
};

export async function classifyAlertWithAi(
  alert: NodvarselAlert,
  options: ClassifyAlertOptions = {},
): Promise<AlertReview> {
  const checkedAt = (options.now ?? new Date()).toISOString();
  const model = options.model ?? process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return uncertainReview({
      checkedAt,
      model,
      reason:
        "OPENAI_API_KEY mangler. Aktivt varsel med triggerord maa vurderes manuelt.",
      error: "OPENAI_API_KEY is not configured",
    });
  }

  try {
    const response = await (options.fetcher ?? fetch)(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions:
          "Du er en streng klassifikator for en offentlig norsk statusside. Du skal ikke vaere hjelpsom eller spekulativ. Svar confirmed_yes bare hvis aktivt varsel eksplisitt betyr at Norge naa er i krig eller under vaepnet/militaert angrep. Hvis varselet er test, oevelse, historisk omtale, utenlandsk forhold, beredskap, trussel, medieomtale, forebyggende raad, eller uklart: svar no eller uncertain. Ved tvil: uncertain. Ikke sett confirmed_yes bare fordi ordet krig eller angrep forekommer.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: buildAlertPrompt(alert),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "war_alert_classification",
            strict: true,
            schema: CLASSIFICATION_SCHEMA,
          },
        },
        max_output_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI svarte med HTTP ${response.status}`);
    }

    const data = (await response.json()) as OpenAiResponse;
    const parsed = parseModelClassification(extractOutputText(data));

    return enforceConservativeRules(parsed, checkedAt, model);
  } catch (error) {
    return uncertainReview({
      checkedAt,
      model,
      reason:
        "OpenAI-klassifisering feilet. Aktivt varsel med triggerord maa vurderes manuelt.",
      error: errorMessage(error),
    });
  }
}

function buildAlertPrompt(alert: NodvarselAlert): string {
  return [
    "Vurder dette aktive varselet fra Nødvarsel.",
    "",
    `Tittel: ${alert.title || "(tom)"}`,
    `Beskrivelse: ${alert.description || "(tom)"}`,
    `Lenke: ${alert.link || "(tom)"}`,
    `Publisert: ${alert.publishedAt || "(ukjent)"}`,
    "",
    "Spørsmål: Betyr dette aktive varselet at Norge akkurat naa er i krig eller under vaepnet/militaert angrep, slik at en norsk nettside boer svare JA paa 'Er det krig i Norge naa?'",
  ].join("\n");
}

function extractOutputText(data: OpenAiResponse): string {
  if (typeof data.output_text === "string") {
    return data.output_text;
  }

  for (const output of data.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  throw new Error("OpenAI-respons manglet output_text");
}

function parseModelClassification(text: string): ModelClassification {
  const parsed = JSON.parse(text) as Partial<ModelClassification>;

  if (
    !isClassification(parsed.classification) ||
    !isConfidence(parsed.confidence) ||
    typeof parsed.applies_to_norway_now !== "boolean" ||
    typeof parsed.explicit_war_or_armed_attack !== "boolean" ||
    typeof parsed.is_test_or_exercise !== "boolean" ||
    typeof parsed.reason !== "string"
  ) {
    throw new Error("OpenAI-respons hadde ugyldig schema");
  }

  return {
    classification: parsed.classification,
    confidence: parsed.confidence,
    applies_to_norway_now: parsed.applies_to_norway_now,
    explicit_war_or_armed_attack: parsed.explicit_war_or_armed_attack,
    is_test_or_exercise: parsed.is_test_or_exercise,
    reason: parsed.reason,
  };
}

function enforceConservativeRules(
  parsed: ModelClassification,
  checkedAt: string,
  model: string,
): AlertReview {
  const review: AlertReview = {
    classification: parsed.classification,
    confidence: parsed.confidence,
    appliesToNorwayNow: parsed.applies_to_norway_now,
    explicitWarOrArmedAttack: parsed.explicit_war_or_armed_attack,
    isTestOrExercise: parsed.is_test_or_exercise,
    reason: parsed.reason,
    model,
    checkedAt,
  };

  if (review.isTestOrExercise) {
    return {
      ...review,
      classification: "no",
      reason: `${review.reason} Klassifisering overstyrt til no fordi varselet er test eller oevelse.`,
    };
  }

  if (
    review.classification === "confirmed_yes" &&
    (!review.appliesToNorwayNow ||
      !review.explicitWarOrArmedAttack ||
      review.confidence !== "high")
  ) {
    return {
      ...review,
      classification: "uncertain",
      reason: `${review.reason} Klassifisering nedgradert til uncertain fordi alle sikkerhetskrav for JA ikke var oppfylt.`,
    };
  }

  return review;
}

function uncertainReview({
  checkedAt,
  model,
  reason,
  error,
}: {
  checkedAt: string;
  model: string;
  reason: string;
  error?: string;
}): AlertReview {
  return {
    classification: "uncertain",
    confidence: "low",
    appliesToNorwayNow: false,
    explicitWarOrArmedAttack: false,
    isTestOrExercise: false,
    reason,
    model,
    checkedAt,
    error,
  };
}

function isClassification(value: unknown): value is AlertClassification {
  return value === "confirmed_yes" || value === "uncertain" || value === "no";
}

function isConfidence(value: unknown): value is AlertConfidence {
  return value === "low" || value === "medium" || value === "high";
}
