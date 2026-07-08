import { buildFaqItems } from "@/lib/content";
import { getConflictCountries } from "@/lib/conflicts";
import {
  FORSVARET_HOME_URL,
  FORSVARSDEPARTEMENTET_URL,
  NODVARSEL_HOME_URL,
  NODVARSEL_RSS_INFO_URL,
  OWID_CONFLICTS_CHART_URL,
  UCDP_API_DOCS_URL,
} from "@/lib/sources";
import { getWarStatus, nodvarselCredit } from "@/lib/status";

export const revalidate = 60;

export default async function Home() {
  const [status, conflicts] = await Promise.all([
    getWarStatus(),
    getConflictCountries(),
  ]);
  const faqItems = buildFaqItems(status, conflicts);
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
          <p className="statusMessage">{status.message}</p>
          <dl className="statusMeta" aria-label="Statusdetaljer">
            <div>
              <dt>Sist sjekket</dt>
              <dd>{formatDateTime(status.checkedAt)}</dd>
            </div>
            <div>
              <dt>Kildekontakt</dt>
              <dd>{status.source.state === "ok" ? "OK" : "Feil"}</dd>
            </div>
            <div>
              <dt>Aktive varsler lest</dt>
              <dd>{status.activeAlerts.length}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="sourceBand" aria-labelledby="sources-title">
        <div className="sourceBandInner">
          <div>
            <p className="sectionKicker">Kilder</p>
            <h2 id="sources-title">Åpne kilder, tydelig kreditert</h2>
          </div>
          <div className="sourceText">
            <p>
              {nodvarselCredit.text} RSS-data holdes atskilt fra øvrig innhold
              på denne siden. Se{" "}
              <a href={NODVARSEL_HOME_URL}>Nødvarsel.no</a> og{" "}
              <a href={NODVARSEL_RSS_INFO_URL}>RSS-informasjonen</a>.
            </p>
            <p>
              <a href={FORSVARET_HOME_URL}>Forsvaret</a> og{" "}
              <a href={FORSVARSDEPARTEMENTET_URL}>Forsvarsdepartementet</a>{" "}
              lenkes som offisiell kontekst. De brukes ikke som status-API i
              denne versjonen.
            </p>
          </div>
        </div>
      </section>

      <div className="contentGrid">
        <section className="faqSection" aria-labelledby="faq-title">
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
        </section>

        <aside className="conflictPanel" aria-labelledby="conflicts-title">
          <p className="sectionKicker">Global oversikt</p>
          <h2 id="conflicts-title">Land i konflikt</h2>
          <p className="conflictNote">
            {conflicts.note}
            {conflicts.lastUpdated
              ? ` Sist oppdatert hos kilden: ${conflicts.lastUpdated}.`
              : ""}
          </p>
          {conflicts.warning ? (
            <p className="sourceWarning">{conflicts.warning}</p>
          ) : null}
          {conflicts.error ? (
            <p className="sourceWarning">{conflicts.error}</p>
          ) : null}
          <p className="conflictSource">
            Kilde:{" "}
            <a
              href={
                conflicts.source === "ucdp"
                  ? UCDP_API_DOCS_URL
                  : OWID_CONFLICTS_CHART_URL
              }
            >
              {conflicts.sourceLabel}
            </a>
            {conflicts.year ? `, ${conflicts.year}` : ""}
          </p>
          {conflicts.countries.length > 0 ? (
            <ul className="countryList">
              {conflicts.countries.map((country) => (
                <li key={`${country.code}-${country.name}`}>
                  {country.name}
                  {country.code ? <span>{country.code}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="emptyState">Ingen konfliktliste tilgjengelig nå.</p>
          )}
        </aside>
      </div>

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
