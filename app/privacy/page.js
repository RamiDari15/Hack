import DocPage from '@/components/DocPage';
export const metadata = { title: 'Privacy' };
export default function Page() {
  return (
    <DocPage title="Privacy" lede="Draft, not yet reviewed.">
      <p className="notice notice-warn">Placeholder. The privacy policy has not been written or reviewed. Do not rely on this page.</p>
      <p>Until it is published, the product follows these rules: event details are private to the event owner, vendors see only the bookings they are part of, and API keys stay on the server.</p>
    </DocPage>
  );
}
