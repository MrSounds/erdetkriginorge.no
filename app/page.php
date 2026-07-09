<?php

declare(strict_types=1);

function erdet_faq_items(array $status): array
{
    if ($status['status'] === 'yes') {
        $firstAnswer = 'Siden viser JA fordi et aktivt Nødvarsel er tolket som krig, væpnet angrep eller tilsvarende alvorlig militær hendelse mot Norge. Følg alltid råd direkte fra myndighetene.';
    } elseif ($status['status'] === 'assume-no' && ($status['source']['state'] ?? '') === 'error') {
        $firstAnswer = 'Siden viser Anta NEI fordi den ikke får kontakt med Nødvarsel akkurat nå. Det er ikke en bekreftelse fra myndighetene, men en fallback mens siden venter på kontakt fra pålitelige kilder.';
    } elseif ($status['status'] === 'assume-no') {
        $firstAnswer = 'Siden viser Anta NEI fordi systemet er usikkert. Det er for øyeblikket sendt en vurdering til menneskelig kontroll, og siden viser ikke JA før det er sikkert.';
    } else {
        $firstAnswer = 'NEI. ' . $status['message'] . ' Du kan trygt slappe av.';
    }

    return [
        [
            'question' => 'Er Norge i krig nå?',
            'answer' => $firstAnswer,
        ],
        [
            'question' => 'Hva gjør man om JA?',
            'answer' => 'Hvis denne siden viser JA, bør du søke videre informasjon fra kilder du stoler på (som www.nodvarsel.no), følge råd fra myndighetene og være ekstra oppmerksom på feilinformasjon. NRK P1 er beredskapskanalen dersom andre nyhetsmedier eller offentlige nettsteder ikke er tilgjengelige. Les mer hos Nødvarsel: ' . ERDET_NODVARSEL_ADVICE_URL,
        ],
        [
            'question' => 'Hvor hentes statusen fra?',
            'answer' => 'Statusen hentes fra aktive Nødvarsler fra nodvarsel.no. Siden leser den offentlige RSS-feeden jevnlig og bruker bare aktive varsler som grunnlag for statusen.',
        ],
        [
            'question' => 'Hva skal til for at siden viser JA?',
            'answer' => 'Siden viser bare JA hvis et aktivt Nødvarsel eksplisitt tolkes som krig, væpnet angrep eller tilsvarende alvorlig militær hendelse mot Norge. Et mulig JA-varsel vurderes først strengt av KI og varsles deretter for rask menneskelig verifisering.',
        ],
        [
            'question' => 'Hva skjer hvis systemet er usikkert?',
            'answer' => 'Ved usikkerhet viser siden Anta NEI, ikke JA. Det blir øyeblikkelig sendt en vurdering til menneskelig kontroll, og siden oppdateres straks med riktig svar når det er ferdig kontrollert.',
        ],
        [
            'question' => 'Er dette en offisiell nettside?',
            'answer' => 'Nei. erdetkriginorge.no er en uavhengig statusvisning som henter informasjon fra offentlige og pålitelige kilder omtrent hvert minutt. Siden er ment som en enkel oversikt, ikke som en erstatning for råd og varsler direkte fra politiet, Sivilforsvaret, DSB, regjeringen eller andre myndigheter.',
        ],
        [
            'question' => 'Betyr NEI at det ikke er andre alvorlige hendelser enn krig som pågår?',
            'answer' => 'Nei. NEI betyr bare at denne siden ikke har funnet et aktivt varsel som tolkes som krig eller væpnet angrep mot Norge. Andre alvorlige hendelser kan fortsatt pågå.',
        ],
        [
            'question' => 'Betyr militære helikoptre eller jagerfly at det er krig?',
            'answer' => 'Som regel ikke. Forsvaret trener og øver jevnlig i Norge, også sammen med allierte, og øvelser kan gi mer aktivitet i luftrommet enn vanlig. Hvis militær aktivitet faktisk betyr akutt fare for befolkningen, skal du følge Nødvarsel og informasjon direkte fra myndighetene.',
        ],
        [
            'question' => 'Hvorfor fraktes stridsvogner eller militære kjøretøy på vei, tog eller skip?',
            'answer' => 'Militære kjøretøy og tungtransport flyttes ofte til og fra øvelser, baser, verksteder eller havner. Ved større øvelser varsler Forsvaret og trafikkmyndighetene ofte om militærtrafikk, kolonner, tungtransport, forsinkelser og ekstra støy. Hold god avstand, følg skilting og anvisninger, og ikke forstyrr militære kolonner.',
        ],
        [
            'question' => 'Hvor kan jeg sjekke om militær aktivitet kan være øvelse?',
            'answer' => 'Se Forsvarets sider om operasjoner og øvelser: ' . ERDET_FORSVARET_OPERATIONS_EXERCISES_URL . ', Forsvarets øvelsesoversikt: ' . ERDET_FORSVARET_EXERCISES_URL . ' og Forsvarets aktivitetskalender: ' . ERDET_FORSVARET_ACTIVITY_CALENDAR_URL . '. Siden forsøker også å vise pågående øvelser fra Forsvarets øvelsessider når sted og dato kan tolkes tydelig, men manglende øvelsesboks betyr ikke at det ikke finnes militær aktivitet. Lokale kommuner, politiet, Statens vegvesen og Forsvarsbygg kan også publisere informasjon når øvelser påvirker trafikk, støy, skytefelt eller ferdsel.',
        ],
        [
            'question' => 'Hvor ofte oppdateres statusen?',
            'answer' => 'Statusen hentes server-side og caches kort, omtrent ett minutt. Siste sjekk for denne visningen var ' . erdet_format_date_time((string) $status['checkedAt']) . '.',
            'answerHtml' => 'Statusen hentes server-side og caches kort, omtrent ett minutt. Siste sjekk for denne visningen var <span data-checked-at="' . erdet_html((string) $status['checkedAt']) . '">' . erdet_html(erdet_format_date_time((string) $status['checkedAt'])) . '</span>.',
        ],
        [
            'question' => 'Hva betyr Anta NEI?',
            'answer' => 'Anta NEI vises hvis siden midlertidig ikke får hentet status fra RSS, eller hvis systemet er usikkert etter en KI-vurdering. Ved usikkerhet sendes vurderingen til menneskelig kontroll.',
        ],
    ];
}

function erdet_faq_json_ld(array $faqItems): array
{
    return [
        '@context' => 'https://schema.org',
        '@type' => 'FAQPage',
        'mainEntity' => array_map(static function (array $item): array {
            return [
            '@type' => 'Question',
            'name' => $item['question'],
            'acceptedAnswer' => [
                '@type' => 'Answer',
                'text' => $item['answer'],
            ],
            ];
        }, $faqItems),
    ];
}
