# Vendora authentication

Hosted signup, password sign-in, email verification, password-reset emails and password changes use Firebase Authentication. Supabase remains the database, with existing UUID ownership, profiles, roles and row policies.

Firebase project: `vendora-auth-ramidari15` (Spark; no billing enabled). Web app: `1:83834721588:web:21c4cfb212dcb0fbc14161`. The hosted domain and localhost are authorized. Firebase's default hosted email action handler processes verification/reset links and returns users to sign-in.

## Configuration

Set `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_API_KEY`, `FIREBASE_ADMIN_CREDENTIAL` and `SUPABASE_SERVICE_ROLE_KEY` on the server. The administrative credential is JSON for a dedicated service account granted only `roles/firebaseauth.admin` in this Firebase project. Never expose either administrative key in client code or commit them. Production variables are encrypted in Vercel.

Register Firebase as a Supabase Third-Party Auth provider for this exact project. Apply both Firebase migrations before enabling the public Firebase configuration. Database policies and privileged helpers use `public.session_user_id()` to reject Firebase tokens without verified email and the server-assigned `authenticated` claim. Supabase system functions are untouched. Local development can continue using local Supabase Auth by leaving the Firebase fields empty.

After applying previously pending feature migrations to a database that already has the Firebase guard migration, rerun the idempotent `firebase_verified_sessions` SQL: migrations that create ownership policies/functions must use the verified identity helper. Fresh databases apply them in order. The RLS suite checks the complete source migration set.

## Account continuity and sessions

New accounts receive UUID Firebase UIDs. Existing confirmed Supabase accounts migrate on their first successful password login, retaining the same UUID and all linked records. Existing users can also use Firebase's reset-password flow. An existing email's UUID is looked up only through a service-only RPC. Verification is required before the server grants the database access claim or creates a new shadow Supabase identity. Application roles remain in database profiles; the vendor entry adds only the self-assignable vendor role.

The server calls Firebase's Auth REST API and Admin SDK; passwords never enter the database or app logs. Firebase ID/refresh tokens live in HttpOnly, SameSite=Lax cookies (Secure on HTTPS). Middleware verifies project/issuer/signature and refreshes tokens; server data access additionally checks account revocation. Session creation and password changes require matching Origin. Password changes require recent authentication. Signup, login, reset and resend use shared atomic database throttles. Direct client signup is disabled in Firebase so account creation follows this server path.

## Verification

`npm run test:db` covers existing RLS rules plus identity lookup permissions, atomic throttles, unverified Firebase tokens, missing access claims and tokens from unrelated projects.

`node e2e/firebase-auth.mjs` is an opt-in live integration test. Supply `FIREBASE_TEST_BASE_URL`, the configuration above, and explicitly target an isolated app instance. It creates disposable `@example.test` accounts, tests verification actions and email requests to reserved `.test` addresses, login, legacy migration, UUID preservation, vendor roles, private events, refresh, password changes, sign-out and disabled-account rejection. It removes only its own fixtures in a finally block.

Resend/domain setup was paused when Firebase was selected. It is not required for Firebase verification/reset emails. Quote/message notification delivery remains separate.

Firebase Admin is pinned to 13.10.0. Version 14's jwks-rsa 4 dependency requires an ESM-only jose package through CommonJS, which failed under Vercel's loader despite passing locally. A restricted `node --no-experimental-require-module` load check reproduces the requirement. For deployment smoke tests before a hostname is authorized for email continuation, set `FIREBASE_TEST_SKIP_EMAIL_REQUESTS=true`; normal tests include those requests.
