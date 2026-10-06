<?php

namespace App\Tests\Functional\Shared;

use App\Tests\Support\ApiTestCase;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * Every response tells the browser not to guess content types, not to be framed by another site (clickjacking) and
 * not to send the app's URLs to other sites.
 */
final class SecurityHeadersTest extends ApiTestCase
{
    /**
     * @return iterable<string, array{string}>
     */
    public static function pages(): iterable
    {
        yield 'the React app' => ['/admin/login'];
        yield 'the API, signed out' => ['/api/v1/auth/me'];
        yield 'an unknown API path' => ['/api/v1/nothing-here'];
    }

    #[DataProvider('pages')]
    public function testEveryResponseCarriesTheSecurityHeaders(string $uri): void
    {
        $this->client->request('GET', $uri, server: ['HTTP_ACCEPT' => 'application/json']);

        $headers = $this->client->getResponse()->headers;
        self::assertSame('nosniff', $headers->get('X-Content-Type-Options'), $uri);
        self::assertSame('DENY', $headers->get('X-Frame-Options'), $uri);
        self::assertSame("frame-ancestors 'none'", $headers->get('Content-Security-Policy'), $uri);
        self::assertSame('same-origin', $headers->get('Referrer-Policy'), $uri);
    }
}
