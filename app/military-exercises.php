<?php

declare(strict_types=1);

function erdet_get_military_exercise_notices(bool $forceRefresh = false): array
{
    $config = erdet_config();

    if (!$forceRefresh) {
        $cached = erdet_read_cache('exercises.json', (int) $config['exercise_cache_ttl']);
        if ($cached !== null) {
            return $cached;
        }
    }

    $notices = erdet_fetch_military_exercise_notices();
    erdet_write_cache('exercises.json', $notices);

    return $notices;
}

function erdet_fetch_military_exercise_notices(): array
{
    try {
        $config = erdet_config();
        $indexHtml = erdet_fetch_text(ERDET_FORSVARET_EXERCISES_URL);
        $candidates = array_slice(erdet_parse_forsvaret_exercise_index($indexHtml), 0, (int) $config['max_exercise_detail_pages']);
        $notices = [];

        foreach ($candidates as $candidate) {
            try {
                $detailHtml = erdet_fetch_text($candidate['url']);
                $notice = erdet_parse_forsvaret_exercise_detail($detailHtml, $candidate);

                if ($notice !== null) {
                    $notices[] = $notice;
                }
            } catch (Throwable) {
                continue;
            }
        }

        return array_slice($notices, 0, 3);
    } catch (Throwable) {
        return [];
    }
}

function erdet_parse_forsvaret_exercise_index(string $html): array
{
    $currentSection = $html;

    if (preg_match('/<div id="part-1"[\s\S]*?(?=<div id="part-2")/iu', $html, $match) === 1) {
        $currentSection = $match[0];
    }

    $candidates = [];
    $seen = [];
    $pattern = '/<a\s+[^>]*href="([^"]+)"[^>]*>[\s\S]*?<span\s+class="[^"]*\blist-child__title\b[^"]*"[^>]*>([\s\S]*?)<\/span>/iu';

    if (preg_match_all($pattern, $currentSection, $matches, PREG_SET_ORDER) !== false) {
        foreach ($matches as $match) {
            $url = erdet_absolute_forsvaret_url(html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            $title = erdet_strip_html($match[2]);

            if ($url === null || $title === '' || isset($seen[$url])) {
                continue;
            }

            $seen[$url] = true;
            $candidates[] = [
                'title' => $title,
                'url' => $url,
            ];
        }
    }

    return $candidates;
}

function erdet_parse_forsvaret_exercise_detail(string $html, array $candidate, ?DateTimeImmutable $now = null): ?array
{
    $pageText = erdet_lower(erdet_strip_html($html));
    $dateText = erdet_extract_fact($html, 'Når');

    if ($dateText === null || erdet_exercise_is_explicitly_over($pageText)) {
        return null;
    }

    $dateRanges = erdet_parse_norwegian_date_ranges($dateText);
    $currentDay = erdet_oslo_day_key($now);
    $active = false;

    foreach ($dateRanges as $range) {
        if ($range['start'] <= $currentDay && $currentDay <= $range['end']) {
            $active = true;
            break;
        }
    }

    if (!$active) {
        return null;
    }

    $title = erdet_extract_meta_content($html, 'og:title') ?? $candidate['title'];
    $description = erdet_extract_meta_content($html, 'description')
        ?? erdet_extract_meta_content($html, 'og:description')
        ?? 'Forsvaret har publisert informasjon om en militær øvelse.';

    return [
        'title' => $title,
        'url' => $candidate['url'],
        'summary' => erdet_summarize_text($description),
        'location' => erdet_extract_fact($html, 'Hvor'),
        'dateText' => $dateText,
        'sourceName' => 'Forsvaret',
        'sourceUrl' => ERDET_FORSVARET_EXERCISES_URL,
    ];
}

function erdet_extract_fact(string $html, string $label): ?string
{
    $pattern = '/<li[^>]*>\s*<strong>\s*' . preg_quote($label, '/') . '\s*:?\s*<\/strong>([\s\S]*?)<\/li>/iu';

    if (preg_match($pattern, $html, $match) !== 1) {
        return null;
    }

    $value = erdet_strip_html($match[1]);

    return $value !== '' ? $value : null;
}

function erdet_extract_meta_content(string $html, string $nameOrProperty): ?string
{
    $quoted = preg_quote($nameOrProperty, '/');
    $patterns = [
        '/<meta\s+(?:name|property)=["\']' . $quoted . '["\']\s+content=["\']([^"\']+)["\']/iu',
        '/<meta\s+content=["\']([^"\']+)["\']\s+(?:name|property)=["\']' . $quoted . '["\']/iu',
    ];

    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $html, $match) === 1) {
            return trim(html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        }
    }

    return null;
}

