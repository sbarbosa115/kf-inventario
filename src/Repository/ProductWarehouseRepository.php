<?php

namespace App\Repository;

use App\Entity\Order;
use App\Entity\ProductWarehouse;
use App\Entity\Warehouse;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Serializer\Normalizer\ObjectNormalizer;
use Symfony\Component\Serializer\Serializer;

/**
 * @method ProductWarehouse|null find($id, $lockMode = null, $lockVersion = null)
 * @method ProductWarehouse|null findOneBy(array $criteria, array $orderBy = null)
 * @method ProductWarehouse[]    findAll()
 * @method ProductWarehouse[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class ProductWarehouseRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ProductWarehouse::class);
    }

    public function findByWarehouse(Warehouse $warehouse, int $status): array
    {
        $products = $this->createQueryBuilder('pw')
            ->select('pw,w,p')
            ->innerJoin('pw.product', 'p')
            ->innerJoin('pw.warehouse', 'w', 'WITH', 'pw.warehouse = :warehouse')
            ->andWhere('pw.status = :status')
            ->setParameter('status', $status)
            ->setParameter('warehouse', $warehouse)
            ->orderBy('pw.product', 'ASC')
            ->getQuery()
            ->getArrayResult();

        foreach ($products as $key => $product) {
            $products[$key]['uuid'] = $product['product']['uuid'];
            $products[$key]['title'] = $product['product']['title'];
            $products[$key]['detail'] = $product['product']['detail'];
            $products[$key]['code'] = $product['product']['code'];
            $products[$key]['price'] = $product['product']['price'];
        }

        return $products;
    }

    /**
     * @return array|ProductWarehouse[]
     */
    public function getOrderProductsOnInventory(
        Order $order
    ): array {
        return $this->createQueryBuilder('pw')
            ->select('pw, p')
            ->innerJoin('pw.product', 'p')
            ->innerJoin('pw.warehouse', 'w')
            ->where('p.uuid in (:uuids)')
            ->andWhere('w.id = :warehouse')
            ->setParameter('uuids', $order->getOrderProductsUuids())
            ->setParameter('warehouse', $order->getWarehouse()->getId())
            ->getQuery()
            ->getResult();
    }

    public function getOrderProductsOnInventoryAsArray(Order $order): array
    {
        return $this->orderProductArray($this->getOrderProductsOnInventory($order));
    }

    public function orderProductArray(array $productWarehouse): array
    {
        $serializer = new Serializer([new ObjectNormalizer()]);

        return $serializer->normalize($productWarehouse, 'array', ['attributes' => [
            'id',
            'status',
            'quantity',
            'product' => ['id', 'uuid', 'code', 'title', 'detail'],
        ]]);
    }
}
