# erdetkriginorge.no

En enkel norsk statusside som svarer `JA`, `NEI` eller `Anta NEI` på spørsmålet:

> Er det krig i Norge nå?

## Kilder

- Norge-status hentes fra aktiv RSS-feed fra Nødvarsel:
  `https://www.nodvarsel.no/rss/rss-aktive-nodvarsler/`
- Nødvarsel krever tydelig kreditering, tydelig skille mellom RSS-innhold og øvrig innhold, og synlig klikkbar lenke til `nodvarsel.no`.

## Statuslogikk

- `JA`: minst ett aktivt Nødvarsel inneholder triggerord og OpenAI klassifiserer varselet som `confirmed_yes`.
- `NEI`: Nødvarsel-feed hentes, og ingen aktive varsler er AI-bekreftet som krig eller væpnet angrep mot Norge.
- `Anta NEI`: feeden kan ikke hentes eller leses. Siden viser da teksten `venter på kontakt fra pålitelige kilder`.

Triggerord som `krig`, `invasjon` og `angrep` kan bare utløse AI-vurdering. De setter aldri `JA` alene. `uncertain`, `no`, OpenAI-feil eller manglende OpenAI-nøkkel gir aldri `JA`.

Ved `confirmed_yes` eller `uncertain` prøver siden å sende e-post til `ALERT_EMAIL_TO`. E-post krever Resend-konfigurasjon.

Dette er ikke en offisiell nettside. Ved krise skal råd fra myndighetene følges direkte.

## Lokal kjøring

```bash
npm install
npm run dev
```

Åpne `http://localhost:3000`.

## Miljøvariabler

Se `.env.example`.

```bash
NEXT_PUBLIC_SITE_URL=https://erdetkriginorge.no
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
RESEND_API_KEY=
ALERT_EMAIL_FROM=
ALERT_EMAIL_TO=lyder2@mac.com
```

## Sjekker

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
