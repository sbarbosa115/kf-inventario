<?php

namespace App\Ordering\UI\Http;

use App\Customers\Domain\Model\Customer;
use App\Customers\Domain\Model\CustomerAddress;
use App\Customers\UI\Http\Output\AddressOutput;
use App\Customers\UI\Http\Output\CityRefOutput;
use App\Customers\UI\Http\Output\CountryRefOutput;
use App\Customers\UI\Http\Output\CustomerOutput;
use App\Customers\UI\Http\Output\CustomerRefOutput;
use App\Customers\UI\Http\Output\StateRefOutput;
use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\Domain\Model\Warehouse;
use App\Inventory\UI\Http\Output\StockOutput;
use App\Inventory\UI\Http\Output\WarehouseRefOutput;
use App\Ordering\Domain\Model\Comment;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\OrderProduct;
use App\Ordering\UI\Http\Output\OrderCommentOutput;
use App\Ordering\UI\Http\Output\OrderDetailOutput;
use App\Ordering\UI\Http\Output\OrderLineOutput;
use App\Ordering\UI\Http\Output\OrderLineProductOutput;
use App\Ordering\UI\Http\Output\OrderOutput;
use App\Ordering\UI\Http\Output\OrderPartialsOutput;
use App\Ordering\UI\Http\Output\PartialLineOutput;
use App\Ordering\UI\Http\Output\PartialLineProductOutput;
use App\Ordering\UI\Http\Output\PendingLineOutput;

/**
 * Orders as the API answers them (the Output DTOs of the route map).
 */
final class OrderPresenter
{
    public function order(Order $order): OrderOutput
    {
        $customer = $order->getCustomer();

        return new OrderOutput(
            id: (int) $order->getId(),
            code: $order->getCode(),
            status: (int) $order->getStatus(),
            source: (int) $order->getSource(),
            paymentMethod: $order->getPaymentMethod(),
            comment: $order->getComment(),
            createdAt: $order->getCreatedAt()?->format(\DATE_ATOM),
            warehouse: self::warehouse($order->getWarehouse()),
            customer: null === $customer ? null : new CustomerRefOutput((int) $customer->getId(), $customer->getFirstName(), $customer->getLastName(), $customer->getEmail(), $customer->getPhone()),
            commentsCount: $order->getComments()->count(),
        );
    }

    public function detail(Order $order): OrderDetailOutput
    {
        return new OrderDetailOutput(
            id: (int) $order->getId(),
            code: $order->getCode(),
            status: (int) $order->getStatus(),
            source: (int) $order->getSource(),
            paymentMethod: $order->getPaymentMethod(),
            comment: $order->getComment(),
            createdAt: $order->getCreatedAt()?->format(\DATE_ATOM),
            warehouse: self::warehouse($order->getWarehouse()),
            customer: self::customer($order->getCustomer()),
            comments: $this->comments($order),
            products: self::lines($order),
        );
    }

    /**
     * @return list<OrderCommentOutput>
     */
    public function comments(Order $order): array
    {
        return array_map(static fn (Comment $comment) => new OrderCommentOutput((int) $comment->getId(), $comment->getContent()), $order->getComments()->getValues());
    }

    /**
     * @param array{order: Order, aggregate: list<array{quantity: int|null, uuid: string, product: array{code: string}}>, pending: list<array{uuid: string, quantity: int}>, inventory: list<ProductWarehouse>} $partials
     */
    public function partials(array $partials): OrderPartialsOutput
    {
        return new OrderPartialsOutput(
            orderId: (int) $partials['order']->getId(),
            code: $partials['order']->getCode(),
            status: (int) $partials['order']->getStatus(),
            products: self::lines($partials['order']),
            productsAggregate: array_map(static fn (array $line) => new PartialLineOutput($line['uuid'], (int) $line['quantity'], new PartialLineProductOutput($line['product']['code'])), $partials['aggregate']),
            pending: array_map(static fn (array $line) => new PendingLineOutput($line['uuid'], $line['quantity']), $partials['pending']),
            inventory: array_map(static fn (ProductWarehouse $row) => new StockOutput(
                id: (int) $row->getId(),
                status: (int) $row->getStatus(),
                quantity: (int) $row->getQuantity(),
                productId: (int) $row->getProduct()?->getId(),
                uuid: (string) $row->getProduct()?->getUuid(),
                code: (string) $row->getProduct()?->getCode(),
                title: (string) $row->getProduct()?->getTitle(),
                detail: $row->getProduct()?->getDetail(),
                price: $row->getProduct()?->getPrice(),
                warehouse: new WarehouseRefOutput((int) $row->getWarehouse()?->getId(), (string) $row->getWarehouse()?->getName()),
            ), $partials['inventory']),
        );
    }

    /**
     * @return list<OrderLineOutput>
     */
    private static function lines(Order $order): array
    {
        return array_map(static fn (OrderProduct $line) => new OrderLineOutput(
            $line->getUuid(),
            (int) $line->getQuantity(),
            new OrderLineProductOutput((string) $line->getProduct()?->getCode(), (string) $line->getProduct()?->getTitle(), $line->getProduct()?->getDetail()),
        ), $order->getOrderProducts()->getValues());
    }

    private static function warehouse(?Warehouse $warehouse): ?WarehouseRefOutput
    {
        return null === $warehouse ? null : new WarehouseRefOutput((int) $warehouse->getId(), (string) $warehouse->getName());
    }

    private static function customer(?Customer $customer): ?CustomerOutput
    {
        if (null === $customer) {
            return null;
        }

        return new CustomerOutput(
            (int) $customer->getId(),
            $customer->getFirstName(),
            $customer->getLastName(),
            $customer->getEmail(),
            $customer->getPhone(),
            array_map(static function (CustomerAddress $address): AddressOutput {
                $city = $address->getCity();
                $state = $city?->getState();
                $country = $state?->getCountry();

                return new AddressOutput(
                    (int) $address->getId(),
                    $address->getAddress(),
                    $address->getZipCode(),
                    $address->getAddressType(),
                    null === $city || null === $state || null === $country ? null : new CityRefOutput(
                        (int) $city->getId(),
                        (string) $city->getName(),
                        new StateRefOutput((int) $state->getId(), (string) $state->getName(), $state->getCode(), new CountryRefOutput((int) $country->getId(), (string) $country->getName(), $country->getCode())),
                    ),
                );
            }, $customer->getAddresses()->getValues()),
        );
    }
}
