ALTER TABLE "public"."vendors"
  ADD COLUMN "demo_reviews" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "public"."vendors"
  ADD CONSTRAINT "vendors_demo_reviews_check" CHECK ((jsonb_typeof(demo_reviews) = 'array'::text));

