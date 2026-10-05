<?php

namespace App\Tests\Functional\Ordering;

use App\Customers\Domain\Model\City;
use App\Customers\Domain\Model\Country;
use App\Customers\Domain\Model\Customer;
use App\Customers\Domain\Model\CustomerAddress;
use App\Customers\Domain\Model\State;
use App\Inventory\Domain\Model\Product;
use App\Inventory\Domain\Model\ProductWarehouse;
use App\Inventory\Domain\Model\Warehouse;
use App\Ordering\Domain\Model\Order;
use App\Tests\Support\ApiTestCase;

/**
 * The records an order needs (a warehouse, products with stock in it, a customer with an address) and the API
 * payload of an order, as the order form sends it.
 *
 * @phpstan-require-extends ApiTestCase
 */
trait OrderingFixtures
{
    /**
     * @param list<string> $urls the shop addresses whose WooCommerce webhooks this warehouse receives
     */
    protected function aWarehouse(string $name = 'Usa', array $urls = []): Warehouse
    {
        $warehouse = new Warehouse($name, $urls);
        $this->em()->persist($warehouse);
        $this->em()->flush();

        return $warehouse;
    }

    /**
     * A product, with that much confirmed stock in the warehouse when one is given.
     */
    protected function aProduct(string $code, ?Warehouse $warehouse = null, int $stock = 100): Product
    {
        $product = new Product();
        $product->setCode($code);
        $product->setTitle('Title '.$code);
        $product->setDetail('Detail '.$code);
        $product->setStatus(Product::STATUS_ACTIVE);
        $product->setPrice(10.0);
        $this->em()->persist($product);

        if (null !== $warehouse) {
            $row = new ProductWarehouse();
            $row->setProduct($product);
            // The warehouse may come from before a request (the client reboots the kernel, and its entity manager).
            $row->setWarehouse($this->em()->getReference(Warehouse::class, $warehouse->getId()));
            $row->setQuantity($stock);
            $row->setStatus(ProductWarehouse::STATUS_CONFIRMED);
            $this->em()->persist($row);
        }
        $this->em()->flush();

        return $product;
    }

    protected function aCustomer(string $email = 'jose.perez@example.com'): Customer
    {
        $country = new Country();
        $country->setName('Colombia');
        $state = new State();
        $state->setName('Cundinamarca');
        $state->setCountry($country);
        $city = new City();
        $city->setName('Bogota');
        $city->setState($state);
        $address = new CustomerAddress();
        $address->setAddress('Calle 1 # 2-3');
        $address->setZipCode('110111');
        $address->setAddressType(CustomerAddress::ADDRESS_BILLING);
        $address->setCity($city);

        $customer = new Customer();
        $customer->setFirstName('Jose');
        $customer->setLastName('Perez');
        $customer->setEmail($email);
        $customer->setPhone('3001234567');
        $customer->addAddress($address);
        foreach ([$country, $state, $city, $customer] as $entity) {
            $this->em()->persist($entity);
        }
        $this->em()->flush();

        return $customer;
    }

    protected function stockOf(Product $product, Warehouse $warehouse): int
    {
        $this->em()->clear();
        $row = $this->em()->getRepository(ProductWarehouse::class)->findOneBy(['product' => $product->getId(), 'warehouse' => $warehouse->getId()]);

        return (int) $row?->getQuantity();
    }

    /**
     * @param list<array{Product, int}> $lines
     * @param array<string, mixed>      $overrides
     *
     * @return array<string, mixed>
     */
    protected function orderPayload(Warehouse $warehouse, Customer $customer, array $lines, array $overrides = []): array
    {
        return $overrides + [
            'code' => 'KF-ORDER-01',
            'status' => Order::STATUS_CREATED,
            'source' => Order::SOURCE_PHONE,
            'payment_method' => Order::PAYMENT_CREDIT_CARD,
            'comment' => 'Leave it at the door',
            'warehouse_id' => $warehouse->getId(),
            'customer' => ['id' => $customer->getId(), 'first_name' => 'Jose', 'last_name' => 'Perez', 'email' => $customer->getEmail(), 'phone' => '3001234567', 'addresses' => [
                ['address' => 'Calle 1 # 2-3', 'zip_code' => '110111', 'address_type' => CustomerAddress::ADDRESS_BILLING, 'city' => ['name' => 'Bogota', 'state' => ['name' => 'Cundinamarca', 'country' => ['name' => 'Colombia']]]],
            ]],
            'products' => array_map(static fn (array $line) => ['uuid' => $line[0]->getUuid(), 'quantity' => $line[1]], $lines),
            'comments' => [['content' => 'First comment'], ['content' => 'Second comment']],
        ];
    }

    /**
     * Places an order through the API and answers its id.
     *
     * @param list<array{Product, int}> $lines
     * @param array<string, mixed>      $overrides
     */
    protected function placeOrder(Warehouse $warehouse, Customer $customer, array $lines, array $overrides = []): int
    {
        $order = $this->sendJson('POST', '/api/v1/orders', $this->orderPayload($warehouse, $customer, $lines, $overrides));
        $this->assertStatus(201, 'Placing the order.');

        return $order['id'];
    }
}
