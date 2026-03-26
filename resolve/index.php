<?php
// resolve/index.php
// scan2play redirect resolver
// (c) 2026, info@remark.no
// v1.0.0

// --- Configuration ---
const ALLOWED_ORIGIN = 'https://player.metafor.no';
const MAX_REDIRECTS   = 5;
const TIMEOUT_SECONDS = 5;
const RATE_LIMIT      = 30;   // requests per window per IP
const RATE_WINDOW     = 60;   // seconds

// --- Rate limiting (file-based) ---
function checkRateLimit(string $ip): bool {
    $dir  = sys_get_temp_dir() . '/scan2play_rl';
    if (!is_dir($dir)) mkdir($dir, 0700, true);

    $file = $dir . '/' . md5($ip);
    $now  = time();
    $hits = [];

    if (file_exists($file)) {
        $hits = array_filter(
            explode("\n", trim(file_get_contents($file))),
            fn($t) => $t && ($now - (int)$t) < RATE_WINDOW
        );
    }

    if (count($hits) >= RATE_LIMIT) return false;

    $hits[] = $now;
    file_put_contents($file, implode("\n", $hits), LOCK_EX);
    return true;
}

// --- Block private/loopback IP ranges ---
function isPrivateHost(string $url): bool {
    $host = parse_url($url, PHP_URL_HOST);
    if (!$host) return true;

    // Strip brackets from IPv6
    $host = trim($host, '[]');

    $ip = filter_var($host, FILTER_VALIDATE_IP);
    if ($ip) {
        return !filter_var($ip, FILTER_VALIDATE_IP, [
            'flags' => FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        ]);
    }

    // Block localhost and .local hostnames
    if (in_array(strtolower($host), ['localhost', 'ip6-localhost', 'ip6-loopback'])) return true;
    if (str_ends_with(strtolower($host), '.local')) return true;

    return false;
}

// --- Validate URL ---
function isValidUrl(string $url): bool {
    $parsed = parse_url($url);
    if (!$parsed) return false;
    if (!isset($parsed['scheme']) || !in_array($parsed['scheme'], ['http', 'https'])) return false;
    if (!isset($parsed['host']) || empty($parsed['host'])) return false;
    return true;
}

// --- Resolve redirect ---
function resolveUrl(string $url): string|false {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_NOBODY         => true,       // HEAD only - no body
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => MAX_REDIRECTS,
        CURLOPT_TIMEOUT        => TIMEOUT_SECONDS,
        CURLOPT_CONNECTTIMEOUT => TIMEOUT_SECONDS,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_USERAGENT      => 'scan2play/1.0 redirect-resolver',
        CURLOPT_PROTOCOLS      => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
    ]);

    curl_exec($ch);
    $finalUrl = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
    $error    = curl_error($ch);
    curl_close($ch);

    if ($error || !$finalUrl) return false;
    return $finalUrl;
}

// --- Main ---
header('Content-Type: text/plain; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// Referer check
$referer = $_SERVER['HTTP_REFERER'] ?? '';
if (!str_starts_with($referer, ALLOWED_ORIGIN)) {
    http_response_code(403);
    echo 'Forbidden';
    exit;
}

// CORS header for fetch() calls from the player
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);

// Rate limit
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
if (!checkRateLimit($ip)) {
    http_response_code(429);
    echo 'Too Many Requests';
    exit;
}

// Get and validate URL parameter
$url = trim($_GET['url'] ?? '');
if (!$url) {
    http_response_code(400);
    echo 'Missing url parameter';
    exit;
}

if (!isValidUrl($url)) {
    http_response_code(400);
    echo 'Invalid URL';
    exit;
}

if (isPrivateHost($url)) {
    http_response_code(400);
    echo 'Invalid URL';
    exit;
}

// Resolve
$resolved = resolveUrl($url);
if (!$resolved) {
    http_response_code(502);
    echo 'Could not resolve URL';
    exit;
}

// Final validation on resolved URL (redirect could have gone somewhere unexpected)
if (!isValidUrl($resolved) || isPrivateHost($resolved)) {
    http_response_code(502);
    echo 'Resolved URL is invalid';
    exit;
}

http_response_code(200);
echo $resolved;
