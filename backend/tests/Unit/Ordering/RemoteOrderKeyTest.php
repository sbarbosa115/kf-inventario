<?php

namespace App\Tests\Unit\Ordering;

use App\Ordering\Application\Command\RemoteOrderKey;
use PHPUnit\Framework\TestCase;

/**
 * What makes a pulled WooCommerce order "already imported": the shop's order id is the order's code (the webhook stores
 * it so), in the warehouse that receives that shop's orders.
 */
final class RemoteOrderKeyTest extends TestCase
{
    public function testARemoteOrderMatchesTheOrderWhoseCodeIsItsIdInTheSameWarehouse(): void
    {
        $remote = RemoteOrderKey::ofRemoteOrder(3, ['id' => 5501, 'line_items' => []]);
        $stored = RemoteOrderKey::ofOrder(3, '5501');

        self::assertNotNull($remote);
        self::assertNotNull($stored);
        self::assertTrue($remote->equals($stored), 'The shop sends its id as a number; the order keeps it as its code, a string.');
        self::assertSame((string) $remote, (string) $stored, 'The same key, so a set of the warehouse\'s keys finds it.');
    }

    public function testTheSameIdInAnotherWarehouseIsAnotherOrder(): void
    {
        $here = RemoteOrderKey::ofRemoteOrder(3, ['id' => 5501]);
        $there = RemoteOrderKey::ofOrder(4, '5501');

        self::assertNotNull($here);
        self::assertNotNull($there);
        self::assertFalse($here->equals($there), 'Two shops number their orders on their own: 5501 of one is not 5501 of the other.');
        self::assertNotSame((string) $here, (string) $there);
    }

    public function testSpacesAroundACodeTypedByHandDoNotMakeItAnotherOrder(): void
    {
        $remote = RemoteOrderKey::ofRemoteOrder(1, ['id' => '5501']);
        $typed = RemoteOrderKey::ofOrder(1, ' 5501 ');

        self::assertNotNull($remote);
        self::assertNotNull($typed);
        self::assertTrue($remote->equals($typed));
    }

    public function testAnOrderWithoutACodeOrARemoteOrderWithoutAnIdHasNoKey(): void
    {
        self::assertNull(RemoteOrderKey::ofOrder(1, null), 'An order typed without a code was not imported from a shop.');
        self::assertNull(RemoteOrderKey::ofOrder(1, '  '));
        self::assertNull(RemoteOrderKey::ofRemoteOrder(1, ['billing' => []]), 'Not a WooCommerce order: nothing to compare.');
        self::assertNull(RemoteOrderKey::ofRemoteOrder(1, ['id' => ['nested']]));
    }
}
