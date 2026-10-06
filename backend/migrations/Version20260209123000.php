<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260209123000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add customer_nit and customer_address columns to invoice';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE invoice ADD customer_nit VARCHAR(255) DEFAULT NULL");
        $this->addSql("ALTER TABLE invoice ADD customer_address TEXT DEFAULT NULL");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE invoice DROP customer_nit');
        $this->addSql('ALTER TABLE invoice DROP customer_address');
    }
}
