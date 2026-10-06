<?php

namespace App\Tests\Functional\Inventory;

use App\Inventory\Domain\Model\Warehouse;
use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;

/**
 * The warehouses: listed for every picker and renamed (as the legacy /admin/warehouse pages: any signed-in user).
 */
final class WarehouseApiTest extends ApiTestCase
{
    use InventoryFixtures;
    use SignsIn;

    protected function setUp(): void
    {
        parent::setUp();
        $this->signInAs(['ROLE_USER']);
    }

    public function testEveryWarehouseIsListedWithItsShopAddresses(): void
    {
        $colombia = $this->aWarehouse('Colombia', ['https://shop.example.co']);
        $usa = $this->aWarehouse('Usa');

        $rows = $this->getJson('/api/v1/warehouses');

        $this->assertStatus(200);
        $mine = array_values(array_filter($rows, static fn (array $row): bool => \in_array($row['id'], [$colombia->getId(), $usa->getId()], true)));
        self::assertSame([
            ['id' => $colombia->getId(), 'name' => 'Colombia', 'urls' => ['https://shop.example.co']],
            ['id' => $usa->getId(), 'name' => 'Usa', 'urls' => []],
        ], $mine, 'Every warehouse, by id, with the WooCommerce sources that send it orders.');
    }

    public function testAnyoneSignedInRenamesAWarehouse(): void
    {
        $colombia = $this->aWarehouse('Colombia', ['https://shop.example.co']);

        $body = $this->sendJson('PUT', "/api/v1/warehouses/{$colombia->getId()}", ['name' => 'Bogotá']);

        $this->assertStatus(200);
        self::assertSame(['id' => $colombia->getId(), 'name' => 'Bogotá', 'urls' => ['https://shop.example.co']], $body, 'Only the name changes.');
        $this->em()->clear();
        self::assertSame('Bogotá', $this->em()->find(Warehouse::class, $colombia->getId())?->getName());
    }

    public function testAWarehouseNeedsAName(): void
    {
        $colombia = $this->aWarehouse('Colombia');

        $body = $this->sendJson('PUT', "/api/v1/warehouses/{$colombia->getId()}", ['name' => '']);

        $this->assertStatus(422);
        self::assertSame('name', $body['violations'][0]['field']);
    }

    public function testRenamingAnUnknownWarehouseIsNotFound(): void
    {
        $body = $this->sendJson('PUT', '/api/v1/warehouses/999999', ['name' => 'Nowhere']);

        $this->assertStatus(404);
        self::assertSame('warehouse_not_found', $body['error']);
    }
}
