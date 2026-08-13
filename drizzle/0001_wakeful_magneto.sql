CREATE TABLE `episodeImages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`episodeId` int NOT NULL,
	`imageUrl` text NOT NULL,
	`imageKey` text NOT NULL,
	`sortOrder` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `episodeImages_id` PRIMARY KEY(`id`),
	CONSTRAINT `episode_images_episode_order_unique` UNIQUE(`episodeId`,`sortOrder`)
);
--> statement-breakpoint
CREATE TABLE `episodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webtoonId` int NOT NULL,
	`episodeNumber` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`isPublished` int NOT NULL DEFAULT 1,
	`publishedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `episodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `episodes_webtoon_number_unique` UNIQUE(`webtoonId`,`episodeNumber`)
);
--> statement-breakpoint
CREATE TABLE `webtoons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`title` varchar(160) NOT NULL,
	`genre` varchar(80) NOT NULL,
	`thumbnailUrl` text,
	`thumbnailKey` text,
	`description` text NOT NULL,
	`isPublished` int NOT NULL DEFAULT 1,
	`publishedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webtoons_id` PRIMARY KEY(`id`),
	CONSTRAINT `webtoons_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` varchar(16) NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `episodeImages` ADD CONSTRAINT `episodeImages_episodeId_episodes_id_fk` FOREIGN KEY (`episodeId`) REFERENCES `episodes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `episodes` ADD CONSTRAINT `episodes_webtoonId_webtoons_id_fk` FOREIGN KEY (`webtoonId`) REFERENCES `webtoons`(`id`) ON DELETE cascade ON UPDATE no action;