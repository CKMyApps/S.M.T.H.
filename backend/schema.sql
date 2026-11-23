CREATE TABLE `scores` (
	`attempt` text PRIMARY KEY NOT NULL,
	`player` text NOT NULL,
	`nickname` text NOT NULL,
	`airtime` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `scores_created` ON `scores` (`created`);--> statement-breakpoint
CREATE INDEX `scores_player` ON `scores` (`player`);