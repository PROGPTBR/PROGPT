import Image from 'next/image';

// Reusable 2B Supply logo wrapper.
//
// The raw PNG has cyan brand stripes + dark "SUPPLY" text on a
// transparent background. On dark surfaces the dark text disappears;
// on light surfaces the logo is mostly readable but lacks visual
// contrast against the surrounding chrome. Both cases get fixed by
// rendering the logo inside a small white pill so the brand colors
// always pop, independent of the page theme.

type Size = 'sm' | 'md' | 'lg';

const HEIGHT_CLASS: Record<Size, string> = {
  sm: 'h-5',
  md: 'h-6',
  lg: 'h-7',
};

const PAD_CLASS: Record<Size, string> = {
  sm: 'px-2 py-1',
  md: 'px-2.5 py-1.5',
  lg: 'px-3 py-1.5',
};

type Props = {
  size?: Size;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({
  size = 'md',
  className = '',
  priority = false,
}: Props) {
  return (
    <span
      className={`inline-flex items-center bg-white rounded-md shadow-sm ring-1 ring-black/10 ${PAD_CLASS[size]} ${className}`}
    >
      <Image
        src="/2bsupply-logo.png"
        alt="2B Supply"
        width={241}
        height={57}
        priority={priority}
        className={`${HEIGHT_CLASS[size]} w-auto`}
      />
    </span>
  );
}
