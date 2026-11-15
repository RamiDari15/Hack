import Link from 'next/link';
import DocPage from '@/components/DocPage';
export const metadata = { title: 'Support' };
export default function Page() {
  return (
    <DocPage title="Support">
      <p className="notice">A support inbox is not set up yet. Contact details will be listed here before launch.</p>
      <p>Common questions are answered on <Link href="/how-it-works#faq">How it works</Link>.</p>
    </DocPage>
  );
}
