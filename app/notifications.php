<?php

declare(strict_types=1);

function erdet_should_notify_for_review(array $review): bool
{
    return in_array($review['classification'] ?? '', ['confirmed_yes', 'uncertain'], true);
}

function erdet_send_alert_notification(array $alert, array $review): array
{
    $key = erdet_notification_key($alert, $review);
    $dedupe = erdet_notification_dedupe($key);

    if ($dedupe !== null) {
        return [
            'state' => 'skipped',
            'reason' => 'Samme varsel/status er allerede varslet siste døgn.',
            'key' => $key,
        ];
    }

    $config = erdet_config();

    if ((string) $config['smtp_user'] === '') {
        return [
            'state' => 'skipped',
            'reason' => 'SMTP_USER mangler, e-post ble ikke sendt.',
            'key' => $key,
        ];
    }

    if ((string) $config['smtp_password'] === '') {
        return [
            'state' => 'skipped',
            'reason' => 'SMTP_PASSWORD mangler, e-post ble ikke sendt.',
            'key' => $key,
        ];
    }

    if ((string) $config['alert_email_from'] === '') {
        return [
            'state' => 'skipped',
            'reason' => 'ALERT_EMAIL_FROM eller SMTP_USER mangler, e-post ble ikke sendt.',
            'key' => $key,
        ];
    }

    try {
        erdet_smtp_send([
            'from' => (string) $config['alert_email_from'],
            'to' => (string) $config['alert_email_to'],
            'subject' => erdet_subject_for_review($review),
            'text' => erdet_notification_text_body($alert, $review),
            'html' => erdet_notification_html_body($alert, $review),
        ]);
        erdet_mark_notification_sent($key);

        return [
            'state' => 'sent',
            'reason' => 'E-post sendt til ' . $config['alert_email_to'] . ' via SMTP.',
            'key' => $key,
        ];
    } catch (Throwable $error) {
        return [
            'state' => 'error',
            'reason' => erdet_error_message($error),
            'key' => $key,
        ];
    }
}

function erdet_smtp_send(array $message): void
{
    $config = erdet_config();
    $host = (string) $config['smtp_host'];
    $port = (int) $config['smtp_port'];
    $target = $config['smtp_secure'] ? 'ssl://' . $host : $host;
    $errno = 0;
    $errstr = '';
    $socket = fsockopen($target, $port, $errno, $errstr, 20);

    if (!is_resource($socket)) {
        throw new RuntimeException('SMTP-tilkobling feilet: ' . ($errstr ?: (string) $errno));
    }

    stream_set_timeout($socket, 20);

    try {
        erdet_smtp_expect($socket, [220]);
        erdet_smtp_command($socket, 'EHLO erdetkriginorge.no', [250]);
        erdet_smtp_command($socket, 'AUTH LOGIN', [334]);
        erdet_smtp_command($socket, base64_encode((string) $config['smtp_user']), [334]);
        erdet_smtp_command($socket, base64_encode((string) $config['smtp_password']), [235]);
        erdet_smtp_command($socket, 'MAIL FROM:<' . $message['from'] . '>', [250]);
        erdet_smtp_command($socket, 'RCPT TO:<' . $message['to'] . '>', [250, 251]);
        erdet_smtp_command($socket, 'DATA', [354]);

        $boundary = '=_erdetkriginorge_' . bin2hex(random_bytes(12));
        $headers = [
            'From: ' . $message['from'],
            'To: ' . $message['to'],
            'Subject: ' . erdet_mime_header($message['subject']),
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        ];
        $body = implode("\r\n", $headers) . "\r\n\r\n";
        $body .= '--' . $boundary . "\r\n";
        $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
        $body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
        $body .= str_replace("\n", "\r\n", $message['text']) . "\r\n\r\n";
        $body .= '--' . $boundary . "\r\n";
        $body .= "Content-Type: text/html; charset=UTF-8\r\n";
        $body .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
        $body .= str_replace("\n", "\r\n", $message['html']) . "\r\n\r\n";
        $body .= '--' . $boundary . "--\r\n.";
        fwrite($socket, $body . "\r\n");
        erdet_smtp_expect($socket, [250]);
        erdet_smtp_command($socket, 'QUIT', [221]);
    } finally {
        fclose($socket);
    }
}

function erdet_smtp_command($socket, string $command, array $expectedCodes): string
{
    fwrite($socket, $command . "\r\n");

    return erdet_smtp_expect($socket, $expectedCodes);
}

function erdet_smtp_expect($socket, array $expectedCodes): string
{
    $response = '';

    while (($line = fgets($socket, 515)) !== false) {
        $response .= $line;
        if (preg_match('/^\d{3}\s/', $line)) {
            break;
        }
    }

    $code = (int) substr($response, 0, 3);

    if (!in_array($code, $expectedCodes, true)) {
        throw new RuntimeException('SMTP svarte uventet: ' . trim($response));
    }

    return $response;
}

