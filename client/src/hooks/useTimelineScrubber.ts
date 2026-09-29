import { useRef, useCallback } from 'react';
import { useTimelineStore } from '../store/useTimelineStore';

export function useTimelineScrubber(trackWidthPx: number) {
  const isDraggingRef = useRef(false);
  const { setCurrentTime, totalDuration } = useTimelineStore();

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = offsetX / rect.width;
    setCurrentTime(ratio * totalDuration);
  }, [totalDuration, setCurrentTime]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = offsetX / rect.width;
    setCurrentTime(ratio * totalDuration);
  }, [totalDuration, setCurrentTime]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, []);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
