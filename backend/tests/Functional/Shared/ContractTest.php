<?php

namespace App\Tests\Functional\Shared;

use App\Tests\Support\ApiTestCase;
use App\Tests\Support\SignsIn;
use PHPUnit\Framework\Attributes\DataProvider;

/**
 * The API contract (docs/pdr/prd-restructure.md, the route map; docs/pdr/prd-shops-settings.md, "API changes"): every
 * endpoint exists, asks for the role its legacy page asked for (Settings and shops: ROLE_ADMIN), and answers 501 until
 * its item builds it. An item that builds an endpoint takes its row out of notBuilt() (its own tests cover it from
 * then on); the role rows stay. The item column names the restructure's item (a number) or shops-settings' ("ss-5a").
 */
final class ContractTest extends ApiTestCase
{
    use SignsIn;

    /**
     * The role column: the role the endpoint asks for, or several separated by "|" when any one of them opens it.
     *
     * @return iterable<string, array{string, string, string, int|string}>
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
        // The legacy order (new, edit) and new-invoice pages embedded every customer: their roles read the pickers' list.
        yield 'GET /api/v1/customers/all' => ['GET', '/api/v1/customers/all', 'ROLE_MANAGE_CUSTOMERS|ROLE_CAN_CREATE_ORDERS|ROLE_CAN_UPDATE_ORDERS|ROLE_CAN_CREATE_INVOICES', 3];
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

        // shops-settings: Settings (item 3; GET /settings/public, GET /settings/email and /settings/webhooks are item
        // 0's, for the General tab and the analytics loader).
        yield 'GET /api/v1/settings/public' => ['GET', '/api/v1/settings/public', 'ROLE_USER', 'ss-0'];
        yield 'GET /api/v1/settings/email' => ['GET', '/api/v1/settings/email', 'ROLE_ADMIN', 'ss-0'];
        yield 'PUT /api/v1/settings/email' => ['PUT', '/api/v1/settings/email', 'ROLE_ADMIN', 'ss-3'];
        yield 'POST /api/v1/settings/email/test' => ['POST', '/api/v1/settings/email/test', 'ROLE_ADMIN', 'ss-3'];
        yield 'GET /api/v1/settings/analytics' => ['GET', '/api/v1/settings/analytics', 'ROLE_ADMIN', 'ss-3'];
        yield 'PUT /api/v1/settings/analytics' => ['PUT', '/api/v1/settings/analytics', 'ROLE_ADMIN', 'ss-3'];
        yield 'GET /api/v1/settings/webhooks' => ['GET', '/api/v1/settings/webhooks', 'ROLE_ADMIN', 'ss-0'];
        yield 'PUT /api/v1/settings/webhooks' => ['PUT', '/api/v1/settings/webhooks', 'ROLE_ADMIN', 'ss-0'];
        yield 'GET /api/v1/settings/quick-phrases' => ['GET', '/api/v1/settings/quick-phrases', 'ROLE_USER', 'ss-3'];
        yield 'POST /api/v1/settings/quick-phrases' => ['POST', '/api/v1/settings/quick-phrases', 'ROLE_ADMIN', 'ss-3'];
        yield 'PUT /api/v1/settings/quick-phrases/order' => ['PUT', '/api/v1/settings/quick-phrases/order', 'ROLE_ADMIN', 'ss-3'];
        yield 'PUT /api/v1/settings/quick-phrases/{id}' => ['PUT', '/api/v1/settings/quick-phrases/1', 'ROLE_ADMIN', 'ss-3'];
        yield 'DELETE /api/v1/settings/quick-phrases/{id}' => ['DELETE', '/api/v1/settings/quick-phrases/1', 'ROLE_ADMIN', 'ss-3'];
        // shops-settings: shop connections (item 5a; the outbox 5b).
        yield 'GET /api/v1/shops' => ['GET', '/api/v1/shops', 'ROLE_ADMIN', 'ss-5a'];
        yield 'GET /api/v1/shops/{id}' => ['GET', '/api/v1/shops/1', 'ROLE_ADMIN', 'ss-5a'];
        yield 'POST /api/v1/shops' => ['POST', '/api/v1/shops', 'ROLE_ADMIN', 'ss-5a'];
        yield 'PUT /api/v1/shops/{id}' => ['PUT', '/api/v1/shops/1', 'ROLE_ADMIN', 'ss-5a'];
        yield 'DELETE /api/v1/shops/{id}' => ['DELETE', '/api/v1/shops/1', 'ROLE_ADMIN', 'ss-5a'];
        yield 'GET /api/v1/shops/{id}/webhook-secret' => ['GET', '/api/v1/shops/1/webhook-secret', 'ROLE_ADMIN', 'ss-5a'];
        yield 'POST /api/v1/shops/{id}/webhook-secret' => ['POST', '/api/v1/shops/1/webhook-secret', 'ROLE_ADMIN', 'ss-5a'];
        yield 'POST /api/v1/shops/{id}/test' => ['POST', '/api/v1/shops/1/test', 'ROLE_ADMIN', 'ss-5a'];
        yield 'GET /api/v1/shops/{id}/deliveries' => ['GET', '/api/v1/shops/1/deliveries', 'ROLE_ADMIN', 'ss-5a'];
        yield 'GET /api/v1/shops/{id}/deliveries/{dId}' => ['GET', '/api/v1/shops/1/deliveries/1', 'ROLE_ADMIN', 'ss-5a'];
        yield 'POST /api/v1/shops/{id}/deliveries/{dId}/retry' => ['POST', '/api/v1/shops/1/deliveries/1/retry', 'ROLE_ADMIN', 'ss-5a'];
        yield 'POST /api/v1/shops/{id}/deliveries/{dId}/discard' => ['POST', '/api/v1/shops/1/deliveries/1/discard', 'ROLE_ADMIN', 'ss-5a'];
        yield 'GET /api/v1/shops/{id}/outbox' => ['GET', '/api/v1/shops/1/outbox', 'ROLE_ADMIN', 'ss-5b'];
        yield 'POST /api/v1/shops/{id}/outbox/{oId}/retry' => ['POST', '/api/v1/shops/1/outbox/1/retry', 'ROLE_ADMIN', 'ss-5b'];
        // shops-settings: the comment timeline (item 7); PUT /orders/{id}/comments stays (above).
        yield 'GET /api/v1/orders/{id}/comments' => ['GET', '/api/v1/orders/1/comments', 'ROLE_CAN_READ_ORDERS', 'ss-7'];
        yield 'POST /api/v1/orders/{id}/comments' => ['POST', '/api/v1/orders/1/comments', 'ROLE_USER', 'ss-7'];
        yield 'POST /api/v1/orders/{id}/comments/{cId}/pin' => ['POST', '/api/v1/orders/1/comments/1/pin', 'ROLE_USER', 'ss-7'];
        yield 'DELETE /api/v1/orders/{id}/comments/{cId}/pin' => ['DELETE', '/api/v1/orders/1/comments/1/pin', 'ROLE_USER', 'ss-7'];
    }

    /**
     * The per-connection webhook (docs/pdr/prd-shops-settings.md, "Shop connections") is public — WooCommerce posts
     * it, no sign-in — and an unknown token is not found (item 5a; ShopWebhookApiTest covers the rest).
     */
    public function testTheShopWebhookIsPublic(): void
    {
        foreach (['POST', 'GET'] as $method) {
            $this->client->request($method, '/webhooks/shops/'.str_repeat('ab', 32), server: ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'], content: '{}');

            $this->assertStatus(404, "{$method} /webhooks/shops/{token} is public (no sign-in): an unknown token is not found.");
        }
    }

    #[DataProvider('endpoints')]
    public function testNobodySignedInIsUnauthorized(string $method, string $path, string $role, int|string $item): void
    {
        $this->sendJson($method, $path);

        $this->assertStatus(401, "{$method} {$path} (item {$item}) must ask for a signed-in user.");
    }

    #[DataProvider('endpoints')]
    public function testItAsksForTheRoleOfItsLegacyPage(string $method, string $path, string $role, int|string $item): void
    {
        if ('ROLE_USER' === $role) {
            self::markTestSkipped("{$method} {$path} is open to any signed-in user, as its legacy page was.");
        }
        $this->signInAs(['ROLE_USER']);

        $this->sendJson($method, $path);

        $this->assertStatus(403, "{$method} {$path} (item {$item}) needs {$role}.");
    }

    #[DataProvider('endpoints')]
    public function testANotYetBuiltEndpointAnswersNotImplemented(string $method, string $path, string $role, int|string $item): void
    {
        if (!\in_array("{$method} {$path}", self::notBuilt(), true)) {
            self::markTestSkipped("{$method} {$path} is built: its item's tests cover it.");
        }
        // Every account also holds ROLE_USER (the API, like the legacy /admin/ pages, asks for it first): the
        // ROLE_CAN_* roles and ROLE_MANAGE_CUSTOMERS do not reach it through the hierarchy.
        $this->signInAs(array_values(array_unique([...explode('|', $role), 'ROLE_USER'])));

        $body = $this->sendJson($method, $path);

        $this->assertStatus(501, "{$method} {$path} is item {$item}'s to build.");
        self::assertContains($body['error'] ?? null, ['not_implemented', 'order_sync_unavailable']);
    }

    /**
     * @return list<string>
     */
    private static function notBuilt(): array
    {
        return [];
    }
}
