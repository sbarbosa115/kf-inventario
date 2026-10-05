-- What `doctrine:schema:update --dump-sql` proposes against a database built from the migrations on MySQL 8.0.
-- This is the recorded drift between the mappings and the production schema. It is NEVER applied: the production
-- database must not change. tests/Functional/Shared/SchemaInvarianceTest.php fails when the proposal differs from
-- the statements below, so any mapping change by the restructure is caught.
-- Recorded 2026-10-05 on master 4b23610 (migrations from the repository; no production dump was available).
CREATE TABLE invoice_line (id INT AUTO_INCREMENT NOT NULL, product_id INT DEFAULT NULL, product_code VARCHAR(255) DEFAULT NULL, product_title VARCHAR(255) DEFAULT NULL, unit_measure VARCHAR(50) DEFAULT NULL, quantity INT NOT NULL, unit_price DOUBLE PRECISION NOT NULL, total DOUBLE PRECISION NOT NULL, invoice_id INT NOT NULL, INDEX IDX_D3D1D6932989F1FD (invoice_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8;
ALTER TABLE invoice_line ADD CONSTRAINT FK_D3D1D6932989F1FD FOREIGN KEY (invoice_id) REFERENCES invoice (id) ON DELETE CASCADE;
ALTER TABLE user CHANGE roles roles JSON NOT NULL;
ALTER TABLE warehouse CHANGE urls urls JSON NOT NULL;
