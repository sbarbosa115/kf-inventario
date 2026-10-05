<?php

namespace App\Tests\Functional\Shared;

use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * The API contract (docs/pdr/prd-restructure.md, the route map): every endpoint exists, asks for the role its legacy
 * page asked for, and answers 501 until its item builds it. An item that builds an endpoint takes its row out of
 * notBuilt() (its own tests cover it from then on); the role rows stay until item 12.
 */
final class ContractTest extends ApiTestCase
{
    use SignsIn;

    /**
     * @return iterable<string, array{string, string, string, int}>
     */
    public static function endpoints(): iterable
    {
        yield 'GET /api/v1/users' => ['GET', '/api/v1/users', 'ROLE_MANAGE_USERS', 1];
        yield 'GET /api/v1/users/{id}' => ['GET', '/api/v1/users/1', 'ROLE_MANAGE_USERS', 1];
        yield 'POST /api/v1/users' => ['POST', '/api/v1/users', 'ROLE_MANAGE_USERS', 1];
        yield 'PUT /api/v1/users/{id}' => ['PUT', '/api/v1/users/1', 'ROLE_MANAGE_USERS', 1];
        yield 'GET /api/v1/warehouses' => ['GET', '/api/v1/warehouses', 'ROLE_USER', 2];
        yield 'PUT /api/v1/warehouses/{id}' => ['PUT', '/api/v1/warehouses/1', 'ROLE_USER', 2];
        yield 'GET /api/v1/warehouses/{id}/stock' => ['GET', '/api/v1/warehouses/1/stock', 'ROLE_MANAGE_INVENTORY', 2];
        yield 'POST /api/v1/warehouses/{from}/moves/{to}' => ['POST', '/api/v1/warehouses/1/moves/2', 'ROLE_MANAGE_INVENTORY', 2];
        yield 'POST /api/v1/warehouses/{id}/stock/add' => ['POST', '/api/v1/warehouses/1/stock/add', 'ROLE_MANAGE_INVENTORY', 2];
        yield 'POST /api/v1/warehouses/{id}/stock/remove' => ['POST', '/api/v1/warehouses/1/stock/remove', 'ROLE_MANAGE_INVENTORY', 2];
        yield 'POST /api/v1/warehouses/{id}/incoming/approve' => ['POST', '/api/v1/warehouses/1/incoming/approve', 'ROLE_MANAGE_INVENTORY', 2];
        yield 'GET /api/v1/products/by-code/{code}' => ['GET', '/api/v1/products/by-code/KF-01', 'ROLE_MANAGE_INVENTORY', 2];
        yield 'GET /api/v1/products/{uuid}' => ['GET', '/api/v1/products/00000000-0000-0000-0000-000000000000', 'ROLE_MANAGE_INVENTORY', 2];
        yield 'POST /api/v1/products' => ['POST', '/api/v1/products', 'ROLE_MANAGE_INVENTORY', 2];
        yield 'PUT /api/v1/products/{uuid}' => ['PUT', '/api/v1/products/00000000-0000-0000-0000-000000000000', 'ROLE_MANAGE_INVENTORY', 2];
        yield 'POST /api/v1/products/upload' => ['POST', '/api/v1/products/upload', 'ROLE_MANAGE_INVENTORY', 2];
        yield 'GET /api/v1/products/template.xls' => ['GET', '/api/v1/products/template.xls', 'ROLE_MANAGE_INVENTORY', 2];
        yield 'GET /api/v1/customers' => ['GET', '/api/v1/customers', 'ROLE_MANAGE_CUSTOMERS', 3];
        yield 'GET /api/v1/customers/all' => ['GET', '/api/v1/customers/all', 'ROLE_MANAGE_CUSTOMERS', 3];
        yield 'GET /api/v1/customers/{id}' => ['GET', '/api/v1/customers/1', 'ROLE_MANAGE_CUSTOMERS', 3];
        yield 'POST /api/v1/customers' => ['POST', '/api/v1/customers', 'ROLE_MANAGE_CUSTOMERS', 3];
        yield 'PUT /api/v1/customers/{id}' => ['PUT', '/api/v1/customers/1', 'ROLE_MANAGE_CUSTOMERS', 3];
        yield 'DELETE /api/v1/customers/{id}' => ['DELETE', '/api/v1/customers/1', 'ROLE_MANAGE_CUSTOMERS', 3];
        yield 'GET /api/v1/locations' => ['GET', '/api/v1/locations', 'ROLE_USER', 3];
        yield 'GET /api/v1/orders' => ['GET', '/api/v1/orders', 'ROLE_CAN_READ_ORDERS', 4];
        yield 'GET /api/v1/orders/{id}' => ['GET', '/api/v1/orders/1', 'ROLE_CAN_READ_ORDERS', 4];
        yield 'POST /api/v1/orders' => ['POST', '/api/v1/orders', 'ROLE_CAN_CREATE_ORDERS', 4];
        yield 'PUT /api/v1/orders/{id}' => ['PUT', '/api/v1/orders/1', 'ROLE_CAN_UPDATE_ORDERS', 4];
        yield 'POST /api/v1/orders/{id}/status' => ['POST', '/api/v1/orders/1/status', 'ROLE_UPDATE_ORDERS', 4];
        yield 'PUT /api/v1/orders/{id}/comments' => ['PUT', '/api/v1/orders/1/comments', 'ROLE_USER', 4];
        yield 'DELETE /api/v1/orders/{id}' => ['DELETE', '/api/v1/orders/1', 'ROLE_CAN_DELETE_ORDERS', 4];
        yield 'POST /api/v1/orders/sync' => ['POST', '/api/v1/orders/sync', 'ROLE_CAN_SYNC_ORDERS', 13];
        yield 'GET /api/v1/orders/{id}/partials' => ['GET', '/api/v1/orders/1/partials', 'ROLE_USER', 4];
        yield 'POST /api/v1/orders/{id}/partials' => ['POST', '/api/v1/orders/1/partials', 'ROLE_USER', 4];
        yield 'GET /api/v1/orders/{id}/pdf' => ['GET', '/api/v1/orders/1/pdf', 'ROLE_CAN_READ_ORDERS', 4];
        yield 'GET /api/v1/orders/{id}/remaining-pdf' => ['GET', '/api/v1/orders/1/remaining-pdf', 'ROLE_CAN_READ_ORDERS', 4];
        yield 'GET /api/v1/orders/{id}/xls' => ['GET', '/api/v1/orders/1/xls', 'ROLE_USER', 4];
        yield 'GET /api/v1/invoices' => ['GET', '/api/v1/invoices', 'ROLE_CAN_READ_INVOICES', 5];
        yield 'GET /api/v1/invoices/next-code' => ['GET', '/api/v1/invoices/next-code', 'ROLE_CAN_CREATE_INVOICES', 5];
        yield 'GET /api/v1/invoices/{id}' => ['GET', '/api/v1/invoices/1', 'ROLE_CAN_READ_INVOICES', 5];
        yield 'POST /api/v1/invoices' => ['POST', '/api/v1/invoices', 'ROLE_CAN_CREATE_INVOICES', 5];
        yield 'GET /api/v1/invoices/{id}/pdf' => ['GET', '/api/v1/invoices/1/pdf', 'ROLE_CAN_READ_INVOICES', 5];
    }

