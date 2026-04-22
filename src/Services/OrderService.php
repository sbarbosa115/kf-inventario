<?php

namespace App\Services;

use App\Entity\Comment;
use App\Entity\Order;
use App\Entity\OrderProduct;
use App\Entity\Product;
use App\Entity\ProductWarehouse;
use App\Entity\User;
use App\Entity\Warehouse;
use App\Repository\OrderRepository;
use App\Repository\ProductRepository;
use App\Repository\Utils\ProductUtils;
use App\Repository\WarehouseRepository;
use Doctrine\ORM\EntityManagerInterface;
use InvalidArgumentException;
use LogicException;
use Symfony\Component\Serializer\Exception\ExceptionInterface;
use Symfony\Component\Serializer\Normalizer\ObjectNormalizer;
use Symfony\Component\Serializer\Serializer;
use function array_key_exists;

class OrderService
{

    private EntityManagerInterface $objectManager;

    private WarehouseRepository $warehouseRepo;

    private CustomerService $customerService;

    private OrderRepository $orderRepo;

    private ProductRepository $productRepo;

    private ProductService $productService;

    public function __construct(
        EntityManagerInterface $objectManager,
        WarehouseRepository $warehouseRepo,
        ProductRepository $productRepository,
        CustomerService $customerService,
        ProductService $productService,
        OrderRepository $orderRepo
    ) {
        $this->objectManager = $objectManager;
        $this->productRepo = $productRepository;
        $this->warehouseRepo = $warehouseRepo;
        $this->customerService = $customerService;
        $this->productService = $productService;
        $this->orderRepo = $orderRepo;
    }

    private function setCustomerData(Order $order, array $orderData): void
    {
        $customer = $this->customerService->addOrUpdate($orderData['customer']);

        $warehouse = $this->warehouseRepo->find($orderData['warehouse']['id']);
        if (!$warehouse instanceof Warehouse) {
            throw new LogicException('Warehouse not found');
        }

        $order->setCustomer($customer);
        $order->setWarehouse($warehouse);
        $order->setCode($orderData['code']);
        $order->setSource($orderData['source']);
        $order->setStatus($orderData['status']);
        $order->setComment($orderData['comment']);
        $order->setPaymentMethod($orderData['paymentMethod']);
        $this->objectManager->persist($order);
    }

    private function createOrderProductFromArrayInput(
        Order $order,
        array $partialOrderData
    ): void {
        foreach ($partialOrderData as $partialProduct) {
            $product = $this->productRepo->findOneBy(ProductUtils::builtQueryByUuidOrCode($partialProduct));

            if (!$product instanceof Product) {
                throw new InvalidArgumentException('The given product was not found');
            }

            $orderProduct = new OrderProduct();
            $orderProduct->setOrder($order);
            $orderProduct->setProduct($product);
            $orderProduct->setQuantity($partialProduct['quantity']);
            $order->addOrderProduct($orderProduct);

            $this->objectManager->persist($orderProduct);
        }

        $this->objectManager->persist($order);
        $this->objectManager->flush();
    }

    /**
     * @throws InvalidArgumentException
     */
    private function syncProducts(Order $order, array $orderProductsData): void
    {
        /** @var $orderProduct OrderProduct */
        foreach ($order->getProducts() as $orderProduct) {
            $this->objectManager->remove($orderProduct);
        }
        $this->objectManager->flush();

        $this->createOrderProductFromArrayInput($order, $orderProductsData);

        $this->objectManager->persist($order);
        $this->objectManager->flush();
    }

    private function attachComments(Order $order, User $user, array $comments): void
    {
        foreach ($comments as $commentItem) {
            $comment = new Comment();
            $comment->setContent($commentItem['content']);
            $comment->setUser($user);
            $comment->setOrder($order);
            $order->addComment($comment);
            $this->objectManager->persist($comment);
            $this->objectManager->persist($order);
        }
    }

