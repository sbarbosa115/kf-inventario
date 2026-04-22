<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use App\Entity\Country;
use App\Entity\State;
use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;
use Doctrine\ORM\EntityManager;
use Symfony\Component\DependencyInjection\ContainerAwareInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20190210195638 extends AbstractMigration implements ContainerAwareInterface
{
    /** @var ContainerInterface */
    private $container;

    public function setContainer(ContainerInterface $container = null): void
    {
        $this->container = $container;
    }

    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->abortIf('mysql' !== $this->connection->getDatabasePlatform()->getName(), 'Migration can only be executed safely on \'mysql\'.');

        /** @var EntityManager */
        $entityManager = $this->container->get('doctrine.orm.entity_manager');
        /** @var $defaultUsaCountry Country */
        $defaultUsaCountry = $entityManager->getRepository(Country::class)->findOneBy(['name' => 'USA']);

        if (!$defaultUsaCountry instanceof Country) {
            $defaultUsaCountry = new Country();
        }

        $defaultUsaCountry->setName('United States');
        $defaultUsaCountry->setCode('US');
        $entityManager->persist($defaultUsaCountry);

        /** @var $florida State */
        $florida = $entityManager->getRepository(State::class)->findOneBy(['name' => 'Florida']);
        if (!$florida instanceof State) {
            $florida = new State();
            $florida->setName('Florida');
            $florida->setCountry($defaultUsaCountry);
        }
        $florida->setCode('FL');
        $entityManager->persist($florida);
        $entityManager->flush();

        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('AL', '{$defaultUsaCountry->getId()}', 'Alabama')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('AK', '{$defaultUsaCountry->getId()}', 'Alaska')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('AZ', '{$defaultUsaCountry->getId()}', 'Arizona')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('AR', '{$defaultUsaCountry->getId()}', 'Arkansas')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('CA', '{$defaultUsaCountry->getId()}', 'California')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('CO', '{$defaultUsaCountry->getId()}', 'Colorado')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('CT', '{$defaultUsaCountry->getId()}', 'Connecticut')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('DE', '{$defaultUsaCountry->getId()}', 'Delaware')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('DC', '{$defaultUsaCountry->getId()}', 'District of Columbia')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('GA', '{$defaultUsaCountry->getId()}', 'Georgia')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('HI', '{$defaultUsaCountry->getId()}', 'Hawaii')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('ID', '{$defaultUsaCountry->getId()}', 'Idaho')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('IL', '{$defaultUsaCountry->getId()}', 'Illinois')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('IN', '{$defaultUsaCountry->getId()}', 'Indiana')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('IA', '{$defaultUsaCountry->getId()}', 'Iowa')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('KS', '{$defaultUsaCountry->getId()}', 'Kansas')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('KY', '{$defaultUsaCountry->getId()}', 'Kentucky')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('LA', '{$defaultUsaCountry->getId()}', 'Louisiana')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('ME', '{$defaultUsaCountry->getId()}', 'Maine')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('MD', '{$defaultUsaCountry->getId()}', 'Maryland')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('MA', '{$defaultUsaCountry->getId()}', 'Massachusetts')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('MI', '{$defaultUsaCountry->getId()}', 'Michigan')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('MN', '{$defaultUsaCountry->getId()}', 'Minnesota')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('MS', '{$defaultUsaCountry->getId()}', 'Mississippi')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('MO', '{$defaultUsaCountry->getId()}', 'Missouri')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('MT', '{$defaultUsaCountry->getId()}', 'Montana')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('NE', '{$defaultUsaCountry->getId()}', 'Nebraska')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('NV', '{$defaultUsaCountry->getId()}', 'Nevada')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('NH', '{$defaultUsaCountry->getId()}', 'New Hampshire')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('NJ', '{$defaultUsaCountry->getId()}', 'New Jersey')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('NM', '{$defaultUsaCountry->getId()}', 'New Mexico')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('NY', '{$defaultUsaCountry->getId()}', 'New York')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('NC', '{$defaultUsaCountry->getId()}', 'North Carolina')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('ND', '{$defaultUsaCountry->getId()}', 'North Dakota')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('OH', '{$defaultUsaCountry->getId()}', 'Ohio')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('OK', '{$defaultUsaCountry->getId()}', 'Oklahoma')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('OR', '{$defaultUsaCountry->getId()}', 'Oregon')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('PA', '{$defaultUsaCountry->getId()}', 'Pennsylvania')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('RI', '{$defaultUsaCountry->getId()}', 'Rhode Island')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('SC', '{$defaultUsaCountry->getId()}', 'South Carolina')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('SD', '{$defaultUsaCountry->getId()}', 'South Dakota')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('TN', '{$defaultUsaCountry->getId()}', 'Tennessee')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('TX', '{$defaultUsaCountry->getId()}', 'Texas')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('UT', '{$defaultUsaCountry->getId()}', 'Utah')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('VT', '{$defaultUsaCountry->getId()}', 'Vermont')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('VA', '{$defaultUsaCountry->getId()}', 'Virginia')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('WA', '{$defaultUsaCountry->getId()}', 'Washington')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('WV', '{$defaultUsaCountry->getId()}', 'West Virginia')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('WI', '{$defaultUsaCountry->getId()}', 'Wisconsin')");
        $this->addSql("INSERT INTO state (`code`, `country_id`, `name`) VALUES ('WY', '{$defaultUsaCountry->getId()}', 'Wyoming')");
    }

    public function down(Schema $schema): void
    {
        throw new \LogicException('This migration does not have rollback.');
    }
}
