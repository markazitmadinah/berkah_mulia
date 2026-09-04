import React, { useEffect, useState } from 'react';
import { authFileUrl } from '../../lib/api';

const FALLBACK = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80';

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
