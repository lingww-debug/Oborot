CREATE TABLE `contact_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`proof` text NOT NULL,
	`target` text NOT NULL,
	`answer` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contact_challenge_expiry` ON `contact_challenges` (`expires_at`);--> statement-breakpoint
CREATE TABLE `contact_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contact_limit_expiry` ON `contact_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`spec` text NOT NULL,
	`condition` text NOT NULL,
	`description` text NOT NULL,
	`price` integer NOT NULL,
	`published` integer NOT NULL,
	`demo` integer NOT NULL,
	`photo_key` text,
	`revision` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `products_public_order` ON `products` (`published`,`updated_at`);--> statement-breakpoint
CREATE INDEX `products_photo_key` ON `products` (`photo_key`);--> statement-breakpoint
CREATE TABLE `site_content` (
	`id` integer PRIMARY KEY NOT NULL,
	`document` text NOT NULL,
	`revision` integer NOT NULL
);
