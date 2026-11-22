'use client';

import { useEffect, useState } from 'react';

const fmt = (d: Date) =>
  `${d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('en-GB')}`
    .replace(/,/g, '')
    .toUpperCase();

/**
 * The header-row clock, ticking each second. It renders nothing on the server: the server's time
 * and zone are not the visitor's, so a server-rendered value would be wrong and then jump. The
 * placeholder keeps the row's width so the links beside it do not shift when it appears.
 */
export default function Clock({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className={className} aria-hidden="true">
      {now ? fmt(now) : ' '.repeat(19)}
    </span>
  );
}
