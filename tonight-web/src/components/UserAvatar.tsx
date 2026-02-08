import { useState } from 'react';

const sizeMap = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-14 w-14 text-base',
  lg: 'h-20 w-20 text-lg',
  xl: 'h-28 w-28 text-xl',
};

export type UserAvatarSize = keyof typeof sizeMap;

interface UserAvatarProps {
  displayName?: string | null;
  email?: string;
  photoUrl?: string | null;
  size?: UserAvatarSize;
}

const getInitials = (displayName?: string | null, fallback?: string) => {
  const source = displayName?.trim() || fallback?.trim();
  if (!source) {
    return '?';
  }

  const parts = source.split(/\s+/).slice(0, 2);
  return parts
    .map((part) => part[0]?.toUpperCase())
    .filter(Boolean)
    .join('');
};

export default function UserAvatar({ displayName, email, photoUrl, size = 'lg' }: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);
  const initials = getInitials(displayName, email);
  const classes = `flex items-center justify-center rounded-full bg-zinc-100 text-zinc-600 ${sizeMap[size]}`;

  const shouldShowImage = photoUrl && !imageError;

  return (
    <div className={classes}>
      {shouldShowImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={displayName ?? email ?? 'User avatar'}
          className="h-full w-full rounded-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <span className="font-semibold">{initials}</span>
      )}
    </div>
  );
}
