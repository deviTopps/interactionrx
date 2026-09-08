import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showText?: boolean;
  href?: string;
  className?: string;
  variant?: 'default' | 'light';
}

const sizes = {
  xs: { image: 28, text: 'text-sm' },
  sm: { image: 40, text: 'text-base' },
  md: { image: 48, text: 'text-lg' },
  lg: { image: 64, text: 'text-2xl' },
};

export default function Logo({
  size = 'sm',
  showText = true,
  href = '/dashboard',
  className = '',
  variant = 'default',
}: LogoProps) {
  const { image, text } = sizes[size];

  const content = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Image
        src="/logo.png"
        alt="InteractionRX"
        width={image}
        height={image}
        className="rounded-lg object-contain"
        priority
      />
      {showText && (
        <span
          className={`font-semibold ${variant === 'light' ? 'text-white' : 'text-gray-900'} ${text}`}
        >
          InteractionRX
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex">
        {content}
      </Link>
    );
  }

  return content;
}
