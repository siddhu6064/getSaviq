import { useEffect, useRef } from "react";

/**
 * Returns a ref that is true while the component is mounted and false after
 * unmount — use it to guard state updates in async callbacks that may
 * resolve after the component is gone.
 */
export function useIsMounted() {
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return isMounted;
}
