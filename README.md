# norgeikrig.no

En enkel norsk statusside som svarer `JA`, `NEI` eller `Anta NEI` på spørsmålet:

> Er det krig i Norge nå?

## Kilder

- Norge-status hentes fra aktiv RSS-feed fra Nødvarsel:
  `https://www.nodvarsel.no/rss/rss-aktive-nodvarsler/`
- Nødvarsel krever tydelig kreditering, tydelig skille mellom RSS-innhold og øvrig innhold, og synlig klikkbar lenke til `nodvarsel.no`.

## Statuslogikk

- `JA`: minst ett aktivt Nødvarsel matcher krig, væpnet angrep eller tilsvarende militær hendelse.
- `NEI`: Nødvarsel-feed hentes, men ingen aktive varsler matcher krig/angrep.
- `Anta NEI`: feeden kan ikke hentes eller leses. Siden viser da teksten `venter på kontakt fra pålitelige kilder`.

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
NEXT_PUBLIC_SITE_URL=https://norgeikrig.no
```

## Sjekker

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
