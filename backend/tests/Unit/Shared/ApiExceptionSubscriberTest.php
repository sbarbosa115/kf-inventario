<?php

namespace App\Tests\Unit\Shared;

use App\Customers\Domain\Error\CustomerNotFound;
use App\Identity\Domain\Error\UserNotFound;
use App\Inventory\Domain\Error\ProductNotFound;
use App\Inventory\Domain\Error\StockNotFound;
use App\Inventory\Domain\Error\WarehouseNotFound;
use App\Invoicing\Domain\Error\InvoiceNotFound;
use App\Ordering\Domain\Error\OrderNotFound;
use App\Shared\Domain\Error\Conflict;
use App\Shared\Domain\Error\DomainError;
use App\Shared\Domain\Error\Refused;
use App\Shared\UI\Http\ApiExceptionSubscriber;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\HttpKernelInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

final class ApiExceptionSubscriberTest extends TestCase
{
    /**
     * @return iterable<string, array{DomainError, int, string}>
     */
    public static function errors(): iterable
    {
        yield 'user' => [new UserNotFound(), 404, 'user_not_found'];
        yield 'product' => [new ProductNotFound(), 404, 'product_not_found'];
        yield 'warehouse' => [new WarehouseNotFound(), 404, 'warehouse_not_found'];
        yield 'stock' => [new StockNotFound(), 404, 'stock_not_found'];
        yield 'customer' => [new CustomerNotFound(), 404, 'customer_not_found'];
        yield 'order' => [new OrderNotFound(), 404, 'order_not_found'];
        yield 'invoice' => [new InvoiceNotFound(), 404, 'invoice_not_found'];
        yield 'a conflict' => [new class('same_warehouse', 'Same warehouse.') extends Conflict {}, 409, 'same_warehouse'];
        yield 'a refusal' => [new class('insufficient_stock', 'Not enough.') extends Refused {}, 422, 'insufficient_stock'];
    }

    #[DataProvider('errors')]
    public function testADomainErrorBecomesItsStatusAndCode(DomainError $error, int $status, string $code): void
    {
        $event = $this->handle('/api/v1/anything', $error);

        $response = $event->getResponse();
        self::assertNotNull($response, 'Every DomainError on /api is answered in the API error shape.');
        self::assertSame($status, $response->getStatusCode());
        self::assertSame($code, json_decode((string) $response->getContent(), true)['error']);
    }

    public function testPagesOutsideTheApiKeepTheirOwnErrorPage(): void
    {
        $event = $this->handle('/admin/product/', new ProductNotFound());

        self::assertNull($event->getResponse(), 'The legacy Twig pages are not answered as JSON.');
    }

    private function handle(string $path, \Throwable $error): ExceptionEvent
    {
        $translator = $this->createStub(TranslatorInterface::class);
        $event = new ExceptionEvent($this->createStub(HttpKernelInterface::class), Request::create($path), HttpKernelInterface::MAIN_REQUEST, $error);
        (new ApiExceptionSubscriber(false, $translator))->onException($event);

        return $event;
    }
}
