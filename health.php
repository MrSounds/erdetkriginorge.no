<?php
header('Content-Type: text/plain; charset=utf-8');
ini_set('display_errors', '1');
error_reporting(E_ALL);

echo 'php-ok ' . PHP_VERSION . "\n";

try {
    require_once __DIR__ . '/app/bootstrap.php';
    echo "bootstrap-ok\n";
    $config = erdet_config();
    echo 'storage=' . (string) $config['storage_path'] . "\n";
    echo 'curl=' . (function_exists('curl_init') ? 'yes' : 'no') . "\n";
    echo 'simplexml=' . (function_exists('simplexml_load_string') ? 'yes' : 'no') . "\n";
} catch (Throwable $error) {
    http_response_code(500);
    echo get_class($error) . ': ' . $error->getMessage() . "\n";
    echo $error->getFile() . ':' . $error->getLine() . "\n";
}
