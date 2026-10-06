<?php

namespace App\Settings\Infrastructure\Persistence;

use App\Identity\Domain\Model\User;
use App\Settings\Domain\Model\AppSetting;
use App\Settings\Domain\Repository\SettingRepository;
use Doctrine\ORM\EntityManagerInterface;

final class DoctrineSettingRepository implements SettingRepository
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function find(string $key): ?AppSetting
    {
        return $this->em->find(AppSetting::class, $key);
    }

    public function put(string $key, ?string $value, bool $encrypted, \DateTimeImmutable $at, ?int $actorId = null): void
    {
        $by = null === $actorId ? null : $this->em->getReference(User::class, $actorId);
        $setting = $this->find($key);
        if (null === $setting) {
            $this->em->persist(new AppSetting($key, $value, $encrypted, $at, $by));

            return;
        }
        $setting->change($value, $encrypted, $at, $by);
    }

    public function all(): array
    {
        return $this->em->getRepository(AppSetting::class)->findBy([], ['key' => 'ASC']);
    }
}
