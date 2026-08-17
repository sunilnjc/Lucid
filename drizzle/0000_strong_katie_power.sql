CREATE TABLE `app_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "app_state_singleton" CHECK("app_state"."id" = 1)
);