    /**
     * @throws ExceptionInterface
     */
    public function getOrderAsArray(Order $order): array
    {
        $serializer = new Serializer([new ObjectNormalizer()]);

        return $serializer->normalize($order, 'array', ['attributes' => [
            'id',
            'code',
            'status',
            'source',
            'createdAtAsString',
            'paymentMethod',
            'comment',
            'warehouse' => ['id', 'name'],
            'customer' => ['email', 'firstName', 'lastName', 'phone', 'addresses' => [
                'id', 'address', 'zipCode', 'city' => [
                    'id', 'name', 'state' => [
                        'id', 'name', 'country' => [
                            'id', 'name',
                        ],
                    ],
                ],
            ]],
            'comments' => ['id', 'content'],
            'products' => ['quantity', 'uuid', 'product' => [
                'title', 'detail', 'code',
            ]],
        ]]);
    }

    /**
     * @throws ExceptionInterface
     */
    public function add(array $orderData, User $user = null): array
    {
        $order = new Order();
        $this->setCustomerData($order, $orderData);

        if (!array_key_exists('products', $orderData)) {
            throw new LogicException('The order must have products.');
        }

        $this->syncProducts($order, $orderData['products']);

        if (array_key_exists('comments', $orderData) && $user) {
            $this->attachComments($order, $user, $orderData['comments']);
        }

        $this->objectManager->flush();

        return $this->getOrderAsArray($order);
    }

    /**
     * @throws ExceptionInterface
     */
    public function update(Order $order, array $newOrderData): array
    {
        $this->setCustomerData($order, $newOrderData);
        $this->syncProducts($order, $newOrderData['products']);

        return $this->getOrderAsArray($order);
    }

    public function deleteOrder(Order $order): void
    {
        foreach ($order->getOrderProducts() as $orderProduct) {
            $this->objectManager->remove($orderProduct);
        }

        foreach ($order->getComments() as $comment) {
            $this->objectManager->remove($comment);
        }

        $this->objectManager->remove($order);
        $this->objectManager->flush();
    }

    public function deleteOrderById(int $orderId): void
    {
        $order = $this->orderRepo->find($orderId);

        if (!$order instanceof Order) {
            throw new InvalidArgumentException('The order does not exist on the database.');
        }

        $this->deleteOrder($order);
    }

    public function hasInventoryTheOrderRequiredProducts(Order $order): bool
    {
        $orderProducts = $order->getProducts();
        $inventoryProducts = $this->objectManager->getRepository(ProductWarehouse::class)
            ->getOrderProductsOnInventory($order);

        foreach ($orderProducts as $orderProduct) {
            foreach ($inventoryProducts as $inventoryProduct) {
                if (
                    $orderProduct->getProduct() === $inventoryProduct->getProduct()
                    && $orderProduct->getQuantity() > $inventoryProduct->getQuantity()
                ) {
                    return false;
                }
            }
        }

        return true;
    }

    public function hasPartialOrderSameAmountOfProductsThatOriginal(
        Order $order,
        array $partialOrder
    ): bool {
        $orderProducts = $order->getProducts();

        foreach ($orderProducts as $orderProduct) {
            $orderProductKey = array_search($orderProduct->getUuid(), array_column($partialOrder, 'uuid'), true);

            if (false !== $orderProductKey && (int) $partialOrder[$orderProductKey]['quantity'] !== $orderProduct->getQuantity()) {
                return false;
            }

            if (false === $orderProductKey) {
                return false;
            }
        }

        return true;
    }

    public function createPartial(Order $order, array $partialOrderData): void
    {
        if (
            $this->hasInventoryTheOrderRequiredProducts($order)
            && $this->hasPartialOrderSameAmountOfProductsThatOriginal($order, $partialOrderData)
        ) {
            $order->setStatus(Order::STATUS_SENT);
            $this->productService->crossOrderAgainstInventory($order);
            $this->objectManager->persist($order);
        } else {
            $children = new Order();
            $children->setParent($order);
            $this->createOrderProductFromArrayInput($children, $partialOrderData);
            $order->setStatus(Order::STATUS_PARTIAL);
            $this->productService->crossOrderAgainstInventory($children, $order->getWarehouse());
            $this->objectManager->persist($children);
        }

        $this->objectManager->flush();
    }
}
