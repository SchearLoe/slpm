import React, { useState } from 'react';
import { clsx } from 'clsx';

interface AvatarProps {
  /** 后端 User.avatar：可能是首字母（如 "BR"）或图片相对路径（如 "avatars/xxx.png"） */
  avatar?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  /** 在线绿点（可选） */
  online?: boolean;
}

/**
 * P6-E9：统一头像组件。
 *
 * - 当 avatar 是图片路径（以 'avatars/' 开头或含 '/'）→ 渲染 <img>，加载失败回退首字母；
 * - 否则 → 渲染首字母（取 name 前 1-2 字符大写）。
 *
 * 替代散落各处的 `c.author.avatar || c.author.name.slice(0,1)` 不一致逻辑。
 */
export const Avatar: React.FC<AvatarProps> = ({ avatar, name, size = 'sm', className, online }) => {
  const [imgError, setImgError] = useState(false);
  const isImage = !!avatar && (avatar.startsWith('avatars/') || avatar.includes('/')) && !imgError;

  const sizeCls = {
    xs: 'w-5 h-5 text-[9px]',
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-[11px]',
    lg: 'w-12 h-12 text-[14px]',
  }[size];

  const initial = (name || '?').trim().slice(0, 2).toUpperCase() || '?';
  const imgSrc = avatar?.startsWith('avatars/')
    ? `/api/auth/avatar/${avatar.split('/').pop()}`
    : avatar?.includes('/')
      ? avatar
      : null;

  return (
    <span className={clsx('relative inline-flex shrink-0', className)}>
      <span
        className={clsx(
          'rounded-full bg-emerald-500/20 text-emerald-200 flex items-center justify-center font-bold overflow-hidden',
          sizeCls,
        )}
      >
        {isImage && imgSrc ? (
          <img
            src={imgSrc}
            alt={name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          initial
        )}
      </span>
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-black/40 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
      )}
    </span>
  );
};
