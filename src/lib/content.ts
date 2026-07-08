import type { ConflictCountriesResult } from "@/lib/conflicts";
import type { WarStatusResult } from "@/lib/status";

export type FaqItem = {
  question: string;
  answer: string;
};

export function buildFaqItems(
  status: WarStatusResult,
  conflicts: ConflictCountriesResult,
): FaqItem[] {
  return [
    {
      question: "Er Norge i krig nå?",
      answer: statusAnswer(status),
    },
    {
      question: "Hvilke kilder bruker norgeikrig.no?",
      answer:
        "Statusen for Norge bruker aktiv RSS-feed fra Nødvarsel.no som hovedkilde. Global konfliktliste hentes fra UCDP direkte hvis API-token er konfigurert, ellers fra Our World in Data sin offentlige UCDP-baserte CSV.",
    },
    {
      question: "Er dette en offisiell nettside?",
      answer:
        "Nei. norgeikrig.no er en uavhengig, enkel statusvisning. Ved reell fare skal du følge råd fra politiet, Sivilforsvaret, DSB, regjeringen, Forsvaret og lokale myndigheter.",
    },
    {
      question: "Betyr NEI at alt er trygt?",
      answer:
        "Nei. NEI betyr bare at siden ikke har funnet et aktivt Nødvarsel som tolkes som krig eller væpnet angrep mot Norge. Andre kriser kan fortsatt pågå.",
    },
    {
      question: "Hva betyr Anta NEI?",
      answer:
        "Anta NEI vises når siden ikke får kontakt med pålitelige kilder. Det er en forsiktig fallback, ikke en bekreftelse fra myndighetene.",
    },
    {
      question: "Hvor ofte oppdateres statusen?",
      answer:
        "API-svarene er lagt opp for kort cache, omtrent ett minutt. Siden viser også tidspunktet siste sjekk ble gjort.",
    },
    {
      question: "Hva viser listen over land i konflikt?",
      answer: conflicts.year
        ? `Listen viser land registrert med væpnede konflikthendelser i ${conflicts.year}, som er seneste tilgjengelige år fra ${conflicts.sourceLabel}. Den er ikke sanntidsdata.`
        : "Listen skulle vise land registrert med væpnede konflikthendelser, men kilden kunne ikke hentes akkurat nå.",
    },
    {
      question: "Hvorfor brukes ikke UCDP som fasit for Norge akkurat nå?",
      answer:
        "UCDP er forskningsdata om væpnede konflikter og oppdateres ikke som et norsk krisevarsel. Derfor brukes UCDP/OWID til global oversikt, mens Norge-statusen bruker aktive norske nødvarsler.",
    },
  ];
}

function statusAnswer(status: WarStatusResult): string {
  if (status.status === "yes") {
    return "Siden viser JA fordi minst ett aktivt Nødvarsel er tolket som krig, væpnet angrep eller tilsvarende alvorlig militær hendelse mot Norge. Kontroller alltid råd og varsler direkte fra myndighetene.";
  }

  if (status.status === "assume-no") {
    return "Siden viser Anta NEI fordi den ikke får kontakt med Nødvarsel akkurat nå. Det betyr ikke at myndighetene har bekreftet status; det betyr at siden venter på kontakt fra pålitelige kilder.";
  }

  return "Siden viser NEI fordi den fikk kontakt med Nødvarsel og ikke fant aktive varsler som tolkes som krig eller væpnet angrep mot Norge.";
}
