<?php

namespace App\DataProviders;

use App\Entity\CustomerAddress;
use App\Entity\Order;

class WooCommerceProvider
{

    public function transformProducts(array $products): array
    {
        $result = [];
        foreach ($products as $product) {
            $result[] = [
                'code' => $product->sku,
                'quantity' => $product->quantity,
            ];
        }

        return $result;
    }

    public function transformOrder(object $order): array
    {
        return [
            'customer' => [
                'email' => $order->billing->email,
                'firstName' => $order->billing->first_name,
                'lastName' => $order->billing->last_name,
                'phone' => $order->billing->phone,
                'addresses' => [
                    [
                        'addressType' => CustomerAddress::ADDRESS_BILLING,
                        'address' => $order->billing->address_1,
                        'zipCode' => $order->billing->postcode,
                        'city' => [
                            'name' => $order->billing->city,
                            'state' => [
                                'name' => $order->billing->state,
                                'country' => [
                                    'name' => $order->billing->country,
                                ],
                            ],
                        ],
                    ],
                    [
                        'addressType' => CustomerAddress::ADDRESS_SHIPPING,
                        'address' => $order->shipping->address_1,
                        'zipCode' => $order->shipping->postcode,
                        'city' => [
                            'name' => $order->shipping->city,
                            'state' => [
                                'name' => $order->shipping->state,
                                'country' => [
                                    'name' => $order->shipping->country,
                                ],
                            ],
                        ],
                    ],
                ],
            ],
            'source' => Order::SOURCE_WEB,
            'paymentMethod' => Order::PAYMENT_CREDIT_CARD,
            'status' => Order::STATUS_CREATED,
            'code' => $order->id,
            'comment' => '',
            'products' => $this->transformProducts($order->line_items),
        ];
    }
}
