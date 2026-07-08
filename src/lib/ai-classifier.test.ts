import { describe, expect, it } from "vitest";
import { classifyAlertWithAi } from "@/lib/ai-classifier";
import type { NodvarselAlert } from "@/lib/status";

const alert: NodvarselAlert = {
  title: "Nødvarsel: Væpnet angrep mot Norge",
  description: "Søk dekning og følg råd fra myndighetene.",
  link: "https://www.nodvarsel.no/varsler/test",
  publishedAt: "Wed, 08 Jul 2026 10:00:00 GMT",
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function output(overrides: Record<string, unknown>) {
  return {
    output_text: JSON.stringify({
      classification: "confirmed_yes",
      confidence: "high",
      applies_to_norway_now: true,
      explicit_war_or_armed_attack: true,
      is_test_or_exercise: false,
      reason: "Varselet sier eksplisitt at Norge er under væpnet angrep.",
      ...overrides,
    }),
  };
}

describe("AI alert classifier", () => {
  it("returns confirmed_yes only when all safety requirements are met", async () => {
    const result = await classifyAlertWithAi(alert, {
      apiKey: "test-key",
      model: "test-model",
      fetcher: async () => response(output({})),
    });

    expect(result.classification).toBe("confirmed_yes");
    expect(result.confidence).toBe("high");
    expect(result.appliesToNorwayNow).toBe(true);
    expect(result.explicitWarOrArmedAttack).toBe(true);
  });

  it("downgrades confirmed_yes to uncertain when confidence is not high", async () => {
    const result = await classifyAlertWithAi(alert, {
      apiKey: "test-key",
      model: "test-model",
      fetcher: async () => response(output({ confidence: "medium" })),
    });

    expect(result.classification).toBe("uncertain");
    expect(result.reason).toContain("nedgradert");
  });

  it("overrides test or exercise alerts to no", async () => {
    const result = await classifyAlertWithAi(alert, {
      apiKey: "test-key",
      model: "test-model",
      fetcher: async () =>
        response(
          output({
            is_test_or_exercise: true,
            reason: "Dette er en øvelse.",
          }),
        ),
    });

    expect(result.classification).toBe("no");
    expect(result.reason).toContain("test eller oevelse");
  });

  it("returns uncertain when OpenAI is not configured", async () => {
    const result = await classifyAlertWithAi(alert, {
      apiKey: "",
      model: "test-model",
    });

    expect(result.classification).toBe("uncertain");
    expect(result.error).toContain("OPENAI_API_KEY");
  });
});
