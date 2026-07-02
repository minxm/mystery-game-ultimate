'use client';

import Image from 'next/image';
import { getAvatarPlaceholder, isAvatarPlaceholder } from '@/lib/placeholder';

type CharacterPortraitProps = {
  name: string;
  imageUrl?: string | null;
  alt?: string;
  className?: string;
  imageClassName?: string;
  broken?: boolean;
  onBroken?: () => void;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
};

/** 人物肖像：占位 SVG 走背景图，AI 图走 img/Image，避免 Next Image 误伤 svg data URI */
export function CharacterPortrait({
  name,
  imageUrl,
  alt,
  className = '',
  imageClassName = 'object-cover',
  broken = false,
  onBroken,
  fill = true,
  sizes,
  priority,
}: CharacterPortraitProps) {
  const placeholder = getAvatarPlaceholder(name);
  const useRealImage = !!imageUrl && !isAvatarPlaceholder(imageUrl) && !broken;

  if (!useRealImage) {
    return (
      <div
        className={`bg-cover bg-center ${className}`}
        style={{ backgroundImage: `url("${placeholder}")` }}
        role="img"
        aria-label={alt ?? name}
      />
    );
  }

  if (fill) {
    return (
      <Image
        src={imageUrl}
        alt={alt ?? name}
        fill
        className={imageClassName}
        unoptimized
        sizes={sizes}
        priority={priority}
        onError={onBroken}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={alt ?? name}
      className={`${imageClassName} ${className}`}
      onError={onBroken}
    />
  );
}
