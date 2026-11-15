SET local check_function_bodies = off;

ALTER TABLE "public"."vendors"
  ADD COLUMN "latitude" double precision;

ALTER TABLE "public"."vendors"
  ADD COLUMN "longitude" double precision;

CREATE OR REPLACE FUNCTION public.vendors_within_radius (
  center_latitude  double precision,
  center_longitude double precision,
  radius_miles     double precision DEFAULT 25
)
  RETURNS SETOF public.vendors
  LANGUAGE sql
  STABLE
  SET search_path TO 'public'
  AS $function$
  select v.* from public.vendors v
  where center_latitude between -90 and 90 and center_longitude between -180 and 180
    and radius_miles between 1 and 1000
    and v.latitude is not null and v.longitude is not null
    and v.latitude between center_latitude - radius_miles / 69.0 and center_latitude + radius_miles / 69.0
    and 3958.7613 * 2 * asin(least(1.0, sqrt(greatest(0.0,
      power(sin(radians(v.latitude-center_latitude)/2), 2)
      + cos(radians(center_latitude))*cos(radians(v.latitude))
      * power(sin(radians(v.longitude-center_longitude)/2), 2)
    )))) <= radius_miles;
$function$;

ALTER TABLE "public"."vendors"
  ADD CONSTRAINT "vendors_latitude_check" CHECK (((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision)));

ALTER TABLE "public"."vendors"
  ADD CONSTRAINT "vendors_longitude_check" CHECK (((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision)));

CREATE INDEX vendors_coordinates_idx ON public.vendors USING btree (latitude, longitude);

REVOKE ALL ON FUNCTION "public"."vendors_within_radius"(double precision, double precision, double precision) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION "public"."vendors_within_radius"(double precision, double precision, double precision) TO "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."vendors_within_radius"(double precision, double precision, double precision) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."vendors_within_radius"(double precision, double precision, double precision) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."vendors_within_radius"(double precision, double precision, double precision) TO "service_role";

