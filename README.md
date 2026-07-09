# erdetkriginorge.no

En enkel norsk statusside som svarer `JA`, `NEI` eller `Anta NEI` på spørsmålet:

> Er det krig i Norge nå?

Produksjonsappen er portet til PHP slik at den kan kjøres på Hostinger Premium Web Hosting via vanlig Git-deploy til `public_html`.

## Kilder

- Norge-status hentes fra aktiv RSS-feed fra Nødvarsel:
  `https://www.nodvarsel.no/rss/rss-aktive-nodvarsler/`
- Nødvarsel krever tydelig kreditering, tydelig skille mellom RSS-innhold og øvrig innhold, og synlig klikkbar lenke til `nodvarsel.no`.
- Militærøvelser hentes konservativt fra Forsvarets øvelsesoversikt:
  `https://www.forsvaret.no/om-forsvaret/operasjoner-og-ovelser/ovelser`
  Dette er bare kontekst om mulig militær aktivitet og kan aldri sette `JA`.

## Statuslogikk

- `JA`: minst ett aktivt Nødvarsel inneholder triggerord og OpenAI klassifiserer varselet som `confirmed_yes`.
- `NEI`: Nødvarsel-feed hentes, og ingen aktive varsler er AI-bekreftet som krig eller væpnet angrep mot Norge.
- `Anta NEI`: feeden kan ikke hentes eller leses. Siden viser da teksten `venter på kontakt fra pålitelige kilder`.

Triggerord som `krig`, `invasjon` og `angrep` kan bare utløse AI-vurdering. De setter aldri `JA` alene. `uncertain`, `no`, OpenAI-feil eller manglende OpenAI-nøkkel gir aldri `JA`.

Ved `confirmed_yes` eller `uncertain` prøver siden å sende e-post til `ALERT_EMAIL_TO`. SMTP via Hostinger brukes når `SMTP_USER` og `SMTP_PASSWORD` er satt. Resend kan brukes som valgfri fallback hvis SMTP ikke er konfigurert.

Forsvarets øvelsesoversikt crawles med lang cache. Siden viser bare en øvelsesboks hvis detaljsiden har tydelige datoer som dekker dagens dato og ikke sier at øvelsen er over. Manglende øvelsesboks betyr ikke at det ikke finnes militær aktivitet.

Dette er ikke en offisiell nettside. Ved krise skal råd fra myndighetene følges direkte.

## Lokal kjøring

```bash
php -S localhost:8000
```

Åpne `http://localhost:8000`.

## Miljøvariabler

Produksjon på Hostinger bør bruke privat config utenfor `public_html`, for eksempel:

```text
/home/u786208640/private/erdetkriginorge/config.php
```

Bruk `config.example.php` som mal. Den faktiske config-filen skal ikke committes.

Viktige verdier:

```php
return [
    'site_url' => 'https://erdetkriginorge.no',
    'openai_api_key' => '',
    'openai_model' => 'gpt-5.4-mini',
    'smtp_host' => 'smtp.hostinger.com',
    'smtp_port' => 465,
    'smtp_secure' => true,
    'smtp_user' => 'lyder@lyder.no',
    'smtp_password' => '',
    'alert_email_from' => 'lyder@lyder.no',
    'alert_email_to' => 'lyder2@mac.com',
    'storage_path' => __DIR__ . '/cache',
];
```

Lokalt kan du bruke `config.local.php` i repo-root. Den ignoreres av Git.

## Hostinger Premium deploy

1. Koble Hostinger Git-deploy til `main` og la repoet deployes til `public_html`.
2. Opprett privat mappe utenfor `public_html`, for eksempel `../private/erdetkriginorge`.
3. Legg `config.php` i den private mappen basert på `config.example.php`.
4. Opprett cachemappen som configen peker på, for eksempel `../private/erdetkriginorge/cache`, og sørg for at PHP kan skrive dit.
5. Legg inn cron-jobb som kjører:

```bash
php /home/BRUKER/domains/erdetkriginorge.no/public_html/cron/update-status.php
```

Kjør den hvert minutt hvis Hostinger tillater det. Siden har også page-load fallback dersom cron henger.

## Sjekker

```bash
find . -name '*.php' -print0 | xargs -0 -n1 php -l
php tests/run.php
```
