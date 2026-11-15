// Opt-in live integration test. Creates disposable identities and removes only its own fixtures.
// Required: FIREBASE_TEST_BASE_URL, FIREBASE_ADMIN_CREDENTIAL, Firebase public config,
// and Supabase URL/anon/service-role keys. Email API requests use reserved .test addresses only.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { createClient } from '@supabase/supabase-js';
const base = process.env.FIREBASE_TEST_BASE_URL;
if (!base) throw new Error('Set FIREBASE_TEST_BASE_URL to explicitly opt into live disposable-account tests.');
const credential = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIAL || '{}');
assert.equal(credential.project_id, process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
const auth = getAuth(initializeApp({ credential: cert(credential) }, 'firebase-e2e'));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const fixtures = [randomUUID(), randomUUID()];
const email = uid => `vendora-firebase-test-${uid}@example.test`;
const signupAddress = email(randomUUID());
const password = randomBytes(24).toString('base64url');
let passed = 0;
function check(label, value) { assert.ok(value, label); passed++; console.log('PASS '+label); }
const localTestIp = base.startsWith('http://localhost:') ? { 'x-vercel-forwarded-for': `test-${randomUUID()}` } : {};
const cookieNames = ['vendora-firebase-id', 'vendora-firebase-refresh'];
function cookies(response) { return response.headers.getSetCookie().filter(x => cookieNames.some(n => x.startsWith(n+'='))).map(x => x.split(';')[0]).join('; '); }
async function call(body, cookie = '', origin = base) {
  const response = await fetch(base+'/api/auth/firebase', { method: 'POST', headers: { 'Content-Type': 'application/json', origin, cookie, ...localTestIp }, body: JSON.stringify(body), redirect: 'manual' });
  return { response, data: await response.json() };
}
async function firebase(method, body) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body) });
  const data=await r.json();if (!r.ok) throw new Error(data.error?.message);return data;
}
let event;
try {
  let r = await fetch(base+'/planner', { redirect:'manual' });
  check('anonymous planner access redirects to sign-in', r.status===307 && r.headers.get('location')?.includes('/sign-in'));
  let result = await call({action:'sign-in',email:email(fixtures[0]),password}, '', 'https://untrusted.example');
  check('cross-origin login is rejected',result.response.status===403);
  result = await call({action:'sign-up',email:'bad-address',password});
  check('invalid signup email rejected before provisioning',result.response.status===400);
  result = await call({action:'sign-up',email:email(fixtures[0]),password:'short'});
  check('short signup password rejected',result.response.status===400);
  await auth.createUser({uid:fixtures[0],email:email(fixtures[0]),password});
  result = await call({action:'sign-in',email:email(fixtures[0]),password});
  check('unverified email cannot obtain app session',result.response.status===400 && /Confirm your email/.test(result.data.error) && !cookies(result.response));
  let raw = await firebase('signInWithPassword',{email:email(fixtures[0]),password,returnSecureToken:true});
  const unverified = createClient(url,anon,{accessToken:async()=>raw.idToken});
  const blocked = await unverified.from('events').insert({owner_id:fixtures[0],title:'Must not exist',event_type:'wedding',location:'Test',event_date:'2027-06-12',guest_count:30,budget_cents:100000});
  check('unverified Firebase token cannot write database rows',blocked.status===401 || blocked.status===403);
  const link = new URL(await auth.generateEmailVerificationLink(email(fixtures[0])));
  await firebase('update',{oobCode:link.searchParams.get('oobCode')});
  check('Firebase verification action confirms ownership without sending test email',(await auth.getUser(fixtures[0])).emailVerified);
  result = await call({action:'sign-in',email:email(fixtures[0]),password,audience:'planner',next:'//untrusted.example'});
  check('verified Firebase account signs in',result.response.status===200 && !!cookies(result.response));
  check('post-login open redirect rejected',result.data.next==='/dashboard');
  const aCookies=cookies(result.response);
  check('session cookies are HttpOnly and SameSite Lax',result.response.headers.getSetCookie().every(x=>/HttpOnly/i.test(x)&&/SameSite=lax/i.test(x)));
  let identity=await admin.auth.admin.getUserById(fixtures[0]);
  check('Supabase shadow identity uses the same UUID',identity.data.user?.id===fixtures[0]);
  const record=await auth.getUser(fixtures[0]);
  check('only verified identity receives authenticated claim',record.customClaims?.role==='authenticated');
  raw=await firebase('signInWithPassword',{email:email(fixtures[0]),password,returnSecureToken:true});
  const a=createClient(url,anon,{accessToken:async()=>raw.idToken});
  let profile=await a.from('profiles').select('id,roles').single();
  check('Firebase token reads its own existing profile',profile.data?.id===fixtures[0]);
  const inserted=await a.from('events').insert({owner_id:fixtures[0],title:'Firebase integration fixture',event_type:'wedding',location:'Ann Arbor',event_date:'2027-06-12',guest_count:30,budget_cents:100000}).select('id').single();
  assert.ifError(inserted.error);
  event=inserted.data?.id;
  check('Firebase-authenticated event creation enforces UUID ownership',!!event);
  // Old account migrates only after the old password has been verified.
  const old=await admin.auth.admin.createUser({id:fixtures[1],email:email(fixtures[1]),password,email_confirm:true});
  check('legacy fixture created',old.data.user?.id===fixtures[1]);
  await auth.createUser({uid:fixtures[1],email:email(fixtures[1]),password});
  const pending=await firebase('signInWithPassword',{email:email(fixtures[1]),password,returnSecureToken:true});
  const pendingDb=createClient(url,anon,{accessToken:async()=>pending.idToken});
  let denied=await pendingDb.from('profiles').select('id').eq('id',fixtures[1]);
  check('unverified signup cannot read an existing matching account',!denied.error&&denied.data.length===0);
  denied=await pendingDb.rpc('add_my_role',{r:'vendor'});
  check('unverified signup cannot alter an existing account through RPC',!!denied.error);
  await auth.deleteUser(fixtures[1]);
  result=await call({action:'sign-in',email:email(fixtures[1]),password:'incorrect-password'});
  check('wrong legacy password cannot migrate an account',result.response.status===400);
  let missing=false;try{await auth.getUser(fixtures[1]);}catch(e){missing=e.code==='auth/user-not-found';}
  check('failed legacy login creates no Firebase account',missing);
  result=await call({action:'sign-in',email:email(fixtures[1]),password,audience:'vendor',next:'/vendor'});
  check('existing confirmed Supabase account migrates on correct login',result.response.status===200 && !!cookies(result.response));
  check('migration preserves the existing account UUID',(await auth.getUser(fixtures[1])).uid===fixtures[1]);
  const bRaw=await firebase('signInWithPassword',{email:email(fixtures[1]),password,returnSecureToken:true});
  const b=createClient(url,anon,{accessToken:async()=>bRaw.idToken});
  profile=await b.from('profiles').select('roles').single();
  check('vendor door adds vendor role while retaining customer role',profile.data?.roles.includes('vendor')&&profile.data.roles.includes('customer'));
  let other=await b.from('events').select('id').eq('id',event);
  check('another Firebase user cannot read private event',!other.error&&other.data.length===0);
  other=await b.from('events').update({title:'Forbidden change'}).eq('id',event).select('id');
  check('another Firebase user cannot change private event',!other.error&&other.data.length===0);
  const refreshOnly=aCookies.split('; ').filter(x=>x.startsWith('vendora-firebase-refresh=')).join('; ');
  r=await fetch(base+'/account',{headers:{cookie:refreshOnly},redirect:'manual'});
  check('refresh cookie restores an expired/missing ID session',r.status===200 && cookies(r).includes('vendora-firebase-id='));
  r=await fetch(base+'/account',{headers:{cookie:'vendora-firebase-id=forged; vendora-firebase-refresh=invalid'},redirect:'manual'});
  check('forged sessions cannot enter protected pages',r.status===307);
  r=await fetch(base+'/api/auth/firebase/password',{method:'POST',headers:{origin:base,'Content-Type':'application/json',cookie:aCookies},body:JSON.stringify({password:password+'new'})});
  check('recently authenticated user can change password',r.status===200);
  result=await call({action:'sign-in',email:email(fixtures[0]),password});
  check('old password stops working after password change',result.response.status===400);
  result=await call({action:'sign-in',email:email(fixtures[0]),password:password+'new'});
  check('new password works',result.response.status===200);
  r=await fetch(base+'/auth/sign-out',{method:'POST',headers:{origin:base,cookie:cookies(result.response)},redirect:'manual'});
  check('sign-out clears both session cookies',r.status===303&&r.headers.getSetCookie().filter(x=>/Max-Age=0/i.test(x)).length===2);
  r=await fetch(base+'/auth/sign-out',{redirect:'manual'});
  check('GET cannot sign a user out',r.status===405);
  await auth.revokeRefreshTokens(fixtures[1]);
  await auth.updateUser(fixtures[1],{disabled:true});
  const disabledCookie=`vendora-firebase-id=${bRaw.idToken}`;
  r=await fetch(base+'/api/auth/firebase/password',{method:'POST',headers:{origin:base,'Content-Type':'application/json',cookie:disabledCookie},body:JSON.stringify({password:password+'disabled'})});
  check('disabled Firebase user loses server API access',r.status===401);
  r=await fetch(base+'/account',{headers:{cookie:disabledCookie},redirect:'manual'});
  check('disabled Firebase user cannot load their account page',r.status===307);
  if (process.env.FIREBASE_TEST_SKIP_EMAIL_REQUESTS !== 'true') {
  result=await call({action:'sign-up',email:signupAddress,password,next:'/dashboard'});
  const signupRecord=await auth.getUserByEmail(signupAddress);
  fixtures.push(signupRecord.uid);
  check('signup creates UUID identity and requests Firebase verification email',result.response.status===200 && /^[0-9a-f-]{36}$/i.test(signupRecord.uid) && !signupRecord.emailVerified && !cookies(result.response));
  result=await call({action:'reset',email:signupAddress});
  check('Firebase accepts reset-email request for test account',result.response.status===200);
  }
  console.log(`\n${passed} Firebase integration checks passed.`);
} finally {
  if(event)await admin.from('events').delete().eq('id',event);
  try { fixtures.push((await auth.getUserByEmail(signupAddress)).uid); } catch { /* Signup may not have created an account. */ }
  for(const uid of new Set(fixtures)){await auth.deleteUser(uid).catch(()=>{});await admin.auth.admin.deleteUser(uid);}
  console.log('Removed disposable Firebase accounts, Supabase identities and test event.');
}
