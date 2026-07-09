<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

if (($_GET['token'] ?? '') !== 'a83f29d1') {
    http_response_code(404);
    echo json_encode(['error' => 'not_found']);
    exit;
}

require_once __DIR__ . '/app/bootstrap.php';

$result = erdet_send_alert_notification([
    'title' => 'SMTP-test fra erdetkriginorge.no',
    'description' => 'Dette er en kontrollert test av e-postvarsling. Dette er ikke et reelt varsel.',
    'link' => 'https://erdetkriginorge.no/',
    'publishedAt' => erdet_now_iso(),
], [
    'classification' => 'uncertain',
    'confidence' => 'low',
    'appliesToNorwayNow' => false,
    'explicitWarOrArmedAttack' => false,
    'isTestOrExercise' => true,
    'reason' => 'Kontrollert SMTP-test. Skal ikke påvirke offentlig status.',
    'model' => 'manual-test',
    'checkedAt' => erdet_now_iso(),
]);

echo json_encode([
    'mail' => $result,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
