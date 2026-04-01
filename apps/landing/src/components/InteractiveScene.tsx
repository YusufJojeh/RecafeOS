import clsx from 'clsx';
import { useEffect, useRef, type ReactNode } from 'react';

interface InteractiveSceneProps {
  children: ReactNode;
  className?: string;
}

export function InteractiveScene({
  children,
  className,
}: InteractiveSceneProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const matchMedia =
      typeof window.matchMedia === 'function'
        ? window.matchMedia.bind(window)
        : null;

    const prefersReducedMotion = matchMedia
      ? matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;
    const supportsFinePointer = matchMedia
      ? matchMedia('(pointer: fine)').matches
      : false;

    if (prefersReducedMotion || !supportsFinePointer) {
      return undefined;
    }

    let frame = 0;

    const reset = () => {
      node.style.setProperty('--scene-rotate-x', '0deg');
      node.style.setProperty('--scene-rotate-y', '0deg');
      node.style.setProperty('--scene-shift-x', '0px');
      node.style.setProperty('--scene-shift-y', '0px');
      node.style.setProperty('--scene-shift-x-soft', '0px');
      node.style.setProperty('--scene-shift-y-soft', '0px');
      node.style.setProperty('--scene-shift-x-medium', '0px');
      node.style.setProperty('--scene-shift-y-medium', '0px');
      node.style.setProperty('--scene-shift-x-strong', '0px');
      node.style.setProperty('--scene-shift-y-strong', '0px');
    };

    const handleMove = (event: PointerEvent) => {
      const bounds = node.getBoundingClientRect();
      const px = (event.clientX - bounds.left) / bounds.width - 0.5;
      const py = (event.clientY - bounds.top) / bounds.height - 0.5;

      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        node.style.setProperty('--scene-rotate-x', `${py * -9}deg`);
        node.style.setProperty('--scene-rotate-y', `${px * 12}deg`);
        node.style.setProperty('--scene-shift-x', `${px * 22}px`);
        node.style.setProperty('--scene-shift-y', `${py * 18}px`);
        node.style.setProperty('--scene-shift-x-soft', `${px * 10}px`);
        node.style.setProperty('--scene-shift-y-soft', `${py * 8}px`);
        node.style.setProperty('--scene-shift-x-medium', `${px * 22}px`);
        node.style.setProperty('--scene-shift-y-medium', `${py * 18}px`);
        node.style.setProperty('--scene-shift-x-strong', `${px * 34}px`);
        node.style.setProperty('--scene-shift-y-strong', `${py * 28}px`);
      });
    };

    reset();

    node.addEventListener('pointermove', handleMove);
    node.addEventListener('pointerleave', reset);

    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener('pointermove', handleMove);
      node.removeEventListener('pointerleave', reset);
      reset();
    };
  }, []);

  return (
    <div ref={ref} className={clsx('interactive-scene', className)}>
      {children}
    </div>
  );
}
