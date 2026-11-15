SET local check_function_bodies = off;

CREATE TABLE "public"."vendor_calendar_entries" (
  "id"        uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "vendor_id" uuid                     NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at"   timestamp with time zone NOT NULL,
  "status"    text                     NOT NULL,
  "title"     text                     NOT NULL,
  "is_demo"   boolean                  NOT NULL DEFAULT false,
  CONSTRAINT "vendor_calendar_entries_check" CHECK ((ends_at > starts_at)),
  CONSTRAINT "vendor_calendar_entries_pkey" PRIMARY KEY (id),
  CONSTRAINT "vendor_calendar_entries_status_check" CHECK ((status = ANY (ARRAY['booked'::text, 'tentative'::text, 'blocked'::text]))),
  CONSTRAINT "vendor_calendar_entries_title_check" CHECK (((char_length(title) >= 1) AND (char_length(title) <= 120))),
  CONSTRAINT "vendor_calendar_entries_vendor_id_starts_at_key" UNIQUE (vendor_id, starts_at)
);

ALTER TABLE "public"."vendor_calendar_entries"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."vendors"
  ADD COLUMN "directory_listed" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."vendors"
  ADD COLUMN "source_url" text;

ALTER TABLE "public"."vendors"
  ADD COLUMN "sourced_at" timestamp WITH time zone;

ALTER TABLE "public"."vendors"
  ADD COLUMN "instagram_url" text;

ALTER TABLE "public"."vendors"
  ADD COLUMN "street_address" text;

ALTER TABLE "public"."vendors"
  ADD COLUMN "portfolio_photos" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "public"."vendors"
  ADD COLUMN "published_hours" jsonb;

ALTER TABLE "public"."vendors"
  ADD COLUMN "calendar_is_demo" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."vendors"
  ALTER COLUMN "owner_id" DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_directory_source()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.directory_listed := false;
      new.source_url := null;
      new.sourced_at := null;
      new.calendar_is_demo := false;
    else
      new.directory_listed := old.directory_listed;
      new.source_url := old.source_url;
      new.sourced_at := old.sourced_at;
      new.calendar_is_demo := old.calendar_is_demo;
    end if;
  end if;
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "public"."guard_directory_source"() FROM PUBLIC, "anon", "authenticated";

ALTER TABLE "public"."vendor_calendar_entries"
  ADD CONSTRAINT "vendor_calendar_entries_vendor_id_fkey" FOREIGN KEY (vendor_id) REFERENCES public.vendors(id) ON DELETE CASCADE;

ALTER TABLE "public"."vendors"
  ADD CONSTRAINT "vendors_instagram_url_check" CHECK (((instagram_url IS NULL) OR (instagram_url ~ '^https?://'::text)));

ALTER TABLE "public"."vendors"
  ADD CONSTRAINT "vendors_portfolio_photos_check" CHECK ((jsonb_typeof(portfolio_photos) = 'array'::text));

ALTER TABLE "public"."vendors"
  ADD CONSTRAINT "vendors_source_url_check" CHECK (((source_url IS NULL) OR (source_url ~ '^https://'::text)));

ALTER TABLE "public"."vendors"
  ADD CONSTRAINT "vendors_source_url_key" UNIQUE (source_url);

CREATE INDEX vendor_calendar_range_idx ON public.vendor_calendar_entries USING btree (vendor_id, starts_at, ends_at);

CREATE TRIGGER vendors_directory_guard
  BEFORE INSERT OR UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_directory_source();

CREATE POLICY "calendar: owner writes" ON "public"."vendor_calendar_entries"
  FOR ALL
  TO "authenticated"
  USING (public.owns_vendor(vendor_id))
  WITH CHECK (public.owns_vendor(vendor_id));

CREATE POLICY "calendar: visible vendor read" ON "public"."vendor_calendar_entries"
  FOR SELECT
  TO "anon", "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.vendors v
  WHERE ((v.id = vendor_calendar_entries.vendor_id) AND (v.directory_listed OR (v.verification_status = 'verified'::text) OR (v.owner_id = ( SELECT auth.uid() AS uid)))))));

CREATE POLICY "packages: directory read" ON "public"."vendor_packages"
  FOR SELECT
  TO "anon", "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.vendors v
  WHERE ((v.id = vendor_packages.vendor_id) AND v.directory_listed))));

CREATE POLICY "vendors: public directory read" ON "public"."vendors"
  FOR SELECT
  TO "anon", "authenticated"
  USING (directory_listed);

REVOKE ALL ON FUNCTION "public"."guard_directory_source"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."guard_directory_source"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."guard_directory_source"() TO "service_role";

REVOKE ALL ON TABLE "public"."vendor_calendar_entries" FROM "anon";

GRANT SELECT ON TABLE "public"."vendor_calendar_entries" TO "anon";

REVOKE ALL ON TABLE "public"."vendor_calendar_entries" FROM "authenticated";

GRANT DELETE, INSERT, SELECT, UPDATE ON TABLE "public"."vendor_calendar_entries" TO "authenticated";

REVOKE ALL ON TABLE "public"."vendor_calendar_entries" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vendor_calendar_entries" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vendor_calendar_entries" TO "service_role";

