CREATE TABLE `app_catalog` (
	`app_key` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`categories` text NOT NULL,
	`auth_type` text,
	`action_count` integer,
	`embedding_text` text,
	`synced_at` integer NOT NULL
);
