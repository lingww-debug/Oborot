CREATE TABLE `pro_access` (
	`email` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pro_deals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`document` text NOT NULL,
	`revision` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pro_deals_user` ON `pro_deals` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `pro_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`deal_id` text,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pro_events_user` ON `pro_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `pro_preferences` (
	`user_id` text PRIMARY KEY NOT NULL,
	`document` text NOT NULL
);
