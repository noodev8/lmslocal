import Image from 'next/image';
import Link from 'next/link';

/**
 * The LMSLocal badge plus wordmark, as used in the header of every signed-out
 * page. Shared so the mark and the type can never drift apart between the
 * landing page's own header and PublicHeader.
 *
 * The badge asset (`public/logo.png`) is pre-cropped to the ring and carries a
 * circular alpha channel, so it needs no clipping here — it sits on any of the
 * three stocks without showing a square edge. Its cream interior is warmer than
 * `stock-lit` on purpose: at this size it reads as a sticker pressed onto the
 * coupon, not as a panel that has failed to match.
 */

type Props = {
  /** Rendered as a link home unless this is already the home page. */
  href?: string;
};

export default function Wordmark({ href = '/' }: Props) {
  return (
    <Link href={href} className="flex items-center gap-2.5 sm:gap-3">
      <Image
        src="/logo.png"
        alt=""
        width={80}
        height={80}
        priority
        className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
      />
      <span className="font-display text-2xl font-semibold uppercase tracking-[0.1em] text-ink sm:text-[1.75rem]">
        LMSLocal
      </span>
    </Link>
  );
}
