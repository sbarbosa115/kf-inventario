<?php

namespace App\Tests\Functional\Inventory;

use App\Inventory\Domain\Model\ProductWarehouse;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

/**
 * Stock per warehouse: the list, moves between warehouses, the barcode reader's add/remove and the incoming
 * approval (the rules of the legacy ProductService, ported test by test from ProductServiceTest and
 * ProductControllerTest).
 */
final class StockApiTest extends ApiTestCase
{
    use InventoryFixtures;
    use SignsIn;

    private const PENDING = ProductWarehouse::STATUS_PENDING_TO_CONFIRM;
    private const CONFIRMED = ProductWarehouse::STATUS_CONFIRMED;

    protected function setUp(): void
    {
        parent::setUp();
        $this->signInAs(['ROLE_USER', 'ROLE_MANAGE_INVENTORY']);
    }

    public function testTheListShowsAWarehousesStockInStockByDefault(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $usa = $this->aWarehouse('Usa');
        $a = $this->aProduct('KF-01', 'Chair', 12.5, 'Oak');
        $b = $this->aProduct('KF-02');
        $row = $this->aStock($a, $colombia, 100);
        $this->aStock($b, $colombia, 7, self::PENDING);
        $this->aStock($b, $usa, 3);

        $rows = $this->getJson("/api/v1/warehouses/{$colombia->getId()}/stock");

        $this->assertStatus(200);
        self::assertSame([[
            'id' => $row->getId(),
            'status' => 1,
            'quantity' => 100,
            'product_id' => $a->getId(),
            'uuid' => $a->getUuid(),
            'code' => 'KF-01',
            'title' => 'Chair',
            'detail' => 'Oak',
            'price' => 12.5,
            'warehouse' => ['id' => $colombia->getId(), 'name' => 'Colombia'],
        ]], $rows, 'Only the rows in stock of that warehouse, with their product.');
    }

    public function testTheListShowsTheIncomingRowsWithStatusZero(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $a = $this->aProduct('KF-01');
        $b = $this->aProduct('KF-02');
        $this->aStock($a, $colombia, 100);
        $this->aStock($b, $colombia, 7, self::PENDING);

        $rows = $this->getJson("/api/v1/warehouses/{$colombia->getId()}/stock?status=0");

        $this->assertStatus(200);
        self::assertSame(['KF-02'], array_column($rows, 'code'), 'status=0 lists what waits for approval.');
        self::assertSame(0, $rows[0]['status']);
    }

    public function testTheListIsOrderedByProduct(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $first = $this->aProduct('KF-B');
        $second = $this->aProduct('KF-A');
        $this->aStock($second, $colombia, 1);
        $this->aStock($first, $colombia, 1);

        $rows = $this->getJson("/api/v1/warehouses/{$colombia->getId()}/stock");

        self::assertSame(['KF-B', 'KF-A'], array_column($rows, 'code'), 'As the legacy list: by product, oldest first.');
    }

    public function testAnUnknownWarehouseHasNoStock(): void
    {
        $body = $this->getJson('/api/v1/warehouses/999999/stock');

        $this->assertStatus(404);
        self::assertSame('warehouse_not_found', $body['error']);
    }

    public function testAMoveSubtractsFromTheSourceAndArrivesPendingAtTheDestination(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $usa = $this->aWarehouse('Usa');
        $a = $this->aProduct('KF-01');
        $b = $this->aProduct('KF-02');
        $this->aStock($a, $colombia, 100);
        $this->aStock($b, $colombia, 100);

        $this->sendJson('POST', "/api/v1/warehouses/{$colombia->getId()}/moves/{$usa->getId()}", ['items' => [
            ['uuid' => $a->getUuid(), 'quantity' => 20],
            ['code' => 'KF-02', 'quantity' => 25],
        ]]);

        $this->assertStatus(204);
        self::assertSame([['status' => self::CONFIRMED, 'quantity' => 80]], $this->stockRows($a, $colombia), 'The source gives what was moved.');
        self::assertSame([['status' => self::CONFIRMED, 'quantity' => 75]], $this->stockRows($b, $colombia));
        self::assertSame([['status' => self::PENDING, 'quantity' => 20]], $this->stockRows($a, $usa), 'The destination receives it as incoming, waiting for approval.');
        self::assertSame([['status' => self::PENDING, 'quantity' => 25]], $this->stockRows($b, $usa));
        self::assertSame(['Moved products from Colombia to Usa'], $this->productLogEvents(), 'Each move is in the activity log, as before.');
    }

