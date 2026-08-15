CREATE TABLE `readingEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitorId` varchar(80) NOT NULL,
	`webtoonId` int NOT NULL,
	`episodeId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `readingEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `readingEvents` ADD CONSTRAINT `readingEvents_webtoonId_webtoons_id_fk` FOREIGN KEY (`webtoonId`) REFERENCES `webtoons`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `readingEvents` ADD CONSTRAINT `readingEvents_episodeId_episodes_id_fk` FOREIGN KEY (`episodeId`) REFERENCES `episodes`(`id`) ON DELETE cascade ON UPDATE no action;