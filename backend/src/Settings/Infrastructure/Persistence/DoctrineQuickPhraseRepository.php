<?php

namespace App\Settings\Infrastructure\Persistence;

use App\Settings\Domain\Error\QuickPhraseNotFound;
use App\Settings\Domain\Model\QuickPhrase;
use App\Settings\Domain\Repository\QuickPhraseRepository;
use Doctrine\ORM\EntityManagerInterface;

final class DoctrineQuickPhraseRepository implements QuickPhraseRepository
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function get(int $id): QuickPhrase
    {
        return $this->em->find(QuickPhrase::class, $id) ?? throw new QuickPhraseNotFound();
    }

    public function add(QuickPhrase $phrase): void
    {
        $this->em->persist($phrase);
    }

    public function remove(QuickPhrase $phrase): void
    {
        $this->em->remove($phrase);
    }

    public function ordered(bool $activeOnly): array
    {
        $criteria = $activeOnly ? ['active' => true] : [];

        return $this->em->getRepository(QuickPhrase::class)->findBy($criteria, ['position' => 'ASC', 'id' => 'ASC']);
    }

    public function nextPosition(): int
    {
        $max = $this->em->createQuery('SELECT MAX(p.position) FROM '.QuickPhrase::class.' p')->getSingleScalarResult();

        return null === $max ? 0 : (int) $max + 1;
    }
}
