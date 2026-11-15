import AuthScreen from '../AuthScreen';

export const metadata = { title: 'Vendor sign in' };

export default function VendorSignInPage({ searchParams }) {
  return <AuthScreen searchParams={searchParams} audience="vendor" />;
}
