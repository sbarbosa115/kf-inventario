<?php

namespace App\DataFixtures;

use App\Inventory\Domain\Model\Warehouse;
use App\Ordering\Domain\Model\Comment;
use App\Ordering\Domain\Model\Order;
use App\Ordering\Domain\Model\ShopCapability;
use App\Ordering\Domain\Model\ShopConnection;
use App\Settings\Application\Port\SecretBox;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Common\DataFixtures\DependentFixtureInterface;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ObjectManager;

/**
 * shops-settings' seed (docs/pdr/prd-shops-settings.md, Decisions 17): one connection, "Fake shop", whose orders land
 * in Colombia and are printed, both capabilities on, its site the dev stack's fake shop (item 5a's
 * /_fake-shop route, reached from PHP as http://nginx; http is allowed only in dev); and W00003's comment made
 * dateless, as the comments written before the column existed are (the timeline shows the order's date, marked
 * approximate).
 */
class ShopFixtures extends Fixture implements DependentFixtureInterface
{
    /** The fake shop's webhook token, keys and secret: fixed, so the smoke specs can post to it and sign. */
    public const FAKE_SHOP_TOKEN = 'fakeshop0000000000000000000000000000000000000000000000000000001';
    public const FAKE_SHOP_KEY = 'ck_fake_shop';
    public const FAKE_SHOP_SECRET = 'cs_fake_shop';
    public const FAKE_SHOP_WEBHOOK_SECRET = 'fake-shop-webhook-secret';
    public const FAKE_SHOP_URL = 'http://nginx/_fake-shop';

    public function __construct(private readonly SecretBox $box)
    {
    }

    public function load(ObjectManager $manager): void
    {
        $connection = new ShopConnection(
            name: 'Fake shop',
            siteUrl: self::FAKE_SHOP_URL,
            sealedConsumerKey: $this->box->seal(self::FAKE_SHOP_KEY),
            sealedConsumerSecret: $this->box->seal(self::FAKE_SHOP_SECRET),
            webhookToken: self::FAKE_SHOP_TOKEN,
            sealedWebhookSecret: $this->box->seal(self::FAKE_SHOP_WEBHOOK_SECRET),
            warehouse: $this->getReference(WarehouseFixtures::WAREHOUSE_BOGOTA, Warehouse::class),
            emailPrinter: true,
            active: true,
            capabilities: [ShopCapability::OrderStatus->value => true, ShopCapability::OrderNote->value => true],
            at: new \DateTimeImmutable(),
        );
        $manager->persist($connection);
        $manager->flush();

        $order = $manager->getRepository(Order::class)->findOneBy(['code' => 'W00003']);
        $comment = null === $order ? null : $manager->getRepository(Comment::class)->findOneBy(['order' => $order]);
        if (null !== $comment && $manager instanceof EntityManagerInterface) {
            $manager->getConnection()->executeStatement('UPDATE comment SET created_at = NULL WHERE id = ?', [$comment->getId()]);
        }
    }

    public function getDependencies(): array
    {
        return [WarehouseFixtures::class, OrderFixtures::class];
    }
}
