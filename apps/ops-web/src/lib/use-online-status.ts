import { useEffect, useState } from 'react';

function readOnlineStatus(): boolean {
  if (typeof navigator === 'undefined') {
    return true;
  }
  return navigator.onLine !== false;
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(readOnlineStatus);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}