    public function testASecondMoveAddsToTheIncomingRowAlreadyThere(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $usa = $this->aWarehouse('Usa');
        $a = $this->aProduct('KF-01');
        $this->aStock($a, $colombia, 100);
        $this->aStock($a, $usa, 5);
        $this->aStock($a, $usa, 10, self::PENDING);

        $this->sendJson('POST', "/api/v1/warehouses/{$colombia->getId()}/moves/{$usa->getId()}", ['items' => [['uuid' => $a->getUuid(), 'quantity' => 50]]]);

        $this->assertStatus(204);
        self::assertSame([['status' => self::CONFIRMED, 'quantity' => 50]], $this->stockRows($a, $colombia));
        self::assertSame([
            ['status' => self::CONFIRMED, 'quantity' => 5],
            ['status' => self::PENDING, 'quantity' => 60],
        ], $this->stockRows($a, $usa), 'The incoming row grows; the confirmed one waits for the approval.');
    }

    public function testAWarehouseCannotMoveToItself(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $a = $this->aProduct('KF-01');
        $this->aStock($a, $colombia, 100);

        $body = $this->sendJson('POST', "/api/v1/warehouses/{$colombia->getId()}/moves/{$colombia->getId()}", ['items' => [['uuid' => $a->getUuid(), 'quantity' => 5]]]);

        $this->assertStatus(409);
        self::assertSame('same_warehouse', $body['error']);
        self::assertSame([['status' => self::CONFIRMED, 'quantity' => 100]], $this->stockRows($a, $colombia));
    }

    public function testMovingMoreThanAvailableIsRefusedWithWhatIsAvailableAndMovesNothing(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $usa = $this->aWarehouse('Usa');
        $a = $this->aProduct('KF-01');
        $b = $this->aProduct('KF-02');
        $this->aStock($a, $colombia, 100);
        $this->aStock($b, $colombia, 3);

        $body = $this->sendJson('POST', "/api/v1/warehouses/{$colombia->getId()}/moves/{$usa->getId()}", ['items' => [
            ['uuid' => $a->getUuid(), 'quantity' => 10],
            ['uuid' => $b->getUuid(), 'quantity' => 4],
        ]]);

        $this->assertStatus(422);
        self::assertSame('insufficient_stock', $body['error']);
        self::assertSame(['code' => 'KF-02', 'available' => 3], $body['detail'], 'The UI names the product short of stock and how many there are.');
        self::assertSame([['status' => self::CONFIRMED, 'quantity' => 100]], $this->stockRows($a, $colombia), 'A refused move changes no row, not even the lines before the refused one.');
        self::assertSame([], $this->stockRows($a, $usa));
    }

    public function testMovingAProductTheSourceDoesNotHoldIsNotFound(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $usa = $this->aWarehouse('Usa');
        $a = $this->aProduct('KF-01');

        $body = $this->sendJson('POST', "/api/v1/warehouses/{$colombia->getId()}/moves/{$usa->getId()}", ['items' => [['uuid' => $a->getUuid(), 'quantity' => 1]]]);

        $this->assertStatus(404);
        self::assertSame('stock_not_found', $body['error']);
    }

    public function testMovingAnUnknownProductIsNotFound(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $usa = $this->aWarehouse('Usa');

        $body = $this->sendJson('POST', "/api/v1/warehouses/{$colombia->getId()}/moves/{$usa->getId()}", ['items' => [['code' => 'NOPE', 'quantity' => 1]]]);

        $this->assertStatus(404);
        self::assertSame('product_not_found', $body['error']);
    }

    public function testMovingToAnUnknownWarehouseIsNotFound(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $a = $this->aProduct('KF-01');
        $this->aStock($a, $colombia, 100);

        $body = $this->sendJson('POST', "/api/v1/warehouses/{$colombia->getId()}/moves/999999", ['items' => [['uuid' => $a->getUuid(), 'quantity' => 1]]]);

        $this->assertStatus(404);
        self::assertSame('warehouse_not_found', $body['error']);
    }

    public function testAMoveNeedsAtLeastOneLineWithAPositiveQuantity(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $usa = $this->aWarehouse('Usa');

        $body = $this->sendJson('POST', "/api/v1/warehouses/{$colombia->getId()}/moves/{$usa->getId()}", ['items' => []]);
        $this->assertStatus(422);
        self::assertSame('validation_failed', $body['error']);

        $body = $this->sendJson('POST', "/api/v1/warehouses/{$colombia->getId()}/moves/{$usa->getId()}", ['items' => [['code' => 'KF-01', 'quantity' => 0]]]);
        $this->assertStatus(422);
        self::assertSame('validation_failed', $body['error']);
    }

    public function testTheBarcodeReaderAddsByCode(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $a = $this->aProduct('KF-01');
        $b = $this->aProduct('KF-02');
        $this->aStock($a, $colombia, 100);

        $this->sendJson('POST', "/api/v1/warehouses/{$colombia->getId()}/stock/add", ['items' => [
            ['code' => 'KF-01', 'quantity' => 10],
            ['code' => 'KF-02', 'quantity' => 20],
        ]]);

        $this->assertStatus(204);
        self::assertSame([['status' => self::CONFIRMED, 'quantity' => 110]], $this->stockRows($a, $colombia), 'The stock row grows.');
        self::assertSame([['status' => self::CONFIRMED, 'quantity' => 20]], $this->stockRows($b, $colombia), 'A product the warehouse did not hold gets a row in stock.');
        self::assertSame(['Added 2 products to Colombia'], $this->productLogEvents());
    }

