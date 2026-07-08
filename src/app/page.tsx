import { NODVARSEL_HOME_URL, NODVARSEL_RSS_INFO_URL } from "@/lib/sources";
import { getWarStatus, nodvarselCredit } from "@/lib/status";

export const revalidate = 60;

export default async function Home() {
  const status = await getWarStatus();

  return (
    <main>
      <section className={`statusHero statusHero-${status.tone}`}>
        <div className="statusHeroInner">
          <h1 className="statusAnswer">{status.label}</h1>
          <p className="statusQuestion">{status.question}</p>
        </div>
      </section>

      <footer className="sourceCredit">
        {nodvarselCredit.text} Se <a href={NODVARSEL_HOME_URL}>Nødvarsel.no</a>{" "}
        og <a href={NODVARSEL_RSS_INFO_URL}>RSS-informasjonen</a>.
      </footer>
    </main>
  );
}
