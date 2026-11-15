'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLinks({ items }) {
  const path = usePathname() || '/';
  return (
    <ul role="list">
      {items.map((n) => {
        const on = path === n.href || path.startsWith(`${n.href}/`);
        return <li key={n.href}><Link href={n.href} aria-current={on ? 'page' : undefined}>{n.label}</Link></li>;
      })}
    </ul>
  );
}
