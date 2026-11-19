import { useEffect } from 'react';
import { selectCurrentTrack, usePlayerStore } from '../store/playerStore';

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"]'));
}

export function useHotkeys(): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableElement(event.target)) return;

      const target = event.target instanceof HTMLElement ? event.target : null;
      const state = usePlayerStore.getState();
      const hasTrack = Boolean(selectCurrentTrack(state));

      switch (event.code) {
        case 'Space': {
          if (target?.closest('button, a, summary, [role="button"]')) return;
          if (!hasTrack) return;
          event.preventDefault();
          state.togglePlay();
          break;
        }
        case 'ArrowLeft': {
          if (target?.closest('[role="slider"]')) return;
          if (!hasTrack) return;
          event.preventDefault();
          state.requestSeek(state.currentTime - 5);
          break;
        }
        case 'ArrowRight': {
          if (target?.closest('[role="slider"]')) return;
          if (!hasTrack) return;
          event.preventDefault();
          state.requestSeek(state.currentTime + 5);
          break;
        }
        case 'ArrowUp': {
          if (target?.closest('[role="slider"]')) return;
          event.preventDefault();
          state.setVolume(state.volume + 0.05);
          break;
        }
        case 'ArrowDown': {
          if (target?.closest('[role="slider"]')) return;
          event.preventDefault();
          state.setVolume(state.volume - 0.05);
          break;
        }
        case 'KeyM': {
          event.preventDefault();
          state.toggleMute();
          break;
        }
        case 'KeyN': {
          if (!hasTrack) return;
          event.preventDefault();
          state.next(false);
          break;
        }
        case 'KeyP': {
          if (!hasTrack) return;
          event.preventDefault();
          state.previous();
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
