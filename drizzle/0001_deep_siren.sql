CREATE TABLE `learner_state` (
	`user_key` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
DROP TABLE `app_state`;