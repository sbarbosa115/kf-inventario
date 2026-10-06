<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20190105035753 extends AbstractMigration
{
    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->abortIf('mysql' !== $this->connection->getDatabasePlatform()->getName(), 'Migration can only be executed safely on \'mysql\'.');

        $this->addSql('ALTER TABLE log RENAME INDEX idx_f08fc65ca76ed395 TO IDX_8F3F68C5A76ED395');
        $this->addSql('ALTER TABLE order_product DROP INDEX UNIQ_2530ADE64584665A, ADD INDEX IDX_2530ADE64584665A (product_id)');
        $this->addSql('ALTER TABLE order_product DROP INDEX UNIQ_2530ADE68D9F6D38, ADD INDEX IDX_2530ADE68D9F6D38 (order_id)');
        $this->addSql('ALTER TABLE order_product CHANGE product_id product_id INT DEFAULT NULL, CHANGE order_id order_id INT DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->abortIf('mysql' !== $this->connection->getDatabasePlatform()->getName(), 'Migration can only be executed safely on \'mysql\'.');

        $this->addSql('ALTER TABLE log RENAME INDEX idx_8f3f68c5a76ed395 TO IDX_F08FC65CA76ED395');
        $this->addSql('ALTER TABLE order_product DROP INDEX IDX_2530ADE64584665A, ADD UNIQUE INDEX UNIQ_2530ADE64584665A (product_id)');
        $this->addSql('ALTER TABLE order_product DROP INDEX IDX_2530ADE68D9F6D38, ADD UNIQUE INDEX UNIQ_2530ADE68D9F6D38 (order_id)');
        $this->addSql('ALTER TABLE order_product CHANGE product_id product_id INT NOT NULL, CHANGE order_id order_id INT NOT NULL');
    }
}
