<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * shops-settings (docs/pdr/prd-shops-settings.md, "Data model"): seven new tables — app settings, quick phrases, shop
 * connections, the shop order links, the failed-deliveries inbox, the write-back outbox and the comments' metadata.
 * Only CREATE TABLE and foreign keys *from* the new tables: no existing table or column changes (docs/db/README.md).
 */
final class Version20261006000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Create the shops-settings tables (app_setting, quick_phrase, shop_*, order_comment_meta)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('CREATE TABLE app_setting (`key` VARCHAR(100) NOT NULL, value LONGTEXT DEFAULT NULL, encrypted TINYINT NOT NULL, updated_at DATETIME NOT NULL, updated_by_id INT DEFAULT NULL, INDEX IDX_722938D5896DBBDE (updated_by_id), PRIMARY KEY (`key`)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('CREATE TABLE quick_phrase (id INT AUTO_INCREMENT NOT NULL, text VARCHAR(255) NOT NULL, position INT NOT NULL, active TINYINT NOT NULL, created_at DATETIME NOT NULL, PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('CREATE TABLE shop_connection (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(100) NOT NULL, site_url VARCHAR(255) NOT NULL, consumer_key LONGTEXT NOT NULL, consumer_secret LONGTEXT NOT NULL, webhook_token VARCHAR(64) NOT NULL, webhook_secret LONGTEXT NOT NULL, active TINYINT NOT NULL, email_printer TINYINT NOT NULL, capabilities JSON NOT NULL, pull_cursor DATETIME DEFAULT NULL, last_webhook_at DATETIME DEFAULT NULL, last_import_at DATETIME DEFAULT NULL, last_pull_at DATETIME DEFAULT NULL, last_pull_ok_at DATETIME DEFAULT NULL, last_failure_at DATETIME DEFAULT NULL, last_failure_code VARCHAR(64) DEFAULT NULL, last_failure LONGTEXT DEFAULT NULL, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, warehouse_id INT NOT NULL, UNIQUE INDEX UNIQ_53849E405E237E06 (name), UNIQUE INDEX UNIQ_53849E40EB748E (site_url), UNIQUE INDEX UNIQ_53849E40D5E74442 (webhook_token), INDEX IDX_53849E405080ECDE (warehouse_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('CREATE TABLE shop_order_link (remote_order_id VARCHAR(64) NOT NULL, remote_status VARCHAR(32) DEFAULT NULL, pushed_status VARCHAR(32) DEFAULT NULL, created_at DATETIME NOT NULL, order_id INT NOT NULL, connection_id INT NOT NULL, UNIQUE INDEX uniq_shop_order_link_remote (connection_id, remote_order_id), INDEX IDX_12E4EC0DD03F01 (connection_id), PRIMARY KEY (order_id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('CREATE TABLE shop_delivery (id INT AUTO_INCREMENT NOT NULL, kind VARCHAR(16) NOT NULL, remote_order_id VARCHAR(64) DEFAULT NULL, status VARCHAR(16) NOT NULL, reason_code VARCHAR(64) DEFAULT NULL, reason LONGTEXT DEFAULT NULL, payload LONGTEXT DEFAULT NULL, attempts INT NOT NULL, received_at DATETIME NOT NULL, last_attempt_at DATETIME DEFAULT NULL, resolved_at DATETIME DEFAULT NULL, connection_id INT DEFAULT NULL, order_id INT DEFAULT NULL, INDEX idx_shop_delivery_connection_status (connection_id, status), INDEX IDX_EC391686DD03F01 (connection_id), INDEX IDX_EC3916868D9F6D38 (order_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('CREATE TABLE shop_outbox (id INT AUTO_INCREMENT NOT NULL, capability VARCHAR(32) NOT NULL, payload JSON NOT NULL, status VARCHAR(16) NOT NULL, attempts INT NOT NULL, next_attempt_at DATETIME DEFAULT NULL, last_error LONGTEXT DEFAULT NULL, created_at DATETIME NOT NULL, sent_at DATETIME DEFAULT NULL, connection_id INT NOT NULL, order_id INT NOT NULL, INDEX idx_shop_outbox_status_next (status, next_attempt_at), INDEX IDX_EF45F3F2DD03F01 (connection_id), INDEX IDX_EF45F3F28D9F6D38 (order_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('CREATE TABLE order_comment_meta (origin VARCHAR(16) NOT NULL, pinned TINYINT NOT NULL, pinned_at DATETIME DEFAULT NULL, remote_note_id VARCHAR(64) DEFAULT NULL, send_to_shop TINYINT NOT NULL, comment_id INT NOT NULL, pinned_by_id INT DEFAULT NULL, connection_id INT DEFAULT NULL, UNIQUE INDEX uniq_order_comment_meta_note (connection_id, remote_note_id), INDEX IDX_F50422B359662AC1 (pinned_by_id), INDEX IDX_F50422B3DD03F01 (connection_id), PRIMARY KEY (comment_id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_unicode_ci` ENGINE = InnoDB');
        $this->addSql('ALTER TABLE app_setting ADD CONSTRAINT FK_722938D5896DBBDE FOREIGN KEY (updated_by_id) REFERENCES `user` (id)');
        $this->addSql('ALTER TABLE shop_connection ADD CONSTRAINT FK_53849E405080ECDE FOREIGN KEY (warehouse_id) REFERENCES warehouse (id)');
        $this->addSql('ALTER TABLE shop_order_link ADD CONSTRAINT FK_12E4EC08D9F6D38 FOREIGN KEY (order_id) REFERENCES `order` (id)');
        $this->addSql('ALTER TABLE shop_order_link ADD CONSTRAINT FK_12E4EC0DD03F01 FOREIGN KEY (connection_id) REFERENCES shop_connection (id)');
        $this->addSql('ALTER TABLE shop_delivery ADD CONSTRAINT FK_EC391686DD03F01 FOREIGN KEY (connection_id) REFERENCES shop_connection (id)');
        $this->addSql('ALTER TABLE shop_delivery ADD CONSTRAINT FK_EC3916868D9F6D38 FOREIGN KEY (order_id) REFERENCES `order` (id)');
        $this->addSql('ALTER TABLE shop_outbox ADD CONSTRAINT FK_EF45F3F2DD03F01 FOREIGN KEY (connection_id) REFERENCES shop_connection (id)');
        $this->addSql('ALTER TABLE shop_outbox ADD CONSTRAINT FK_EF45F3F28D9F6D38 FOREIGN KEY (order_id) REFERENCES `order` (id)');
        $this->addSql('ALTER TABLE order_comment_meta ADD CONSTRAINT FK_F50422B3F8697D13 FOREIGN KEY (comment_id) REFERENCES comment (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE order_comment_meta ADD CONSTRAINT FK_F50422B359662AC1 FOREIGN KEY (pinned_by_id) REFERENCES `user` (id)');
        $this->addSql('ALTER TABLE order_comment_meta ADD CONSTRAINT FK_F50422B3DD03F01 FOREIGN KEY (connection_id) REFERENCES shop_connection (id)');
    }

    public function down(Schema $schema): void
    {
        foreach (['order_comment_meta', 'shop_outbox', 'shop_delivery', 'shop_order_link', 'shop_connection', 'quick_phrase', 'app_setting'] as $table) {
            $this->addSql('DROP TABLE '.$table);
        }
    }
}
