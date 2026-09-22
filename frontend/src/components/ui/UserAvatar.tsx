import React, { useEffect, useState } from 'react';
import { authFileUrl } from '../../lib/api';

const FALLBACK = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%20100'%3E%3Crect%20width='100'%20height='100'%20fill='%23e2e8f0'/%3E%3Ccircle%20cx='50'%20cy='38'%20r='19'%20fill='%2394a3b8'/%3E%3Cpath%20d='M19%2092c4-20%2016-28%2031-28s27%208%2031%2028z'%20fill='%2394a3b8'/%3E%3C/svg%3E";

interface UserAvatarProps {
  userId?: number;
  avatarPath?: string;
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({ userId, avatarPath, className }) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (userId && avatarPath) {
      // cache key per avatar so a re-uploaded photo is re-fetched
      authFileUrl(`/avatar/${userId}?v=${encodeURIComponent(avatarPath)}`)
        .then((u) => { if (active) setSrc(u); })
        .catch(() => { if (active) setSrc(null); });
    } else {
      setSrc(null);
    }
    return () => { active = false; };
  }, [userId, avatarPath]);

  return <img src={src || FALLBACK} alt="Avatar" className={className} />;
};
