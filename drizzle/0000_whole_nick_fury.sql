CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `action_proposal` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`mastra_run_id` text,
	`app_key` text NOT NULL,
	`action_type` text NOT NULL,
	`action_key` text NOT NULL,
	`human_label` text NOT NULL,
	`inputs` text NOT NULL,
	`input_schema` text NOT NULL,
	`connection_id` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `action_run` (
	`id` text PRIMARY KEY NOT NULL,
	`proposal_id` text NOT NULL,
	`result` text NOT NULL,
	`error` text,
	`executed_at` integer NOT NULL,
	FOREIGN KEY (`proposal_id`) REFERENCES `action_proposal`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `capability_flag` (
	`user_id` text NOT NULL,
	`capability` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`user_id`, `capability`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `conversation` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mastra_thread_id` text,
	`title` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `message` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE TABLE `workflow` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`source_conversation_id` text,
	`parameters` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_conversation_id`) REFERENCES `conversation`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workflow_run` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`inputs` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflow`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workflow_step` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`order` integer NOT NULL,
	`proposal_template` text NOT NULL,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflow`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `zapier_identity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer,
	`scopes` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `zapier_identity_user_id_unique` ON `zapier_identity` (`user_id`);