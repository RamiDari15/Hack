import AuthScreen from './AuthScreen';

export const metadata = { title: 'Sign in' };

export default function SignInPage({ searchParams }) {
  return <AuthScreen searchParams={searchParams} audience="planner" />;
}