    #[DataProvider('endpoints')]
    public function testNobodySignedInIsUnauthorized(string $method, string $path, string $role, int $item): void
    {
        $this->sendJson($method, $path);

        $this->assertStatus(401, "{$method} {$path} (item {$item}) must ask for a signed-in user.");
    }

    #[DataProvider('endpoints')]
    public function testItAsksForTheRoleOfItsLegacyPage(string $method, string $path, string $role, int $item): void
    {
        if ('ROLE_USER' === $role) {
            self::markTestSkipped("{$method} {$path} is open to any signed-in user, as its legacy page was.");
        }
        $this->signInAs(['ROLE_USER']);

        $this->sendJson($method, $path);

        $this->assertStatus(403, "{$method} {$path} (item {$item}) needs {$role}.");
    }

    #[DataProvider('endpoints')]
    public function testANotYetBuiltEndpointAnswersNotImplemented(string $method, string $path, string $role, int $item): void
    {
        if (!\in_array("{$method} {$path}", self::notBuilt(), true)) {
            self::markTestSkipped("{$method} {$path} is built: its item's tests cover it.");
        }
        // Every account also holds ROLE_USER (the API, like the legacy /admin/ pages, asks for it first): the
        // ROLE_CAN_* roles and ROLE_MANAGE_CUSTOMERS do not reach it through the hierarchy.
        $this->signInAs(array_values(array_unique([$role, 'ROLE_USER'])));

        $body = $this->sendJson($method, $path);

        $this->assertStatus(501, "{$method} {$path} is item {$item}'s to build.");
        self::assertContains($body['error'] ?? null, ['not_implemented', 'order_sync_unavailable']);
    }

    /**
     * @return list<string>
     */
    private static function notBuilt(): array
    {
        return [
            'GET /api/v1/users',
            'GET /api/v1/users/1',
            'POST /api/v1/users',
            'PUT /api/v1/users/1',
            'GET /api/v1/warehouses',
            'PUT /api/v1/warehouses/1',
            'GET /api/v1/warehouses/1/stock',
            'POST /api/v1/warehouses/1/moves/2',
            'POST /api/v1/warehouses/1/stock/add',
            'POST /api/v1/warehouses/1/stock/remove',
            'POST /api/v1/warehouses/1/incoming/approve',
            'GET /api/v1/products/by-code/KF-01',
            'GET /api/v1/products/00000000-0000-0000-0000-000000000000',
            'POST /api/v1/products',
            'PUT /api/v1/products/00000000-0000-0000-0000-000000000000',
            'POST /api/v1/products/upload',
            'GET /api/v1/products/template.xls',
            'GET /api/v1/orders',
            'GET /api/v1/orders/1',
            'POST /api/v1/orders',
            'PUT /api/v1/orders/1',
            'POST /api/v1/orders/1/status',
            'PUT /api/v1/orders/1/comments',
            'DELETE /api/v1/orders/1',
            'POST /api/v1/orders/sync',
            'GET /api/v1/orders/1/partials',
            'POST /api/v1/orders/1/partials',
            'GET /api/v1/orders/1/pdf',
            'GET /api/v1/orders/1/remaining-pdf',
            'GET /api/v1/orders/1/xls',
            'GET /api/v1/invoices',
            'GET /api/v1/invoices/next-code',
            'GET /api/v1/invoices/1',
            'POST /api/v1/invoices',
            'GET /api/v1/invoices/1/pdf',
        ];
    }
}
