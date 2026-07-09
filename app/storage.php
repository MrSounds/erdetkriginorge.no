<?php

declare(strict_types=1);

function erdet_storage_dir(): string
{
    $config = erdet_config();
    $dir = rtrim((string) $config['storage_path'], '/');

    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('Kunne ikke opprette storage-mappe');
    }

    return $dir;
}

function erdet_storage_file(string $name): string
{
    $safeName = preg_replace('/[^a-z0-9_.-]/i', '', $name) ?: 'cache.json';

    return erdet_storage_dir() . '/' . $safeName;
}

function erdet_read_cache(string $name, int $ttlSeconds): ?array
{
    $path = erdet_storage_file($name);

    if (!is_file($path)) {
        return null;
    }

    $raw = file_get_contents($path);
    $decoded = is_string($raw) ? json_decode($raw, true) : null;

    if (!is_array($decoded) || !isset($decoded['cachedAt'], $decoded['data'])) {
        return null;
    }

    if ((time() - (int) $decoded['cachedAt']) > $ttlSeconds) {
        return null;
    }

    return is_array($decoded['data']) ? $decoded['data'] : null;
}

function erdet_write_cache(string $name, array $data): void
{
    $path = erdet_storage_file($name);
    $payload = [
        'cachedAt' => time(),
        'data' => $data,
    ];
    $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);

    if (!is_string($encoded)) {
        throw new RuntimeException('Kunne ikke skrive JSON-cache');
    }

    $tmp = $path . '.' . bin2hex(random_bytes(6)) . '.tmp';
    file_put_contents($tmp, $encoded, LOCK_EX);
    rename($tmp, $path);
}

function erdet_with_file_lock(string $name, callable $callback)
{
    $path = erdet_storage_file($name);
    $handle = fopen($path, 'c+');

    if ($handle === false) {
        throw new RuntimeException('Kunne ikke åpne lockfil');
    }

    try {
        flock($handle, LOCK_EX);

        return $callback($handle);
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}
