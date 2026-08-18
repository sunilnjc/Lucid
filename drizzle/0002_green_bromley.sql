CREATE TABLE `beta_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`user_key` text NOT NULL,
	`role_id` text NOT NULL,
	`rating` integer NOT NULL,
	`helpful` text NOT NULL,
	`confusing` text DEFAULT '' NOT NULL,
	`missing` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
