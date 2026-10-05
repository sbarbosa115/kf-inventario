<?php

namespace App\Tests\Unit\Ordering;

use App\Inventory\Domain\Model\Product;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\OrderProduct;
use PHPUnit\Framework\TestCase;

/**
 * The partial-shipment maths of an order (the getting-ready screen and the remaining-products PDF read them).
 */
final class OrderTest extends TestCase
{
    public function testTheAggregateOfPartialsSumsEachProductOverEveryShipment(): void
    {
        [$a, $b, $c] = [self::product('A'), self::product('B'), self::product('C')];
        $order = self::order([[$a, 10], [$b, 20], [$c, 30]]);
        $order->addChild(self::order([[$a, 5], [$b, 10]]));
        $order->addChild(self::order([[$a, 2], [$c, 1]]));

        $aggregate = $order->getAggregatePartials();

        self::assertSame([
            ['quantity' => 7, 'uuid' => 'uuid-A', 'product' => ['code' => 'A']],
            ['quantity' => 10, 'uuid' => 'uuid-B', 'product' => ['code' => 'B']],
            ['quantity' => 1, 'uuid' => 'uuid-C', 'product' => ['code' => 'C']],
        ], $aggregate, 'Each product appears once, with what every partial shipped of it added up.');
    }

    public function testASentOrderCountsItsOwnProductsAsShipped(): void
    {
        $a = self::product('A');
        $order = self::order([[$a, 10]]);
        $order->addChild(self::order([[$a, 3]]));
        $order->setStatus(Order::STATUS_SENT);

        self::assertSame([['quantity' => 10, 'uuid' => 'uuid-A', 'product' => ['code' => 'A']]], $order->getAggregatePartials(), 'Sent in one go: the whole order left, whatever the partials said.');
        self::assertSame([['uuid' => 'uuid-A', 'quantity' => 0]], $order->getPendingOrderProductsQuantities());
    }

    public function testPendingIsWhatWasOrderedMinusWhatWasShipped(): void
    {
        [$a, $b, $c] = [self::product('A'), self::product('B'), self::product('C')];
        $order = self::order([[$a, 10], [$b, 20], [$c, 30]]);
        $order->addChild(self::order([[$a, 5], [$b, 10]]));

        self::assertSame([
            ['uuid' => 'uuid-A', 'quantity' => 5],
            ['uuid' => 'uuid-B', 'quantity' => 10],
            ['uuid' => 'uuid-C', 'quantity' => 30],
        ], $order->getPendingOrderProductsQuantities(), 'A product no partial shipped is still wholly pending.');
    }

    public function testShippingMoreThanWasOrderedIsAnError(): void
    {
        $a = self::product('A');
        $order = self::order([[$a, 10]]);
        $order->addChild(self::order([[$a, 6]]));
        $order->addChild(self::order([[$a, 6]]));

        $this->expectException(\InvalidArgumentException::class);

        $order->getPendingOrderProductsQuantities();
    }

    private static function product(string $code): Product
    {
        $product = new Product();
        $product->setCode($code);
        $product->setTitle($code);
        (new \ReflectionProperty(Product::class, 'uuid'))->setValue($product, 'uuid-'.$code);

        return $product;
    }

    /**
     * @param list<array{Product, int}> $lines
     */
    private static function order(array $lines): Order
    {
        $order = new Order();
        $order->setStatus(Order::STATUS_CREATED);
        foreach ($lines as [$product, $quantity]) {
            $line = new OrderProduct();
            $line->setProduct($product);
            $line->setQuantity($quantity);
            $order->addOrderProduct($line);
        }

        return $order;
    }
}
