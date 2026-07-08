import {
  FORSVARET_ACTIVITY_CALENDAR_URL,
  FORSVARET_EXERCISES_URL,
  FORSVARET_OPERATIONS_EXERCISES_URL,
  NODVARSEL_ADVICE_URL,
  NODVARSEL_HOME_URL,
  NODVARSEL_RSS_INFO_URL,
} from "@/lib/sources";
import { getMilitaryExerciseNotices } from "@/lib/military-exercises";
import { getWarStatus, nodvarselCredit } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [status, militaryExerciseNotices] = await Promise.all([
    getWarStatus(),
    getMilitaryExerciseNotices(),
  ]);
  const showStatusExplanation =
    status.status === "yes" || status.status === "assume-no";
  const faqItems = [
    {
      question: "Er Norge i krig nå?",
      answer:
        status.status === "yes"
          ? "Siden viser JA fordi et aktivt Nødvarsel er tolket som krig, væpnet angrep eller tilsvarende alvorlig militær hendelse mot Norge. Følg alltid råd direkte fra myndighetene."
          : status.status === "assume-no"
            ? "Siden viser Anta NEI fordi den ikke får kontakt med Nødvarsel akkurat nå. Det er ikke en bekreftelse fra myndighetene, men en fallback mens siden venter på kontakt fra pålitelige kilder."
            : `Siden viser NEI. ${status.message}`,
    },
    {
      question: "Hva gjør man om JA?",
      answer:
        "Hvis siden viser JA, skal du først og fremst følge rådene i det aktive Nødvarselet og informasjon direkte fra myndighetene. Nødvarsel forklarer at du bør lese eller lytte til varselet, søke informasjon fra kilder du stoler på, følge råd fra myndighetene og være ekstra oppmerksom på feilinformasjon. NRK P1 er beredskapskanalen dersom andre nyhetsmedier eller offentlige nettsteder ikke er tilgjengelige. Les mer hos Nødvarsel: " +
        NODVARSEL_ADVICE_URL,
    },
    {
      question: "Hvor hentes statusen fra?",
      answer:
        "Statusen hentes fra aktive Nødvarsler fra Nødvarsel.no. Siden leser den offentlige RSS-feeden jevnlig og bruker bare aktive varsler som grunnlag for statusen.",
    },
    {
      question: "Hva skal til for at siden viser JA?",
      answer:
        "Siden viser bare JA hvis et aktivt Nødvarsel eksplisitt tolkes som krig, væpnet angrep eller tilsvarende alvorlig militær hendelse mot Norge. Et mulig JA-varsel vurderes først strengt av KI og varsles deretter for rask menneskelig verifisering.",
    },
    {
      question: "Hva skjer hvis systemet er usikkert?",
      answer:
        "Ved usikkerhet viser siden ikke JA automatisk. Usikre vurderinger varsles for manuell kontroll, og siden holder seg konservativ for å unngå falsk alarm.",
    },
    {
      question: "Er dette en offisiell nettside?",
      answer:
        "Nei. erdetkriginorge.no er en uavhengig statusvisning som henter informasjon fra offentlige og pålitelige kilder omtrent hvert minutt. Siden er ment som en enkel oversikt, ikke som en erstatning for råd og varsler direkte fra politiet, Sivilforsvaret, DSB, regjeringen eller andre myndigheter.",
    },
    {
      question: "Betyr NEI at det ikke er andre alvorlige hendelser enn krig som pågår?",
      answer:
        "Nei. NEI betyr bare at denne siden ikke har funnet et aktivt varsel som tolkes som krig eller væpnet angrep mot Norge. Andre alvorlige hendelser kan fortsatt pågå.",
    },
    {
      question: "Betyr militære helikoptre eller jagerfly at det er krig?",
      answer:
        "Som regel ikke. Forsvaret trener og øver jevnlig i Norge, også sammen med allierte, og øvelser kan gi mer aktivitet i luftrommet enn vanlig. Hvis militær aktivitet faktisk betyr akutt fare for befolkningen, skal du følge Nødvarsel og informasjon direkte fra myndighetene.",
    },
    {
      question: "Hvorfor fraktes stridsvogner eller militære kjøretøy på vei, tog eller skip?",
      answer:
        "Militære kjøretøy og tungtransport flyttes ofte til og fra øvelser, baser, verksteder eller havner. Ved større øvelser varsler Forsvaret og trafikkmyndighetene ofte om militærtrafikk, kolonner, tungtransport, forsinkelser og ekstra støy. Hold god avstand, følg skilting og anvisninger, og ikke forstyrr militære kolonner.",
    },
    {
      question: "Hvor kan jeg sjekke om militær aktivitet kan være øvelse?",
      answer:
        "Se Forsvarets sider om operasjoner og øvelser: " +
        FORSVARET_OPERATIONS_EXERCISES_URL +
        ", Forsvarets øvelsesoversikt: " +
        FORSVARET_EXERCISES_URL +
        " og Forsvarets aktivitetskalender: " +
        FORSVARET_ACTIVITY_CALENDAR_URL +
        ". Siden forsøker også å vise pågående øvelser fra Forsvarets øvelsessider når sted og dato kan tolkes tydelig, men manglende øvelsesboks betyr ikke at det ikke finnes militær aktivitet. Lokale kommuner, politiet, Statens vegvesen og Forsvarsbygg kan også publisere informasjon når øvelser påvirker trafikk, støy, skytefelt eller ferdsel.",
    },
    {
      question: "Hvor ofte oppdateres statusen?",
      answer:
        "Statusen hentes server-side og caches kort, omtrent ett minutt. Siste sjekk for denne visningen var " +
        formatDateTime(status.checkedAt) +
        ".",
    },
    {
      question: "Hva betyr Anta NEI?",
      answer:
        "Anta NEI vises hvis siden midlertidig ikke får hentet eller lest kilden. Da viser siden et konservativt fallback-svar mens den venter på kontakt med pålitelige kilder.",
    },
  ];
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <main>
      <section className={`statusHero statusHero-${status.tone}`}>
        <div className="statusHeroInner">
          <p className="statusQuestion">{status.question}</p>
          <h1 className="statusAnswer">{status.label}</h1>
          {showStatusExplanation ? (
            <p className="statusExplanation">{status.message}</p>
          ) : null}
          {status.status === "yes" ? (
            <p className="statusAdvice">
              Følg rådene i aktivt Nødvarsel.{" "}
              <a href={NODVARSEL_ADVICE_URL}>
                Les hva rådene fra Nødvarsel betyr
              </a>
              .
            </p>
          ) : null}
        </div>
      </section>

      <section className="faqSection" aria-labelledby="faq-title">
        <div className="faqInner">
          <p className="sectionKicker">FAQ</p>
          <h2 id="faq-title">Spørsmål og svar</h2>
          {militaryExerciseNotices.length > 0 ? (
            <aside className="exerciseNotice" aria-label="Militær øvelse">
              <p className="exerciseNoticeLabel">Militær aktivitet</p>
              <h3>Forsvaret melder om pågående øvelse</h3>
              <ul>
                {militaryExerciseNotices.map((notice) => (
                  <li key={notice.url}>
                    <a href={notice.url}>{notice.title}</a>
                    {notice.location ? `: ${notice.location}` : null}
                    {notice.dateText ? ` (${notice.dateText})` : null}
                  </li>
                ))}
              </ul>
              <p>
                Dette er bare kontekst om mulig militær aktivitet. Det påvirker
                ikke JA/NEI-statusen over.
              </p>
            </aside>
          ) : null}
          <div className="faqList">
            {faqItems.map((item) => (
              <article className="faqItem" key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="sourceCredit">
        {nodvarselCredit.text} Se <a href={NODVARSEL_HOME_URL}>Nødvarsel.no</a>{" "}
        og <a href={NODVARSEL_RSS_INFO_URL}>RSS-informasjonen</a>.
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </main>
  );
}

function formatDateTime(isoDate: string): string {
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Oslo",
  }).format(new Date(isoDate));
}
