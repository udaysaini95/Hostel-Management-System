CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'student' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" varchar(100) NOT NULL,
	"room" varchar(50) NOT NULL,
	"description" text NOT NULL,
	"image" varchar(500),
	"status" varchar(50) DEFAULT 'Created' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "complaint_timelines" (
	"id" serial PRIMARY KEY NOT NULL,
	"complaint_id" integer NOT NULL,
	"status" varchar(50) NOT NULL,
	"time" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "leaves" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"reason" text,
	"from_date" varchar(100),
	"to_date" varchar(100),
	"status" varchar(50) DEFAULT 'Pending' NOT NULL,
	"admin_signature" text,
	"pdf_file" varchar(500),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mess_issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"student_name" varchar(255) NOT NULL,
	"issue_type" varchar(100),
	"meal_type" varchar(100),
	"description" text,
	"image" varchar(500),
	"status" varchar(50) DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mess_menus" (
	"id" serial PRIMARY KEY NOT NULL,
	"menu_date" timestamp NOT NULL,
	"breakfast" text,
	"lunch" text,
	"dinner" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "mess_menus_menu_date_unique" UNIQUE("menu_date")
);
--> statement-breakpoint
CREATE TABLE "mess_feedbacks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"meal_type" varchar(100),
	"food_item" varchar(255),
	"rating" integer,
	"feedback_date" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "menu_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"meal_type" varchar(100),
	"old_item" varchar(255),
	"suggested_item" varchar(255),
	"vote_date" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaint_timelines" ADD CONSTRAINT "complaint_timelines_complaint_id_complaints_id_fk" FOREIGN KEY ("complaint_id") REFERENCES "public"."complaints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mess_issues" ADD CONSTRAINT "mess_issues_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mess_feedbacks" ADD CONSTRAINT "mess_feedbacks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_votes" ADD CONSTRAINT "menu_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;