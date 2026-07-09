<?php

declare(strict_types=1);

function erdet_get_war_status(bool $forceRefresh = false): array
{
    $config = erdet_config();

    if (!$forceRefresh) {
        $cached = erdet_read_cache('status.json', (int) $config['status_cache_ttl']);
        if ($cached !== null) {
            return $cached;
        }
    }

    $result = erdet_compute_war_status();
    erdet_try_write_cache('status.json', $result);

    return $result;
}

function erdet_compute_war_status(): array
{
    $checkedAt = erdet_now_iso();

    try {
        $xml = erdet_fetch_text(ERDET_NODVARSEL_ACTIVE_RSS_URL);
        $activeAlerts = erdet_parse_nodvarsel_rss($xml);
        $triggeredAlerts = array_values(array_filter($activeAlerts, 'erdet_alert_matches_war'));
        $aiReviews = [];

        foreach ($triggeredAlerts as $alert) {
            $aiReviews[] = erdet_classify_alert_with_ai($alert);
        }

        $matchedAlerts = [];
        foreach ($triggeredAlerts as $index => $alert) {
            if (($aiReviews[$index]['classification'] ?? '') === 'confirmed_yes') {
                $matchedAlerts[] = $alert;
            }
        }

        $notifications = erdet_send_review_notifications($triggeredAlerts, $aiReviews);

        if ($matchedAlerts !== []) {
            return [
                'status' => 'yes',
                'label' => 'JA',
                'tone' => 'danger',
                'question' => 'Er det krig i Norge nå?',
                'message' => 'Aktivt Nødvarsel tolkes som krig, væpnet angrep eller tilsvarende alvorlig militær hendelse.',
                'checkedAt' => $checkedAt,
                'source' => erdet_build_source('ok'),
                'activeAlerts' => $activeAlerts,
                'triggeredAlerts' => $triggeredAlerts,
                'matchedAlerts' => $matchedAlerts,
                'aiReviews' => $aiReviews,
                'notifications' => $notifications,
            ];
        }

        if (erdet_has_uncertain_review($aiReviews)) {
            return [
                'status' => 'assume-no',
                'label' => 'Anta NEI',
                'tone' => 'unknown',
                'question' => 'Er det krig i Norge nå?',
                'message' => 'Systemet er usikkert. Det er for øyeblikket sendt en vurdering til menneskelig kontroll.',
                'checkedAt' => $checkedAt,
                'source' => erdet_build_source('ok'),
                'activeAlerts' => $activeAlerts,
                'triggeredAlerts' => $triggeredAlerts,
                'matchedAlerts' => $matchedAlerts,
                'aiReviews' => $aiReviews,
                'notifications' => $notifications,
            ];
        }

        return [
            'status' => 'no',
            'label' => 'NEI',
            'tone' => 'ok',
            'question' => 'Er det krig i Norge nå?',
            'message' => erdet_status_no_message(count($activeAlerts), count($triggeredAlerts)),
            'checkedAt' => $checkedAt,
            'source' => erdet_build_source('ok'),
            'activeAlerts' => $activeAlerts,
            'triggeredAlerts' => $triggeredAlerts,
            'matchedAlerts' => $matchedAlerts,
            'aiReviews' => $aiReviews,
            'notifications' => $notifications,
        ];
    } catch (Throwable $error) {
        return [
            'status' => 'assume-no',
            'label' => 'Anta NEI',
            'tone' => 'unknown',
            'question' => 'Er det krig i Norge nå?',
            'message' => 'venter på kontakt fra pålitelige kilder',
            'checkedAt' => $checkedAt,
            'source' => erdet_build_source('error', erdet_error_message($error)),
            'activeAlerts' => [],
            'triggeredAlerts' => [],
            'matchedAlerts' => [],
            'aiReviews' => [],
            'notifications' => [],
        ];
    }
}

function erdet_has_uncertain_review(array $aiReviews): bool
{
    foreach ($aiReviews as $review) {
        if (($review['classification'] ?? '') === 'uncertain') {
            return true;
        }
    }

    return false;
}

function erdet_parse_nodvarsel_rss(string $xml): array
{
    $xml = preg_replace('/^\xEF\xBB\xBF/', '', $xml) ?? $xml;
    $previous = libxml_use_internal_errors(true);
    $rss = simplexml_load_string($xml, 'SimpleXMLElement', LIBXML_NOCDATA);
    libxml_use_internal_errors($previous);

    if (!$rss || !isset($rss->channel)) {
        throw new RuntimeException('RSS-feed mangler channel');
    }

    $items = [];

    foreach (($rss->channel->item ?? []) as $item) {
        $items[] = [
            'title' => erdet_text($item->title ?? ''),
            'description' => erdet_text($item->description ?? ''),
            'link' => erdet_text($item->link ?? ''),
            'publishedAt' => erdet_text($item->pubDate ?? '') ?: null,
        ];
    }

    return $items;
}

function erdet_alert_matches_war(array $alert): bool
{
    $text = (string) ($alert['title'] ?? '') . ' ' . (string) ($alert['description'] ?? '');
    $patterns = [
        '/\bkrig\b/iu',
        '/krigshandling/iu',
        '/\binvasjon\b/iu',
        '/\bangrep\b/iu',
        '/\bvaepnet angrep\b/iu',
        '/væpnet angrep/iu',
        '/angrep mot norge/iu',
        '/militært angrep/iu',
        '/militaert angrep/iu',
        '/luftangrep/iu',
        '/missilangrep/iu',
        '/rakettangrep/iu',
    ];

    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $text) === 1) {
            return true;
        }
    }

    return false;
}

function erdet_send_review_notifications(array $triggeredAlerts, array $aiReviews): array
{
    $notifications = [];

    foreach ($aiReviews as $index => $review) {
        if (!erdet_should_notify_for_review($review)) {
            continue;
        }

        $notifications[] = erdet_send_alert_notification($triggeredAlerts[$index], $review);
    }

    return $notifications;
}

function erdet_status_no_message(int $activeAlertsCount, int $triggeredAlertsCount): string
{
    if ($triggeredAlertsCount > 0) {
        return 'Aktive Nødvarsler med krig/angrep-ord er AI-vurdert, men ikke bekreftet som krig eller væpnet angrep mot Norge.';
    }

    if ($activeAlertsCount > 0) {
        return 'Det finnes aktive Nødvarsler, men ingen er flagget for AI-vurdering av krig eller væpnet angrep mot Norge.';
    }

    return 'Ingen aktive Nødvarsler er tolket som krig eller væpnet angrep mot Norge.';
}

function erdet_build_source(string $state, ?string $error = null): array
{
    $source = [
        'name' => 'Nødvarsel',
        'url' => ERDET_NODVARSEL_HOME_URL,
        'feedUrl' => ERDET_NODVARSEL_ACTIVE_RSS_URL,
        'state' => $state,
    ];

    if ($error !== null) {
        $source['error'] = $error;
    }

    return $source;
}
