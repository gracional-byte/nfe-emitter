ALTER TABLE `invoices` MODIFY COLUMN `status` enum('pending','authorized','error','cancelled','processing') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `invoices` ADD `nfseSeriesNumber` varchar(5) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE `invoices` ADD `protocolNumber` varchar(50);--> statement-breakpoint
ALTER TABLE `invoices` ADD `clientCity` varchar(100);--> statement-breakpoint
ALTER TABLE `invoices` ADD `clientState` varchar(2);--> statement-breakpoint
ALTER TABLE `invoices` ADD `clientZipCode` varchar(10);--> statement-breakpoint
ALTER TABLE `invoices` ADD `discountValue` decimal(12,2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `invoices` ADD `issValue` decimal(12,2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `invoices` ADD `issRate` decimal(5,2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `invoices` ADD `serviceDate` timestamp;