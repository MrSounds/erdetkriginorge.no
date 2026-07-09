<?php

declare(strict_types=1);

function erdet_now_iso(): string
{
    return gmdate('c');
}

function erdet_error_message(Throwable $error): string
{
    return $error->getMessage() !== '' ? $error->getMessage() : 'Ukjent feil';
}

function erdet_env(string $key, ?string $default = null): ?string
{
    $value = getenv($key);

    if ($value === false || $value === '') {
        return $default;
    }

    return $value;
}

function erdet_bool($value, bool $default = false): bool
{
    if (is_bool($value)) {
        return $value;
    }

    if ($value === null || $value === '') {
        return $default;
    }

    return in_array(strtolower((string) $value), ['1', 'true', 'yes', 'ja'], true);
}

function erdet_int($value, int $default): int
{
    if (is_int($value)) {
        return $value;
    }

    if (is_numeric($value)) {
        return (int) $value;
    }

    return $default;
}

function erdet_html(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function erdet_text($value): string
{
    if ($value === null) {
        return '';
    }

    return trim((string) $value);
}

function erdet_lower(string $value): string
{
    return function_exists('mb_strtolower')
        ? mb_strtolower($value, 'UTF-8')
        : strtolower($value);
}

function erdet_strlen(string $value): int
{
    return function_exists('mb_strlen')
        ? mb_strlen($value, 'UTF-8')
        : strlen($value);
}

function erdet_substr(string $value, int $start, int $length): string
{
    return function_exists('mb_substr')
        ? mb_substr($value, $start, $length, 'UTF-8')
        : substr($value, $start, $length);
}

function erdet_starts_with(string $value, string $prefix): bool
{
    return substr($value, 0, strlen($prefix)) === $prefix;
}

function erdet_contains(string $value, string $needle): bool
{
    return $needle === '' || strpos($value, $needle) !== false;
}

function erdet_strip_html(string $html): string
{
    $text = preg_replace('/<script[\s\S]*?<\/script>/iu', ' ', $html) ?? $html;
    $text = preg_replace('/<style[\s\S]*?<\/style>/iu', ' ', $text) ?? $text;
    $text = preg_replace('/<[^>]+>/u', ' ', $text) ?? $text;
    $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = preg_replace('/\s+/u', ' ', $text) ?? $text;

    return trim($text);
}

function erdet_oslo_day_key(?DateTimeImmutable $date = null): int
{
    $date = $date ?? new DateTimeImmutable('now', new DateTimeZone('Europe/Oslo'));
    $oslo = $date->setTimezone(new DateTimeZone('Europe/Oslo'));

    return (int) $oslo->format('Ymd');
}

function erdet_format_date_time(string $isoDate): string
{
    try {
        $date = new DateTimeImmutable($isoDate);
        $date = $date->setTimezone(new DateTimeZone('Europe/Oslo'));

        return $date->format('d.m.Y H:i');
    } catch (Throwable) {
        return $isoDate;
    }
}

function erdet_json_response(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: public, max-age=60, stale-while-revalidate=300');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit;
}
