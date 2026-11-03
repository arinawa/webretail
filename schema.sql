CREATE DATABASE IF NOT EXISTS yanzahnet_billing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE yanzahnet_billing;

CREATE TABLE IF NOT EXISTS packages (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(80) NOT NULL,
 speed_mbps INT UNSIGNED NOT NULL,
 monthly_price BIGINT UNSIGNED NOT NULL,
 description VARCHAR(255) NULL,
 is_active TINYINT(1) NOT NULL DEFAULT 1,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_packages_speed (speed_mbps)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS customers (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 customer_code VARCHAR(40) NOT NULL UNIQUE,
 full_name VARCHAR(150) NOT NULL,
 email VARCHAR(190) NULL,
 phone VARCHAR(30) NOT NULL,
 address TEXT NULL,
 package_id BIGINT UNSIGNED NULL,
 service_status ENUM('PENDING','ACTIVE','SUSPENDED','TERMINATED') NOT NULL DEFAULT 'PENDING',
 is_isolated TINYINT(1) NOT NULL DEFAULT 0,
 installation_date DATE NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_customers_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE SET NULL,
 KEY idx_customers_phone (phone), KEY idx_customers_isolated (is_isolated)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoices (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 invoice_number VARCHAR(50) NOT NULL UNIQUE,
 customer_id BIGINT UNSIGNED NOT NULL,
 billing_period DATE NOT NULL,
 amount BIGINT UNSIGNED NOT NULL,
 due_date DATE NOT NULL,
 status ENUM('UNPAID','PENDING','PAID','VOID') NOT NULL DEFAULT 'UNPAID',
 paid_at DATETIME NULL,
 notes VARCHAR(255) NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
 UNIQUE KEY uq_customer_period (customer_id, billing_period), KEY idx_invoice_due_status (due_date, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 invoice_id BIGINT UNSIGNED NOT NULL,
 merchant_order_id VARCHAR(50) NOT NULL UNIQUE,
 duitku_reference VARCHAR(100) NULL,
 amount BIGINT UNSIGNED NOT NULL,
 status ENUM('PENDING','PAID','FAILED','EXPIRED') NOT NULL DEFAULT 'PENDING',
 payment_method VARCHAR(20) NULL,
 payment_url TEXT NULL,
 paid_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id),
 KEY idx_payments_invoice_status (invoice_id, status), KEY idx_payments_reference (duitku_reference)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_users (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 username VARCHAR(80) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 full_name VARCHAR(150) NOT NULL,
 is_active TINYINT(1) NOT NULL DEFAULT 1,
 last_login_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO packages (name, speed_mbps, monthly_price, description) VALUES
('Retail Low Speed',5,120000,'Paket retail 5 Mbps'),
('Retail Medium Speed',15,150000,'Paket retail hingga 15 Mbps'),
('Retail High Speed',25,200000,'Paket retail hingga 25 Mbps')
ON DUPLICATE KEY UPDATE name=VALUES(name), monthly_price=VALUES(monthly_price), description=VALUES(description), is_active=1;
