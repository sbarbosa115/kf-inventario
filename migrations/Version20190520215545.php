<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20190520215545 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->abortIf('mysql' !== $this->connection->getDatabasePlatform()->getName(), 'Migration can only be executed safely on \'mysql\'.');

        $this->addSql('ALTER TABLE `order` CHANGE customer_id customer_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE `order` CHANGE warehouse_id warehouse_id INT DEFAULT NULL');
        $this->addSql('ALTER TABLE `order` CHANGE code code VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE `order` CHANGE status status INT DEFAULT NULL, CHANGE source source INT DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->abortIf('mysql' !== $this->connection->getDatabasePlatform()->getName(), 'Migration can only be executed safely on \'mysql\'.');

        $this->addSql('ALTER TABLE `order` CHANGE customer_id customer_id INT NOT NULL');
        $this->addSql('ALTER TABLE `order` CHANGE warehouse_id warehouse_id INT NOT NULL');
        $this->addSql('ALTER TABLE `order` CHANGE code code VARCHAR(255) NOT NULL COLLATE utf8_unicode_ci');
        $this->addSql('ALTER TABLE `order` CHANGE source source INT NOT NULL, CHANGE status status INT NOT NULL');
    }
}
