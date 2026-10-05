<?php

namespace App\DataFixtures;

use App\Identity\Domain\Model\User;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

class UserFixtures extends Fixture
{
    public const DEFAULT_USER = 'default-user';

    private UserPasswordHasherInterface $passwordEncoder;

    public function __construct(UserPasswordHasherInterface $passwordEncoder)
    {
        $this->passwordEncoder = $passwordEncoder;
    }

    /**
     * Load data fixtures with the passed EntityManager.
     */
    public function load(ObjectManager $manager): void
    {
        $this->createAdminUser($manager);
    }

    protected function createAdminUser(ObjectManager $manager): void
    {
        $items = [
            [
                'name' => 'Sergio Barbosa',
                'email' => 'sbarbosa115@gmail.com',
                'username' => 'sbarbosa115',
                'password' => '123456',
                'roles' => ['ROLE_ADMIN'],
            ],
            // The accounts of docs/tests/ui-regression.md: one per kind of person the app has.
            [
                'name' => 'Inventory Clerk',
                'email' => 'inventory@kf.local',
                'username' => 'inventory',
                'password' => '123456',
                'roles' => ['ROLE_MANAGE_INVENTORY', 'ROLE_USER'],
            ],
            [
                // No role reaches the invoice roles through the hierarchy (as in production): they are given one by one.
                'name' => 'Invoice Clerk',
                'email' => 'invoices@kf.local',
                'username' => 'invoices',
                'password' => '123456',
                'roles' => ['ROLE_UPDATE_INVOICES', 'ROLE_CAN_READ_INVOICES', 'ROLE_CAN_CREATE_INVOICES', 'ROLE_MANAGE_CUSTOMERS', 'ROLE_USER'],
            ],
        ];

        foreach ($items as $item) {
            $user = new User();
            $user->setName($item['name']);
            $user->setEmail($item['email']);
            $user->setUsername($item['username']);
            $user->setPassword($this->passwordEncoder->hashPassword($user, $item['password']));
            $user->setRoles($item['roles']);
            $user->setEnabled(true);
            $manager->persist($user);

            if (!$this->hasReference(self::DEFAULT_USER, User::class)) {
                $this->addReference(self::DEFAULT_USER, $user);
            }
        }
        $manager->flush();
    }
}