    public function testAddingAnUnknownCodeIsSkipped(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $a = $this->aProduct('KF-01');
        $this->aStock($a, $colombia, 1);

        $this->sendJson('POST', "/api/v1/warehouses/{$colombia->getId()}/stock/add", ['items' => [
            ['code' => 'NOPE', 'quantity' => 10],
            ['code' => 'KF-01', 'quantity' => 1],
        ]]);

        $this->assertStatus(204);
        self::assertSame([['status' => self::CONFIRMED, 'quantity' => 2]], $this->stockRows($a, $colombia), 'As before: an unknown code is ignored, the rest is added.');
    }

    public function testTheBarcodeReaderRemovesByCode(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $a = $this->aProduct('KF-01');
        $this->aStock($a, $colombia, 100);

        $this->sendJson('POST', "/api/v1/warehouses/{$colombia->getId()}/stock/remove", ['items' => [['code' => 'KF-01', 'quantity' => 30]]]);

        $this->assertStatus(204);
        self::assertSame([['status' => self::CONFIRMED, 'quantity' => 70]], $this->stockRows($a, $colombia));
        self::assertSame(['Removed 1 products to Colombia'], $this->productLogEvents());
    }

    public function testRemovingMoreThanTheStockIsRefused(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $a = $this->aProduct('KF-01');
        $this->aStock($a, $colombia, 5);

        $body = $this->sendJson('POST', "/api/v1/warehouses/{$colombia->getId()}/stock/remove", ['items' => [['code' => 'KF-01', 'quantity' => 6]]]);

        $this->assertStatus(422);
        self::assertSame('insufficient_stock', $body['error']);
        self::assertSame(['code' => 'KF-01', 'available' => 5], $body['detail']);
        self::assertSame([['status' => self::CONFIRMED, 'quantity' => 5]], $this->stockRows($a, $colombia));
    }

    public function testRemovingAProductTheWarehouseDoesNotHoldIsNotFound(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $this->aProduct('KF-01');

        $body = $this->sendJson('POST', "/api/v1/warehouses/{$colombia->getId()}/stock/remove", ['items' => [['code' => 'KF-01', 'quantity' => 1]]]);

        $this->assertStatus(404);
        self::assertSame('stock_not_found', $body['error']);
    }

    public function testApprovingTheIncomingFlipsEveryPendingRowOfThatWarehouse(): void
    {
        $colombia = $this->aWarehouse('Colombia');
        $usa = $this->aWarehouse('Usa');
        $a = $this->aProduct('KF-01');
        $b = $this->aProduct('KF-02');
        $this->aStock($a, $usa, 20, self::PENDING);
        $this->aStock($b, $usa, 25, self::PENDING);
        $this->aStock($a, $colombia, 4, self::PENDING);

        $body = $this->sendJson('POST', "/api/v1/warehouses/{$usa->getId()}/incoming/approve");

        $this->assertStatus(200);
        self::assertSame(['approved' => 2], $body);
        self::assertSame([['status' => self::CONFIRMED, 'quantity' => 20]], $this->stockRows($a, $usa), 'Approved: now in stock.');
        self::assertSame([['status' => self::CONFIRMED, 'quantity' => 25]], $this->stockRows($b, $usa));
        self::assertSame([['status' => self::PENDING, 'quantity' => 4]], $this->stockRows($a, $colombia), 'Another warehouse\'s incoming waits for its own approval.');
    }

    public function testApprovingAddsTheIncomingToTheRowAlreadyInStock(): void
    {
        $espana = $this->aWarehouse('España');
        $kf = $this->aProduct('KF-02');
        $this->aStock($kf, $espana, 2);
        $this->aStock($kf, $espana, 4, self::PENDING);

        $body = $this->sendJson('POST', "/api/v1/warehouses/{$espana->getId()}/incoming/approve");

        $this->assertStatus(200);
        self::assertSame(['approved' => 1], $body);
        self::assertSame(
            [['status' => self::CONFIRMED, 'quantity' => 6]],
            $this->stockRows($kf, $espana),
            'One row in stock per product and warehouse: the legacy approval left two (2 and 4), and the barcode reader and shipments then read the first one only.',
        );
    }

    public function testApprovingWithNothingIncomingApprovesNothing(): void
    {
        $usa = $this->aWarehouse('Usa');

        $body = $this->sendJson('POST', "/api/v1/warehouses/{$usa->getId()}/incoming/approve");

        $this->assertStatus(200);
        self::assertSame(['approved' => 0], $body);
    }
}