function erdet_exercise_is_explicitly_over(string $text): bool
{
    foreach (['øvelsen er over', 'øvelsen er avsluttet', 'øvelsen ble avsluttet', 'ble avsluttet'] as $phrase) {
        if (erdet_contains($text, $phrase)) {
            return true;
        }
    }

    return false;
}

function erdet_parse_norwegian_date_ranges(string $text): array
{
    $months = erdet_months();
    $monthPattern = implode('|', array_keys($months));
    $normalized = str_replace("\xc2\xa0", ' ', $text);
    $ranges = [];
    $patterns = [
        'cross' => '/(\d{1,2})\.?\s*(' . $monthPattern . ')\s*(?:til|[–—-])\s*(\d{1,2})\.?\s*(' . $monthPattern . ')\s*(\d{4})/iu',
        'same' => '/(?:fra\s+)?(\d{1,2})\.?\s*(?:til|[–—-])\s*(\d{1,2})\.?\s*(' . $monthPattern . ')\s*(\d{4})/iu',
        'single' => '/(\d{1,2})\.?\s*(' . $monthPattern . ')\s*(\d{4})/iu',
    ];

    if (preg_match_all($patterns['cross'], $normalized, $matches, PREG_SET_ORDER) !== false) {
        foreach ($matches as $match) {
            $start = erdet_date_key((int) $match[5], erdet_month_number($match[2]), (int) $match[1]);
            $end = erdet_date_key((int) $match[5], erdet_month_number($match[4]), (int) $match[3]);
            if ($start !== null && $end !== null) {
                $ranges[] = erdet_normalize_range($start, $end);
            }
        }
    }

    if (preg_match_all($patterns['same'], $normalized, $matches, PREG_SET_ORDER) !== false) {
        foreach ($matches as $match) {
            $start = erdet_date_key((int) $match[4], erdet_month_number($match[3]), (int) $match[1]);
            $end = erdet_date_key((int) $match[4], erdet_month_number($match[3]), (int) $match[2]);
            if ($start !== null && $end !== null) {
                $ranges[] = erdet_normalize_range($start, $end);
            }
        }
    }

    if ($ranges === [] && preg_match_all($patterns['single'], $normalized, $matches, PREG_SET_ORDER) !== false) {
        foreach ($matches as $match) {
            $date = erdet_date_key((int) $match[3], erdet_month_number($match[2]), (int) $match[1]);
            if ($date !== null) {
                $ranges[] = ['start' => $date, 'end' => $date];
            }
        }
    }

    return $ranges;
}

function erdet_months(): array
{
    return [
        'januar' => 1,
        'februar' => 2,
        'mars' => 3,
        'april' => 4,
        'mai' => 5,
        'juni' => 6,
        'juli' => 7,
        'august' => 8,
        'september' => 9,
        'oktober' => 10,
        'november' => 11,
        'desember' => 12,
    ];
}

function erdet_month_number(string $month): int
{
    $months = erdet_months();

    return $months[erdet_lower($month)] ?? 0;
}

function erdet_date_key(int $year, int $month, int $day): ?int
{
    if ($year <= 0 || $month <= 0 || $day <= 0) {
        return null;
    }

    return (int) sprintf('%04d%02d%02d', $year, $month, $day);
}

function erdet_normalize_range(int $start, int $end): array
{
    return $start <= $end ? ['start' => $start, 'end' => $end] : ['start' => $end, 'end' => $start];
}

function erdet_absolute_forsvaret_url(string $href): ?string
{
    if ($href === '') {
        return null;
    }

    if (erdet_starts_with($href, '/')) {
        return ERDET_FORSVARET_BASE_URL . $href;
    }

    $parts = parse_url($href);

    if (!is_array($parts) || ($parts['host'] ?? '') !== 'www.forsvaret.no') {
        return null;
    }

    return $href;
}

function erdet_summarize_text(string $text): string
{
    $normalized = preg_replace('/\s+/u', ' ', trim($text)) ?? trim($text);

    return erdet_strlen($normalized) > 220
        ? erdet_substr($normalized, 0, 217) . '...'
        : $normalized;
}