function erdet_mime_header(string $value): string
{
    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

function erdet_subject_for_review(array $review): string
{
    if (($review['classification'] ?? '') === 'confirmed_yes') {
        return 'erdetkriginorge.no har satt JA';
    }

    return 'erdetkriginorge.no trenger manuell vurdering';
}

function erdet_notification_text_body(array $alert, array $review): string
{
    return implode("\n", array_filter([
        erdet_subject_for_review($review),
        '',
        'AI-klassifisering: ' . ($review['classification'] ?? ''),
        'Tillit: ' . ($review['confidence'] ?? ''),
        'Gjelder Norge naa: ' . (!empty($review['appliesToNorwayNow']) ? 'ja' : 'nei'),
        'Eksplisitt krig/vaepnet angrep: ' . (!empty($review['explicitWarOrArmedAttack']) ? 'ja' : 'nei'),
        'Test/oevelse: ' . (!empty($review['isTestOrExercise']) ? 'ja' : 'nei'),
        'Modell: ' . ($review['model'] ?? ''),
        'Sjekket: ' . ($review['checkedAt'] ?? ''),
        '',
        'AI-begrunnelse: ' . ($review['reason'] ?? ''),
        isset($review['error']) ? 'Feil: ' . $review['error'] : '',
        '',
        'Varsel:',
        'Tittel: ' . ($alert['title'] ?: '(tom)'),
        'Beskrivelse: ' . ($alert['description'] ?: '(tom)'),
        'Lenke: ' . ($alert['link'] ?: '(tom)'),
        'Publisert: ' . ($alert['publishedAt'] ?: '(ukjent)'),
    ], static function (string $line): bool {
        return $line !== '';
    }));
}

function erdet_notification_html_body(array $alert, array $review): string
{
    $link = $alert['link'] ? '<a href="' . erdet_html($alert['link']) . '">' . erdet_html($alert['link']) . '</a>' : '(tom)';

    return '<h1>' . erdet_html(erdet_subject_for_review($review)) . '</h1>'
        . '<p><strong>AI-klassifisering:</strong> ' . erdet_html((string) ($review['classification'] ?? '')) . '</p>'
        . '<p><strong>Tillit:</strong> ' . erdet_html((string) ($review['confidence'] ?? '')) . '</p>'
        . '<p><strong>Gjelder Norge naa:</strong> ' . (!empty($review['appliesToNorwayNow']) ? 'ja' : 'nei') . '</p>'
        . '<p><strong>Eksplisitt krig/vaepnet angrep:</strong> ' . (!empty($review['explicitWarOrArmedAttack']) ? 'ja' : 'nei') . '</p>'
        . '<p><strong>Test/oevelse:</strong> ' . (!empty($review['isTestOrExercise']) ? 'ja' : 'nei') . '</p>'
        . '<p><strong>Modell:</strong> ' . erdet_html((string) ($review['model'] ?? '')) . '</p>'
        . '<p><strong>Sjekket:</strong> ' . erdet_html((string) ($review['checkedAt'] ?? '')) . '</p>'
        . '<p><strong>AI-begrunnelse:</strong> ' . erdet_html((string) ($review['reason'] ?? '')) . '</p>'
        . (isset($review['error']) ? '<p><strong>Feil:</strong> ' . erdet_html((string) $review['error']) . '</p>' : '')
        . '<h2>Varsel</h2>'
        . '<p><strong>Tittel:</strong> ' . erdet_html((string) ($alert['title'] ?: '(tom)')) . '</p>'
        . '<p><strong>Beskrivelse:</strong> ' . erdet_html((string) ($alert['description'] ?: '(tom)')) . '</p>'
        . '<p><strong>Lenke:</strong> ' . $link . '</p>'
        . '<p><strong>Publisert:</strong> ' . erdet_html((string) ($alert['publishedAt'] ?: '(ukjent)')) . '</p>';
}

function erdet_notification_key(array $alert, array $review): string
{
    return hash('sha256', json_encode([
        'classification' => $review['classification'] ?? '',
        'title' => $alert['title'] ?? '',
        'description' => $alert['description'] ?? '',
        'link' => $alert['link'] ?? '',
        'publishedAt' => $alert['publishedAt'] ?? '',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

function erdet_notification_dedupe(string $key): ?int
{
    $config = erdet_config();
    $ttl = (int) $config['notification_dedupe_ttl'];

    return erdet_with_file_lock('notified.json', function ($handle) use ($key, $ttl): ?int {
        rewind($handle);
        $raw = stream_get_contents($handle);
        $data = is_string($raw) && $raw !== '' ? json_decode($raw, true) : [];
        $data = is_array($data) ? $data : [];
        $now = time();
        $fresh = [];

        foreach ($data as $storedKey => $sentAt) {
            if ($now - (int) $sentAt <= $ttl) {
                $fresh[$storedKey] = (int) $sentAt;
            }
        }

        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($fresh, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) ?: '{}');

        return isset($fresh[$key]) ? (int) $fresh[$key] : null;
    });
}

function erdet_mark_notification_sent(string $key): void
{
    erdet_with_file_lock('notified.json', function ($handle) use ($key): void {
        rewind($handle);
        $raw = stream_get_contents($handle);
        $data = is_string($raw) && $raw !== '' ? json_decode($raw, true) : [];
        $data = is_array($data) ? $data : [];
        $data[$key] = time();
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) ?: '{}');
    });
}
