import { NODVARSEL_HOME_URL, NODVARSEL_RSS_INFO_URL } from "@/lib/sources";
import { getWarStatus, nodvarselCredit } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function Home() {
  const status = await getWarStatus();
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
      question: "Hva betyr Anta NEI?",
      answer:
        "Anta NEI vises hvis siden ikke får hentet eller lest kilden. Det betyr at siden mangler kontakt med pålitelige kilder, ikke at myndighetene har bekreftet situasjonen.",
    },
    {
      question: "Er dette en offisiell nettside?",
      answer:
        "Nei. erdetkriginorge.no er en enkel og uavhengig statusvisning. Ved krise skal du følge råd fra politiet, Sivilforsvaret, DSB, regjeringen og andre myndigheter.",
    },
    {
      question: "Betyr NEI at alt er trygt?",
      answer:
        "Nei. NEI betyr bare at denne siden ikke har funnet et aktivt varsel som tolkes som krig eller væpnet angrep mot Norge. Andre alvorlige hendelser kan fortsatt pågå.",
    },
    {
      question: "Hvor ofte oppdateres statusen?",
      answer:
        "Statusen hentes server-side og caches kort, omtrent ett minutt. Siste sjekk for denne visningen var " +
        formatDateTime(status.checkedAt) +
        ".",
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
          {status.status === "assume-no" ? (
            <p className="statusExplanation">{status.message}</p>
          ) : null}
        </div>
      </section>

      <section className="faqSection" aria-labelledby="faq-title">
        <div className="faqInner">
          <p className="sectionKicker">FAQ</p>
          <h2 id="faq-title">Spørsmål og svar</h2>
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
