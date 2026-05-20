CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`invoiceId` int,
	`action` varchar(50) NOT NULL,
	`details` text,
	`ipAddress` varchar(45),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `certificates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`certificateName` varchar(255) NOT NULL,
	`certificateKeyUrl` text NOT NULL,
	`certificateKeyStorageKey` varchar(255) NOT NULL,
	`thumbprint` varchar(255) NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `certificates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `company_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`cnpj` varchar(18) NOT NULL,
	`inscricaoMunicipal` varchar(20) NOT NULL,
	`itemListaServico` varchar(10) NOT NULL DEFAULT '0101',
	`codigoCnae` varchar(10) NOT NULL DEFAULT '9602502',
	`regimeEspecialTributacao` varchar(1) NOT NULL DEFAULT '1',
	`optanteSimplesNacional` varchar(1) NOT NULL DEFAULT '1',
	`incentivadorCultural` varchar(1) NOT NULL DEFAULT '2',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `company_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`certificateId` int NOT NULL,
	`rpsNumber` varchar(20) NOT NULL,
	`rpsSeriesNumber` varchar(5) NOT NULL DEFAULT 'RPS',
	`nfseNumber` varchar(20),
	`status` enum('pending','authorized','error','cancelled') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`clientName` varchar(255) NOT NULL,
	`clientCpfCnpj` varchar(18) NOT NULL,
	`clientAddress` text NOT NULL,
	`serviceDescription` text NOT NULL,
	`serviceValue` decimal(12,2) NOT NULL,
	`deductions` decimal(12,2) DEFAULT '0.00',
	`observations` text,
	`xmlSignedUrl` text,
	`xmlSignedStorageKey` varchar(255),
	`pdfUrl` text,
	`pdfStorageKey` varchar(255),
	`emittedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_invoiceId_invoices_id_fk` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `company_config` ADD CONSTRAINT `company_config_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_certificateId_certificates_id_fk` FOREIGN KEY (`certificateId`) REFERENCES `certificates`(`id`) ON DELETE no action ON UPDATE no action;