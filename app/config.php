<?php

declare(strict_types=1);

function erdet_config(): array
{
    static $config = null;

    if (is_array($config)) {
        return $config;
    }

    $root = dirname(__DIR__);
    $explicitConfigPath = erdet_env('ERDET_CONFIG_PATH');
    $domainPrivateConfigPath = $root . '/../private/erdetkriginorge/config.php';
    $accountPrivateConfigPath = dirname(dirname(dirname($root))) . '/private/erdetkriginorge/config.php';
    $localConfigPath = $root . '/config.local.php';
    $fileConfig = [];
    $configPaths = array_filter([
        $explicitConfigPath,
        $domainPrivateConfigPath,
        $accountPrivateConfigPath,
        $localConfigPath,
    ]);

    foreach (array_unique($configPaths) as $path) {
        if ($path && is_file($path)) {
            $loaded = require $path;
            if (is_array($loaded)) {
                $fileConfig = array_replace($fileConfig, $loaded);
            }
        }
    }

    $config = array_replace([
        'site_url' => erdet_env('SITE_URL', erdet_env('NEXT_PUBLIC_SITE_URL', 'https://erdetkriginorge.no')),
        'openai_api_key' => erdet_env('OPENAI_API_KEY', ''),
        'openai_model' => erdet_env('OPENAI_MODEL', 'gpt-5.4-mini'),
        'smtp_host' => erdet_env('SMTP_HOST', 'smtp.hostinger.com'),
        'smtp_port' => erdet_int(erdet_env('SMTP_PORT'), 465),
        'smtp_secure' => erdet_bool(erdet_env('SMTP_SECURE'), true),
        'smtp_user' => erdet_env('SMTP_USER', ''),
        'smtp_password' => erdet_env('SMTP_PASSWORD', ''),
        'alert_email_from' => erdet_env('ALERT_EMAIL_FROM', erdet_env('SMTP_USER', '')),
        'alert_email_to' => erdet_env('ALERT_EMAIL_TO', 'lyder2@mac.com'),
        'storage_path' => erdet_env('ERDET_STORAGE_PATH', $root . '/storage'),
        'status_cache_ttl' => 60,
        'exercise_cache_ttl' => 3600,
        'notification_dedupe_ttl' => 86400,
        'http_timeout' => 7,
        'user_agent' => 'erdetkriginorge.no/1.0 (+https://erdetkriginorge.no)',
        'max_exercise_detail_pages' => 12,
    ], $fileConfig);

    $config['smtp_port'] = erdet_int($config['smtp_port'] ?? null, 465);
    $config['smtp_secure'] = erdet_bool($config['smtp_secure'] ?? null, true);
    $config['status_cache_ttl'] = erdet_int($config['status_cache_ttl'] ?? null, 60);
    $config['exercise_cache_ttl'] = erdet_int($config['exercise_cache_ttl'] ?? null, 3600);
    $config['notification_dedupe_ttl'] = erdet_int($config['notification_dedupe_ttl'] ?? null, 86400);
    $config['http_timeout'] = erdet_int($config['http_timeout'] ?? null, 7);
    $config['max_exercise_detail_pages'] = erdet_int($config['max_exercise_detail_pages'] ?? null, 12);

    return $config;
}
