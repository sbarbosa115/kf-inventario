<?php

namespace App\Ordering\Infrastructure\WooCommerce;

use App\Customers\Domain\Model\CustomerAddress;
use App\Ordering\Application\Command\OrderAddress;
use App\Ordering\Application\Command\OrderCustomer;
use App\Ordering\Application\Command\OrderDetails;
use App\Ordering\Application\Command\OrderLine;
use App\Ordering\Application\Command\PlaceOrder;
use App\Ordering\Application\Port\ShopOrderMapper;
use App\Ordering\Domain\Model\Order;

/**
 * The legacy WooCommerceProvider::transformOrder: the customer from the billing details, its billing and shipping
 * addresses (cities, states and countries by name), the line items by SKU, and the shop's order id as the code; a
 * web order, paid by credit card, created, with no comment.
 */
final class WebhookOrderMapper implements ShopOrderMapper
{
    public function toPlaceOrder(array $shopOrder, int $warehouseId, bool $notifyPrinter): PlaceOrder
    {
        $billing = self::section($shopOrder, 'billing');
        $shipping = self::section($shopOrder, 'shipping');
        if (!isset($shopOrder['id']) || !\is_array($shopOrder['line_items'] ?? null)) {
            throw new \UnexpectedValueException('Not a WooCommerce order: no id or no line_items.');
        }

        $lines = [];
        foreach ($shopOrder['line_items'] as $item) {
            if (!\is_array($item)) {
                throw new \UnexpectedValueException('Not a WooCommerce order: a line item is not an object.');
            }
            $lines[] = new OrderLine(null, self::text($item, 'sku'), (int) ($item['quantity'] ?? 0));
        }

        $customer = new OrderCustomer(
            id: null,
            firstName: self::text($billing, 'first_name'),
            lastName: self::text($billing, 'last_name'),
            email: self::text($billing, 'email'),
            phone: self::text($billing, 'phone'),
            addresses: [self::address($billing, CustomerAddress::ADDRESS_BILLING), self::address($shipping, CustomerAddress::ADDRESS_SHIPPING)],
        );

        return new PlaceOrder(
            details: new OrderDetails(
                code: (string) self::text($shopOrder, 'id'),
                status: Order::STATUS_CREATED,
                source: Order::SOURCE_WEB,
                paymentMethod: Order::PAYMENT_CREDIT_CARD,
                comment: '',
                warehouseId: $warehouseId,
                customer: $customer,
                lines: $lines,
            ),
            notifyPrinter: $notifyPrinter,
        );
    }

    /**
     * @param array<mixed> $address
     */
    private static function address(array $address, int $type): OrderAddress
    {
        return new OrderAddress(
            address: self::text($address, 'address_1'),
            zipCode: self::text($address, 'postcode'),
            addressType: $type,
            cityId: null,
            cityName: self::text($address, 'city'),
            stateId: null,
            stateName: self::text($address, 'state'),
            countryId: null,
            countryName: self::text($address, 'country'),
        );
    }

    /**
     * @param array<mixed> $order
     *
     * @return array<mixed>
     */
    private static function section(array $order, string $key): array
    {
        if (!\is_array($order[$key] ?? null)) {
            throw new \UnexpectedValueException(\sprintf('Not a WooCommerce order: no %s details.', $key));
        }

        return $order[$key];
    }

    /**
     * @param array<mixed> $data
     */
    private static function text(array $data, string $key): ?string
    {
        $value = $data[$key] ?? null;

        return \is_scalar($value) ? (string) $value : null;
    }
}
