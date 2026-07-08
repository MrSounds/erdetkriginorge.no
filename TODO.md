# TODO: AI-validering for JA-status

## Maal

Siden skal aldri vise `JA` bare fordi et aktivt varsel inneholder ord som `krig`, `invasjon` eller `angrep`. Slike ord skal kun trigge en ekstra AI-vurdering. `JA` skal bare vises hvis AI eksplisitt klassifiserer det aktive varselet som bekreftet krig eller vaepnet angrep mot Norge naa.

## Implementert flyt

- [x] Les kun aktive Nødvarsel-varsler.
- [x] Varsler uten triggerord gir aldri `JA`.
- [x] Triggerord sender varselet til OpenAI for streng klassifisering.
- [x] AI-svaret maa vaere strukturert JSON med fast schema.
- [x] `JA` settes bare ved `classification: "confirmed_yes"`.
- [x] `uncertain`, `no`, OpenAI-feil eller manglende OpenAI-nokkel gir aldri `JA`.
- [x] Send e-post til `ALERT_EMAIL_TO` ved `confirmed_yes` og `uncertain`.
- [x] Dedup samme varsel/status i minnet for aa unngaa repeterte e-poster i samme serverprosess.
- [x] Test fallbackene: ingen triggerord, AI `confirmed_yes`, AI `uncertain`, manglende OpenAI og e-postkall.

## Produksjonsoppsett

- [ ] Sett `OPENAI_API_KEY` i hostingmiljoet.
- [ ] Sett `OPENAI_MODEL`, anbefalt startverdi: `gpt-5.4-mini`.
- [ ] Sett `RESEND_API_KEY` for e-post.
- [ ] Sett `ALERT_EMAIL_FROM` til en verifisert avsender i Resend.
- [ ] Sett `ALERT_EMAIL_TO=lyder2@mac.com`.

## Videre hardening

- [ ] Bytt in-memory e-postdedupe til persistent KV hvis siden faar flere serverless-instanser.
- [ ] Legg inn admin-only manuell override hvis `JA` i fremtiden skal kreve menneskelig bekreftelse foer publisering.
- [ ] Logg AI-vurderinger til en persistent audit-logg ved produksjonssetting.
