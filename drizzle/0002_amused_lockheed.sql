ALTER TABLE `certificates` MODIFY COLUMN `certificateKeyUrl` text;--> statement-breakpoint
ALTER TABLE `certificates` MODIFY COLUMN `certificateKeyStorageKey` varchar(255);--> statement-breakpoint
ALTER TABLE `certificates` MODIFY COLUMN `updatedAt` timestamp NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `certificates` ADD `certificateKeyContent` text;