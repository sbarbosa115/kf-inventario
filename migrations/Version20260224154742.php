<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260224154742 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE invoice ADD tax_rate NUMERIC(5, 2) DEFAULT NULL, ADD tax_amount NUMERIC(12, 2) DEFAULT NULL, CHANGE customer_address customer_address LONGTEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE invoice RENAME INDEX idx_invoice_customer TO IDX_906517449395C3F3');
        $this->addSql('ALTER TABLE invoice_item RENAME INDEX idx_invoiceitem_invoice TO IDX_1DDE477B2989F1FD');
        $this->addSql('ALTER TABLE invoice_item RENAME INDEX idx_invoiceitem_product TO IDX_1DDE477B4584665A');
        $this->addSql('ALTER TABLE `order` CHANGE created_at created_at DATETIME DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE invoice DROP tax_rate, DROP tax_amount, CHANGE customer_address customer_address TEXT DEFAULT NULL');
        $this->addSql('ALTER TABLE invoice RENAME INDEX idx_906517449395c3f3 TO IDX_INVOICE_CUSTOMER');
        $this->addSql('ALTER TABLE invoice_item RENAME INDEX idx_1dde477b4584665a TO IDX_INVOICEITEM_PRODUCT');
        $this->addSql('ALTER TABLE invoice_item RENAME INDEX idx_1dde477b2989f1fd TO IDX_INVOICEITEM_INVOICE');
        $this->addSql('ALTER TABLE `order` CHANGE created_at created_at DATETIME NOT NULL');
    }
}
