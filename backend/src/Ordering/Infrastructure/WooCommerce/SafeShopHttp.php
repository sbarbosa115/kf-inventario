<?php

namespace App\Ordering\Infrastructure\WooCommerce;

use App\Ordering\Application\Port\ShopCredentials;
use App\Ordering\Application\Port\ShopUrlGuard;
use App\Ordering\Domain\Error\ShopUnreachable;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\HandlerStack;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Every HTTP call the app makes to a shop goes through here (docs/pdr/prd-shops-settings.md, Security, SSRF):
 *
 * - the site URL must be https (http only in the dev environment, for the dev stack's fake shop);
 * - its host must not be, or resolve to, a loopback, private, shared, link-local, multicast or reserved address — every
 *   address it resolves to is checked, and the connection is pinned to the checked address (CURLOPT_RESOLVE), so a
 *   DNS answer that changes between the check and the call cannot reach the internal network;
 * - redirects are never followed (a 3xx is a failure), the call gives up after TIMEOUT seconds;
 * - only /wp-json/wc/v3/<endpoint> paths the app builds are called (an endpoint is checked against a pattern; the site
 *   URL from the connection is never joined with request input).
 *
 * In dev, the hosts in $devHosts (the dev stack's own web server, `nginx`, which serves /_fake-shop) may be private.
 */
final class SafeShopHttp implements ShopUrlGuard
{
    public const TIMEOUT = 15;
    public const DEV_HOSTS = ['nginx'];
    private const API = '/wp-json/wc/v3/';
    private const ENDPOINT = '#^[a-z_]+(/[0-9]+(/[a-z_]+(/[0-9]+)?)?)?$#';

    /** IPv4 ranges no shop lives in: [network, prefix]. */
    private const BLOCKED_V4 = [
        ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
        ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
        ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
    ];

    /** IPv6 ranges no shop lives in (the IPv4-mapped ones are checked as IPv4; ::/96 holds ::1 and the IPv4-compatible ones). */
    private const BLOCKED_V6 = [
        ['::', 96], ['64:ff9b::', 96], ['100::', 64], ['2001:db8::', 32], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
    ];

    /** @var \Closure(string): list<string> */
    private readonly \Closure $resolve;

    private readonly Client $client;

    /**
     * @param (\Closure(string): list<string>)|null $resolve  the IPv4 addresses of a host name (gethostbynamel)
     * @param callable|null                         $handler  Guzzle's HTTP handler (tests stub it; default: cURL)
     * @param list<string>                          $devHosts
     */
    public function __construct(
        #[Autowire('%kernel.environment%')]
        private readonly string $environment,
        ?\Closure $resolve = null,
        ?callable $handler = null,
        private readonly array $devHosts = self::DEV_HOSTS,
    ) {
        $this->resolve = $resolve ?? static fn (string $host): array => gethostbynamel($host) ?: [];
        $this->client = new Client(['handler' => HandlerStack::create($handler)]);
    }

    public function refusal(string $siteUrl): ?string
    {
        try {
            $this->target($siteUrl, false);

            return null;
        } catch (ShopUnreachable $e) {
            return $e->reason();
        }
    }

    /**
     * One call to the shop's WooCommerce REST API (wc/v3), with the connection's keys (HTTP Basic, over https).
     *
     * @param string                    $endpoint `orders`, `orders/123`, `orders/123/notes`, `system_status`…
     * @param array<string, scalar>     $query
     * @param array<string, mixed>|null $body     sent as JSON
     *
     * @return mixed the decoded JSON answer
     *
     * @throws ShopUnreachable           refused URL, unreachable, timed out, a redirect, an error status, not JSON
     * @throws \InvalidArgumentException an endpoint the app does not build
     */
    public function api(ShopCredentials $shop, string $method, string $endpoint, array $query = [], ?array $body = null): mixed
    {
        if (1 !== preg_match(self::ENDPOINT, $endpoint)) {
            throw new \InvalidArgumentException(\sprintf('"%s" is not a WooCommerce REST endpoint the app calls.', $endpoint));
        }

        $options = ['auth' => [$shop->consumerKey, $shop->consumerSecret]];
        if ([] !== $query) {
            $options['query'] = $query;
        }
        if (null !== $body) {
            $options['json'] = $body;
        }

        return $this->call($method, $shop->siteUrl, self::API.$endpoint, $options);
    }

    /**
     * The WordPress site's index (/wp-json/): its public name. No keys are sent.
     *
     * @return array<mixed>
     *
     * @throws ShopUnreachable
     */
    public function siteIndex(string $siteUrl): array
    {
        $answer = $this->call('GET', $siteUrl, '/wp-json/', []);

        return \is_array($answer) ? $answer : [];
    }

    /**
     * @param array<string, mixed> $options
     *
     * @throws ShopUnreachable
     */
    private function call(string $method, string $siteUrl, string $path, array $options): mixed
    {
        [$host, $port, $ip] = $this->target($siteUrl, true);

        try {
            $response = $this->client->request($method, rtrim($siteUrl, '/').$path, $options + [
                'timeout' => self::TIMEOUT,
                'connect_timeout' => self::TIMEOUT,
                'allow_redirects' => false,
                'http_errors' => false,
                'headers' => ['Accept' => 'application/json', 'User-Agent' => 'KF Inventory'],
                // An IP literal is connected to as it is; a name is pinned to the address that was checked.
                'curl' => [\CURLOPT_PROTOCOLS => \CURLPROTO_HTTP | \CURLPROTO_HTTPS]
                    + ($host === $ip ? [] : [\CURLOPT_RESOLVE => [\sprintf('%s:%d:%s', $host, $port, $ip)]]),
            ]);
        } catch (GuzzleException $e) {
            // cURL's message names the host and the failure (timeout, refused, TLS), never the keys (a header).
            throw new ShopUnreachable($e->getMessage(), null, $e);
        }

        $status = $response->getStatusCode();
        if ($status >= 300 && $status < 400) {
            throw new ShopUnreachable(\sprintf('The shop answered with a redirect (%d), which is not followed: check the site URL (https, www, the path).', $status), $status);
        }
        $content = (string) $response->getBody();
        $decoded = json_decode($content, true);
        if ($status >= 400) {
            $message = \is_array($decoded) && \is_string($decoded['message'] ?? null) ? strip_tags($decoded['message']) : \sprintf('The shop answered %d %s.', $status, $response->getReasonPhrase());

            throw new ShopUnreachable($message, $status);
        }
        if (null === $decoded && 'null' !== trim($content)) {
            throw new ShopUnreachable('The address answered, but not with WooCommerce\'s REST API (no JSON): check the site URL.', $status);
        }

        return $decoded;
    }

    /**
     * The host, port and the one checked address to connect to.
     *
     * @return array{string, int, string}
     *
     * @throws ShopUnreachable why the URL may not be used
     */
    private function target(string $siteUrl, bool $mustResolve): array
    {
        $parts = parse_url($siteUrl);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = strtolower(trim((string) ($parts['host'] ?? ''), '[]'));
        if (false === $parts || '' === $host || !\in_array($scheme, ['https', 'http'], true) || isset($parts['user']) || isset($parts['pass'])) {
            throw new ShopUnreachable('The site URL must be a web address like https://shop.example.com.');
        }
        $dev = 'dev' === $this->environment;
        if ('http' === $scheme && !$dev) {
            throw new ShopUnreachable('The site URL must use https.');
        }
        $port = (int) ($parts['port'] ?? ('https' === $scheme ? 443 : 80));

        $addresses = false !== filter_var($host, \FILTER_VALIDATE_IP) ? [$host] : ($this->resolve)($host);
        if ([] === $addresses) {
            if ($mustResolve) {
                throw new ShopUnreachable(\sprintf('The shop\'s host %s could not be resolved.', $host));
            }

            return [$host, $port, ''];
        }
        if (!($dev && \in_array($host, $this->devHosts, true))) {
            foreach ($addresses as $address) {
                if (self::isInternal($address)) {
                    throw new ShopUnreachable(\sprintf('The site URL points at a private or reserved address (%s): only public shops can be connected.', $address));
                }
            }
        }

        return [$host, $port, $addresses[0]];
    }

    private static function isInternal(string $ip): bool
    {
        $packed = @inet_pton($ip);
        if (false === $packed) {
            return true;
        }
        if (4 === \strlen($packed)) {
            return self::inRanges($packed, self::BLOCKED_V4);
        }
        // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible addresses are checked as the IPv4 address they carry.
        if (str_starts_with($packed, str_repeat("\0", 10)."\xff\xff")) {
            return self::inRanges(substr($packed, 12), self::BLOCKED_V4);
        }

        return self::inRanges($packed, self::BLOCKED_V6);
    }

    /**
     * @param list<array{string, int}> $ranges
     */
    private static function inRanges(string $packed, array $ranges): bool
    {
        foreach ($ranges as [$network, $prefix]) {
            $net = (string) inet_pton($network);
            if (\strlen($net) !== \strlen($packed)) {
                continue;
            }
            $bytes = intdiv($prefix, 8);
            $bits = $prefix % 8;
            if ($bytes > 0 && 0 !== substr_compare($packed, $net, 0, $bytes)) {
                continue;
            }
            if (0 === $bits) {
                return true;
            }
            $mask = (0xFF << (8 - $bits)) & 0xFF;
            if ((\ord($packed[$bytes]) & $mask) === (\ord($net[$bytes]) & $mask)) {
                return true;
            }
        }

        return false;
    }
}
