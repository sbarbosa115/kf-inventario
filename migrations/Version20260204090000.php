<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260204090000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create invoice and invoice_item tables';
    }

    public function up(Schema $schema): void
    {
        $this->abortIf('mysql' !== $this->connection->getDatabasePlatform()->getName(), 'Migration can only be executed safely on \'mysql\'.');

        $this->addSql('CREATE TABLE invoice (id INT AUTO_INCREMENT NOT NULL, code VARCHAR(255) DEFAULT NULL, customer_id INT DEFAULT NULL, total NUMERIC(12, 2) DEFAULT NULL, status INT DEFAULT NULL, created_at DATETIME DEFAULT NULL, modified_at DATETIME DEFAULT NULL, comment LONGTEXT DEFAULT NULL, INDEX IDX_INVOICE_CUSTOMER (customer_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('CREATE TABLE invoice_item (id INT AUTO_INCREMENT NOT NULL, invoice_id INT NOT NULL, product_id INT DEFAULT NULL, description VARCHAR(255) DEFAULT NULL, unit_price NUMERIC(12, 2) NOT NULL, quantity INT NOT NULL, discount NUMERIC(12, 2) DEFAULT NULL, total NUMERIC(12, 2) NOT NULL, INDEX IDX_INVOICEITEM_INVOICE (invoice_id), INDEX IDX_INVOICEITEM_PRODUCT (product_id), PRIMARY KEY(id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE invoice ADD CONSTRAINT FK_INVOICE_CUSTOMER FOREIGN KEY (customer_id) REFERENCES customer (id)');
        $this->addSql('ALTER TABLE invoice_item ADD CONSTRAINT FK_INVOICEITEM_INVOICE FOREIGN KEY (invoice_id) REFERENCES invoice (id)');
        $this->addSql('ALTER TABLE invoice_item ADD CONSTRAINT FK_INVOICEITEM_PRODUCT FOREIGN KEY (product_id) REFERENCES product (id)');
    }

    public function down(Schema $schema): void
    {
        $this->abortIf('mysql' !== $this->connection->getDatabasePlatform()->getName(), 'Migration can only be executed safely on \'mysql\'.');

        $this->addSql('ALTER TABLE invoice_item DROP FOREIGN KEY FK_INVOICEITEM_INVOICE');
        $this->addSql('ALTER TABLE invoice_item DROP FOREIGN KEY FK_INVOICEITEM_PRODUCT');
        $this->addSql('ALTER TABLE invoice DROP FOREIGN KEY FK_INVOICE_CUSTOMER');
        $this->addSql('DROP TABLE invoice_item');
        $this->addSql('DROP TABLE invoice');
    }
}
