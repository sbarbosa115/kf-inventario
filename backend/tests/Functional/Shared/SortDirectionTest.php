<?php

namespace App\Tests\Functional\Shared;

use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use Doctrine\Deprecations\Deprecation;

/**
 * Doctrine ORM deprecates a string direction in QueryBuilder::orderBy()/addOrderBy()
 * (https://github.com/doctrine/orm/issues/11313): production logged it on every list. Queries pass a SortDirection.
 */
final class SortDirectionTest extends ApiTestCase
{
    use SignsIn;

    private const ISSUE = 'https://github.com/doctrine/orm/issues/11313';

    public function testTheListsSortWithoutTheStringDirectionDeprecation(): void
    {
        $this->signInAs(['ROLE_ADMIN', 'ROLE_UPDATE_INVOICES', 'ROLE_CAN_READ_INVOICES', 'ROLE_MANAGE_CUSTOMERS', 'ROLE_USER'], 'sortdir');
        Deprecation::enableTrackingDeprecations();

        foreach (['/api/v1/users', '/api/v1/users?sort=-name', '/api/v1/customers', '/api/v1/invoices', '/api/v1/locations'] as $uri) {
            $this->getJson($uri);
        }

        self::assertSame(0, Deprecation::getTriggeredDeprecations()[self::ISSUE] ?? 0, 'A list still passes a string direction to orderBy().');
    }

    public function testNoQueryInSrcPassesAStringDirection(): void
    {
        $offenders = [];
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator(\dirname(__DIR__, 3).'/src'));
        foreach ($files as $file) {
            if ('php' !== $file->getExtension()) {
                continue;
            }
            foreach (file((string) $file) as $number => $line) {
                if (preg_match('/(?:orderBy|addOrderBy)\([^;]*,\s*[\'"](?:ASC|DESC)[\'"]|\?\s*[\'"]DESC[\'"]\s*:\s*[\'"]ASC[\'"]/i', $line)) {
                    $offenders[] = $file->getFilename().':'.($number + 1);
                }
            }
        }

        self::assertSame([], $offenders, 'Pass SortDirection::Ascending/Descending, not a string.');
    }
}
