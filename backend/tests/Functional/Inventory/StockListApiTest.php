<?php

namespace App\Tests\Functional\Inventory;

use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\Domain\Model\Warehouse;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

/**
 * GET /api/v1/warehouses/{id}/stock in SQL (docs/pdr/prd-shops-settings.md, "List query contract", item 1): a
 * warehouse's stock rows of one status filtered by code, title, detail, quantity, price and in-stock, sorted, paged
 * (per_page=0: every row, for the pickers), with the totals (units, value) of every row the filters keep.
 */
final class StockListApiTest extends ApiTestCase
{
    use InventoryFixtures;
    use SignsIn;

    private Warehouse $warehouse;

    protected function setUp(): void
    {
        parent::setUp();
        $this->signInAs(['ROLE_MANAGE_INVENTORY']);
        $this->warehouse = $this->aWarehouse('Stock lists');
        $elsewhere = $this->aWarehouse('Elsewhere');
        $this->aStock($this->aProduct('STK-1', 'Blue mug', 5.0), $this->warehouse, 0);
        $this->aStock($this->aProduct('STK-2', 'Red mug', 600.0), $this->warehouse, 3);
        $lamp = $this->aProduct('STK-3', 'Lamp', 150.0, 'Brass, 40% off');
        $this->aStock($lamp, $this->warehouse, 12);
        $this->aStock($this->aProduct('STK-4', 'Chair', 80.0), $this->warehouse, 7, ProductWarehouse::STATUS_PENDING_TO_CONFIRM);
        $this->aStock($lamp, $elsewhere, 99);
        $this->em()->clear();
    }

    /**
     * @return array<mixed>
     */
    private function list(string $query = ''): array
    {
        $body = $this->getJson('/api/v1/warehouses/'.$this->warehouse->getId().'/stock'.('' === $query ? '' : '?'.$query));
        $this->assertStatus(200, $query);

        return $body;
    }

    /**
     * @return list<string>
     */
    private function codes(string $query = ''): array
    {
        return array_column($this->list($query)['items'], 'code');
    }

    public function testEveryRowAtOnceForThePickersWithPerPageZero(): void
    {
        $body = $this->list('per_page=0');

        self::assertSame(['STK-1', 'STK-2', 'STK-3'], array_column($body['items'], 'code'), 'Every confirmed row of the warehouse, by code.');
        self::assertSame(3, $body['total']);
        self::assertSame(0, $body['per_page']);
        self::assertSame(1, $body['page']);
        $lamp = $body['items'][2];
        self::assertSame(12, $lamp['quantity']);
        self::assertSame('Lamp', $lamp['title']);
        self::assertEquals(150, $lamp['price']);
        self::assertSame(['id' => $this->warehouse->getId(), 'name' => 'Stock lists'], $lamp['warehouse']);

        self::assertSame(['STK-4'], $this->codes('status=0&per_page=0'), 'status=0: the incoming rows.');
        $this->getJson('/api/v1/customers?per_page=0');
        $this->assertStatus(403, 'The customers list is not this user\'s.');
    }

    public function testTotalsAddUpEveryRowTheFiltersKeepNotOnlyThePage(): void
    {
        $body = $this->list('per_page=1');

        self::assertCount(1, $body['items']);
        self::assertSame(['units' => 15, 'value' => 3600], $body['totals'], '0 × 5 + 3 × 600 + 12 × 150.');
        self::assertSame(['units' => 3, 'value' => 1800], $this->list('filter[price][min]=500')['totals']);
        self::assertSame(['units' => 0, 'value' => 0], $this->list('filter[code]=nothing')['totals'], 'Nothing kept: zero.');
        self::assertSame(['units' => 7, 'value' => 560], $this->list('status=0')['totals'], 'The incoming rows have their own totals.');
    }

    public function testQuantityAndPriceRangesIncludeBothEnds(): void
    {
        self::assertSame(['STK-2'], $this->codes('filter[quantity][min]=1&filter[quantity][max]=3'));
        self::assertSame(['STK-1', 'STK-3'], $this->codes('filter[price][max]=150'), 'The max is included.');
        self::assertSame(['STK-2', 'STK-3'], $this->codes('filter[price][min]=150.00'), 'The min is included.');
        self::assertSame(['STK-3'], $this->codes('filter[price][min]=100&filter[price][max]=500'));
        self::assertSame(['STK-1'], $this->codes('filter[quantity][max]=0'));
    }

    public function testTextFiltersInStockAndItsFacet(): void
    {
        self::assertSame(['STK-1', 'STK-2'], $this->codes('filter[title]=MUG'));
        self::assertSame(['STK-3'], $this->codes('filter[detail]=40%25'), '% matches itself.');
        self::assertSame(['STK-2'], $this->codes('filter[code]=stk-2'));
        self::assertSame(['STK-3'], $this->codes('q=brass'), 'q looks in the detail too.');
        self::assertSame(['STK-2', 'STK-3'], $this->codes('filter[in_stock][]=yes'));
        self::assertSame(['STK-1'], $this->codes('filter[in_stock][]=no'));

        $body = $this->list('per_page=1&filter[title]=mug&facets=in_stock');
        self::assertSame([['value' => 'no', 'count' => 1], ['value' => 'yes', 'count' => 1]], $body['facets']['in_stock'], 'Counted over the other filters (the two mugs).');
        $own = $this->list('filter[in_stock][]=yes&facets=in_stock');
        self::assertSame([['value' => 'no', 'count' => 1], ['value' => 'yes', 'count' => 2]], $own['facets']['in_stock'], 'The in-stock filter does not narrow its own counts.');
        self::assertSame(2, $own['total']);
        self::assertSame(['units' => 15, 'value' => 3600], $own['totals']);
    }

    public function testSortsComeFromTheAllowList(): void
    {
        self::assertSame(['STK-3', 'STK-2', 'STK-1'], $this->codes('sort=-code'));
        self::assertSame(['STK-1', 'STK-3', 'STK-2'], $this->codes('sort=title'));
        self::assertSame(['STK-3', 'STK-2', 'STK-1'], $this->codes('sort=-quantity'));
        self::assertSame(['STK-2', 'STK-3', 'STK-1'], $this->codes('sort=-price'));

        $body = $this->getJson('/api/v1/warehouses/'.$this->warehouse->getId().'/stock?sort=uuid&filter[warehouse]=1');
        $this->assertStatus(422);
        self::assertSame(['sort', 'filter.warehouse'], array_column($body['violations'], 'field'));
    }

    public function testAnUnknownWarehouseIsNotFound(): void
    {
        $body = $this->getJson('/api/v1/warehouses/999999/stock?per_page=0');

        $this->assertStatus(404);
        self::assertSame('warehouse_not_found', $body['error']);
    }
}
