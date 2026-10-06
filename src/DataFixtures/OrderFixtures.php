<?php

namespace App\DataFixtures;

use App\Entity\Comment;
use App\Entity\Order;
use App\Entity\OrderProduct;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\Persistence\ObjectManager;

class OrderFixtures extends Fixture implements DependentFixtureInterface
{
    public function load(ObjectManager $manager): void
    {
        $this->createOrder($manager);
    }

    protected function createOrder(ObjectManager $manager): void
    {
        $items = [
            [
                'code' => 'W00001',
                'source' => Order::SOURCE_PHONE,
                'status' => Order::STATUS_CREATED,
                'quantity' => 10,
            ],
            [
                'code' => 'W00002',
                'source' => Order::SOURCE_PHONE,
                'status' => Order::STATUS_PROCESSED,
                'quantity' => 15,
            ],
            [
                'code' => 'W00003',
                'source' => Order::SOURCE_PHONE,
                'status' => Order::STATUS_COMPLETED,
                'quantity' => 20,
            ],
            [
                'code' => 'W00004',
                'source' => Order::SOURCE_PHONE,
                'status' => Order::STATUS_PARTIAL,
                'quantity' => 25,
            ],
            [
                'code' => 'W00005',
                'source' => Order::SOURCE_PHONE,
                'status' => Order::STATUS_SENT,
                'quantity' => 30,
            ],
            [
                'code' => 'W00006',
                'source' => Order::SOURCE_PHONE,
                'status' => Order::STATUS_DELIVERED,
                'quantity' => 35,
            ],
            [
                'code' => 'W00007',
                'source' => Order::SOURCE_WEB,
                'status' => Order::STATUS_CREATED,
                'quantity' => 25,
            ],
            [
                'code' => 'W00008',
                'source' => Order::SOURCE_WEB,
                'status' => Order::STATUS_PROCESSED,
                'quantity' => 30,
            ],
            [
                'code' => 'W00009',
                'source' => Order::SOURCE_WEB,
                'status' => Order::STATUS_COMPLETED,
                'quantity' => 35,
            ],
            [
                'code' => 'W00010',
                'source' => Order::SOURCE_WEB,
                'status' => Order::STATUS_PARTIAL,
                'quantity' => 40,
            ],
            [
                'code' => 'W00011',
                'source' => Order::SOURCE_WEB,
                'status' => Order::STATUS_SENT,
                'quantity' => 45,
            ],
            [
                'code' => 'W00012',
                'source' => Order::SOURCE_WEB,
                'status' => Order::STATUS_DELIVERED,
                'quantity' => 50,
            ],
        ];

        foreach ($items as $item) {
            $order = new Order();
            $order->setCode($item['code']);
            $order->setStatus($item['status']);
            $order->setSource($item['source']);
            $order->setCustomer($this->getReference(CustomerFixtures::CUSTOMER));
            $order->setWarehouse($this->getReference(WarehouseFixtures::WAREHOUSE_BOGOTA));
            $manager->persist($order);

            $comment = new Comment();
            $comment->setOrder($order);
            $comment->setContent("Comment for {$item['code']}");
            $comment->setUser($this->getReference(UserFixtures::DEFAULT_USER));
            $manager->persist($comment);

            /** Attaching products to this order */
            $orderProduct = new OrderProduct();
            $orderProduct->setOrder($order);
            $orderProduct->setProduct($this->getReference(ProductFixtures::PRODUCT_KF_01));
            $orderProduct->setQuantity($item['quantity']);
            $manager->persist($orderProduct);

            /** Attaching products to this order */
            $orderProduct2 = new OrderProduct();
            $orderProduct2->setOrder($order);
            $orderProduct2->setProduct($this->getReference(ProductFixtures::PRODUCT_KF_02));
            $orderProduct2->setQuantity($item['quantity']);
            $manager->persist($orderProduct2);

            /** Attaching products to this order */
            $orderProduct3 = new OrderProduct();
            $orderProduct3->setOrder($order);
            $orderProduct3->setProduct($this->getReference(ProductFixtures::PRODUCT_KF_03));
            $orderProduct3->setQuantity($item['quantity']);
            $manager->persist($orderProduct3);
        }
        $manager->flush();
    }

    public function getDependencies(): array
    {
        return [
            CustomerFixtures::class,
            WarehouseFixtures::class,
            ProductFixtures::class,
            UserFixtures::class,
        ];
    }
}
