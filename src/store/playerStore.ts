import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Track } from '../providers/types';

export type RepeatMode = 'off' | 'queue' | 'one';

export interface QueueItem {
  uid: string;
  track: Track;
}

export interface SeekRequest {
  time: number;
  seq: number;
}

interface PlaybackMetricsPatch {
  currentTime?: number;
  duration?: number;
  isBuffering?: boolean;
  playbackError?: string | null;
  visualizerFallback?: boolean;
}

interface PlayerState {
  queue: QueueItem[];
  currentIndex: number;
  isPlaying: boolean;
  isBuffering: boolean;
  playbackError: string | null;
  currentTime: number;
  savedPosition: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  previousVolume: number;
  isShuffled: boolean;
  repeatMode: RepeatMode;
  recentlyPlayed: Track[];
  isQueueOpen: boolean;
  isExpanded: boolean;
  visualizerFallback: boolean;
  seekRequest: SeekRequest | null;
  pendingRestorePosition: number | null;

  playTrack: (track: Track, contextList?: Track[]) => void;
  playQueueIndex: (index: number) => void;
  togglePlay: () => void;
  setPlaying: (playing: boolean) => void;
  next: (autoAdvance?: boolean) => void;
  previous: () => void;
  addToQueue: (track: Track) => void;
  playNext: (track: Track) => void;
  removeFromQueue: (uid: string) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  requestSeek: (time: number) => void;
  setPlaybackMetrics: (patch: PlaybackMetricsPatch) => void;
  commitSavedPosition: (time: number) => void;
  clearPendingRestore: () => void;
  setQueueOpen: (open: boolean) => void;
  toggleQueue: () => void;
  setExpanded: (expanded: boolean) => void;
}

let uidCounter = 0;

function createQueueItem(track: Track): QueueItem {
  uidCounter += 1;
  return {
    uid: `${track.id}-${Date.now().toString(36)}-${uidCounter}`,
    track,
  };
}

function pushRecentlyPlayed(list: Track[], track: Track): Track[] {
  return [track, ...list.filter((item) => item.id !== track.id)].slice(0, 20);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export const selectCurrentTrack = (state: PlayerState): Track | null => {
  if (state.currentIndex < 0 || state.currentIndex >= state.queue.length) {
    return null;
  }
  return state.queue[state.currentIndex].track;
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      currentIndex: -1,
      isPlaying: false,
      isBuffering: false,
      playbackError: null,
      currentTime: 0,
      savedPosition: 0,
      duration: 0,
      volume: 0.8,
      isMuted: false,
      previousVolume: 0.8,
      isShuffled: false,
      repeatMode: 'off',
      recentlyPlayed: [],
      isQueueOpen: false,
      isExpanded: false,
      visualizerFallback: false,
      seekRequest: null,
      pendingRestorePosition: null,

      playTrack: (track, contextList) => {
        const state = get();
        const current = selectCurrentTrack(state);

        if (current && current.id === track.id) {
          set({
            isPlaying: !state.isPlaying,
            playbackError: null,
          });
          return;
        }

        if (contextList && contextList.length > 0) {
          const hasTarget = contextList.some((item) => item.id === track.id);
          const sourceList = hasTarget ? contextList : [track, ...contextList];
          const nextQueue = sourceList.map(createQueueItem);
          const nextIndex = nextQueue.findIndex((item) => item.track.id === track.id);

          set({
            queue: nextQueue,
            currentIndex: nextIndex >= 0 ? nextIndex : 0,
            isPlaying: true,
            isBuffering: true,
            playbackError: null,
            currentTime: 0,
            savedPosition: 0,
            duration: track.duration || 0,
            pendingRestorePosition: null,
            recentlyPlayed: pushRecentlyPlayed(state.recentlyPlayed, track),
          });
          return;
        }

        const existingIndex = state.queue.findIndex((item) => item.track.id === track.id);
        if (existingIndex >= 0) {
          set({
            currentIndex: existingIndex,
            isPlaying: true,
            isBuffering: true,
            playbackError: null,
            currentTime: 0,
            savedPosition: 0,
            duration: track.duration || 0,
            pendingRestorePosition: null,
            recentlyPlayed: pushRecentlyPlayed(state.recentlyPlayed, track),
          });
          return;
        }

        const newItem = createQueueItem(track);
        const insertIndex = state.currentIndex >= 0 ? state.currentIndex + 1 : 0;
        const nextQueue = [...state.queue];
        nextQueue.splice(insertIndex, 0, newItem);

        set({
          queue: nextQueue,
          currentIndex: insertIndex,
          isPlaying: true,
          isBuffering: true,
          playbackError: null,
          currentTime: 0,
          savedPosition: 0,
          duration: track.duration || 0,
          pendingRestorePosition: null,
          recentlyPlayed: pushRecentlyPlayed(state.recentlyPlayed, track),
        });
      },

      playQueueIndex: (index) => {
        const state = get();
        if (index < 0 || index >= state.queue.length) return;
        const target = state.queue[index].track;

        if (index === state.currentIndex) {
          set({ isPlaying: !state.isPlaying, playbackError: null });
          return;
        }

        set({
          currentIndex: index,
          isPlaying: true,
          isBuffering: true,
          playbackError: null,
          currentTime: 0,
          savedPosition: 0,
          duration: target.duration || 0,
          pendingRestorePosition: null,
          recentlyPlayed: pushRecentlyPlayed(state.recentlyPlayed, target),
        });
      },

      togglePlay: () => {
        const state = get();
        if (!selectCurrentTrack(state)) return;
        set({
          isPlaying: !state.isPlaying,
          playbackError: null,
        });
      },

      setPlaying: (playing) => {
        set({ isPlaying: playing });
      },

      next: (autoAdvance = false) => {
        const state = get();
        if (state.queue.length === 0) return;

        if (autoAdvance && state.repeatMode === 'one') {
          get().requestSeek(0);
          set({ isPlaying: true, playbackError: null });
          return;
        }

        let nextIndex = -1;

        if (state.isShuffled && state.queue.length > 1) {
          let candidate = Math.floor(Math.random() * state.queue.length);
          if (candidate === state.currentIndex) {
            candidate = (candidate + 1) % state.queue.length;
          }
          nextIndex = candidate;
        } else if (state.currentIndex + 1 < state.queue.length) {
          nextIndex = state.currentIndex + 1;
        } else if (state.repeatMode === 'queue') {
          nextIndex = 0;
        }

        if (nextIndex < 0) {
          if (autoAdvance) {
            set({
              isPlaying: false,
              currentTime: 0,
              savedPosition: 0,
            });
            get().requestSeek(0);
            set({ isPlaying: false });
          }
          return;
        }

        const nextTrack = state.queue[nextIndex].track;
        set({
          currentIndex: nextIndex,
          isPlaying: true,
          isBuffering: true,
          playbackError: null,
          currentTime: 0,
          savedPosition: 0,
          duration: nextTrack.duration || 0,
          pendingRestorePosition: null,
          recentlyPlayed: pushRecentlyPlayed(state.recentlyPlayed, nextTrack),
        });
      },

      previous: () => {
        const state = get();
        if (state.queue.length === 0) return;

        if (state.currentTime > 3) {
          get().requestSeek(0);
          return;
        }

        let prevIndex = state.currentIndex - 1;
        if (prevIndex < 0) {
          if (state.repeatMode === 'queue') {
            prevIndex = state.queue.length - 1;
          } else {
            get().requestSeek(0);
            return;
          }
        }

        const prevTrack = state.queue[prevIndex].track;
        set({
          currentIndex: prevIndex,
          isPlaying: true,
          isBuffering: true,
          playbackError: null,
          currentTime: 0,
          savedPosition: 0,
          duration: prevTrack.duration || 0,
          pendingRestorePosition: null,
          recentlyPlayed: pushRecentlyPlayed(state.recentlyPlayed, prevTrack),
        });
      },

      addToQueue: (track) => {
        const state = get();
        const item = createQueueItem(track);
        const wasEmpty = state.queue.length === 0 || state.currentIndex < 0;

        set({
          queue: [...state.queue, item],
          currentIndex: wasEmpty ? 0 : state.currentIndex,
          duration: wasEmpty ? track.duration || 0 : state.duration,
          currentTime: wasEmpty ? 0 : state.currentTime,
        });
      },

      playNext: (track) => {
        const state = get();
        const item = createQueueItem(track);

        if (state.queue.length === 0 || state.currentIndex < 0) {
          set({
            queue: [item],
            currentIndex: 0,
            isPlaying: true,
            isBuffering: true,
            playbackError: null,
            currentTime: 0,
            savedPosition: 0,
            duration: track.duration || 0,
            pendingRestorePosition: null,
            recentlyPlayed: pushRecentlyPlayed(state.recentlyPlayed, track),
          });
          return;
        }

        const nextQueue = [...state.queue];
        nextQueue.splice(state.currentIndex + 1, 0, item);
        set({ queue: nextQueue });
      },

      removeFromQueue: (uid) => {
        const state = get();
        const index = state.queue.findIndex((item) => item.uid === uid);
        if (index < 0) return;

        const nextQueue = state.queue.filter((item) => item.uid !== uid);
        if (nextQueue.length === 0) {
          set({
            queue: [],
            currentIndex: -1,
            isPlaying: false,
            isBuffering: false,
            currentTime: 0,
            savedPosition: 0,
            duration: 0,
            playbackError: null,
          });
          return;
        }

        if (index < state.currentIndex) {
          set({
            queue: nextQueue,
            currentIndex: state.currentIndex - 1,
          });
          return;
        }

        if (index === state.currentIndex) {
          const nextIdx = Math.min(index, nextQueue.length - 1);
          const nextTrack = nextQueue[nextIdx].track;
          set({
            queue: nextQueue,
            currentIndex: nextIdx,
            currentTime: 0,
            savedPosition: 0,
            duration: nextTrack.duration || 0,
            pendingRestorePosition: null,
            playbackError: null,
            recentlyPlayed: state.isPlaying
              ? pushRecentlyPlayed(state.recentlyPlayed, nextTrack)
              : state.recentlyPlayed,
          });
          return;
        }

        set({ queue: nextQueue });
      },

      reorderQueue: (fromIndex, toIndex) => {
        const state = get();
        const len = state.queue.length;
        if (
          fromIndex === toIndex ||
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= len ||
          toIndex >= len
        ) {
          return;
        }

        const nextQueue = [...state.queue];
        const [moved] = nextQueue.splice(fromIndex, 1);
        nextQueue.splice(toIndex, 0, moved);

        let nextCurrentIndex = state.currentIndex;
        if (state.currentIndex === fromIndex) {
          nextCurrentIndex = toIndex;
        } else if (fromIndex < state.currentIndex && toIndex >= state.currentIndex) {
          nextCurrentIndex = state.currentIndex - 1;
        } else if (fromIndex > state.currentIndex && toIndex <= state.currentIndex) {
          nextCurrentIndex = state.currentIndex + 1;
        }

        set({
          queue: nextQueue,
          currentIndex: nextCurrentIndex,
        });
      },

      clearQueue: () => {
        set({
          queue: [],
          currentIndex: -1,
          isPlaying: false,
          isBuffering: false,
          currentTime: 0,
          savedPosition: 0,
          duration: 0,
          playbackError: null,
          pendingRestorePosition: null,
        });
      },

      setVolume: (volume) => {
        const clamped = clamp(volume, 0, 1);
        set((state) => ({
          volume: clamped,
          isMuted: clamped === 0,
          previousVolume: clamped > 0 ? clamped : state.previousVolume,
        }));
      },

      toggleMute: () => {
        const state = get();
        if (state.isMuted || state.volume === 0) {
          const restored = state.previousVolume > 0 ? state.previousVolume : 0.8;
          set({
            isMuted: false,
            volume: restored,
          });
        } else {
          set({
            isMuted: true,
            previousVolume: state.volume > 0 ? state.volume : 0.8,
          });
        }
      },

      toggleShuffle: () => {
        set((state) => ({ isShuffled: !state.isShuffled }));
      },

      cycleRepeatMode: () => {
        set((state) => {
          const nextMode: RepeatMode =
            state.repeatMode === 'off'
              ? 'queue'
              : state.repeatMode === 'queue'
                ? 'one'
                : 'off';
          return { repeatMode: nextMode };
        });
      },

      requestSeek: (time) => {
        const state = get();
        const maxDuration = state.duration > 0 ? state.duration : time;
        const clamped = clamp(time, 0, maxDuration);
        set({
          currentTime: clamped,
          savedPosition: clamped,
          seekRequest: {
            time: clamped,
            seq: (state.seekRequest?.seq ?? 0) + 1,
          },
        });
      },

      setPlaybackMetrics: (patch) => {
        set((state) => ({
          ...state,
          ...patch,
        }));
      },

      commitSavedPosition: (time) => {
        const state = get();
        const maxDuration = state.duration > 0 ? state.duration : time;
        set({ savedPosition: clamp(time, 0, maxDuration) });
      },

      clearPendingRestore: () => {
        set({ pendingRestorePosition: null });
      },

      setQueueOpen: (open) => {
        set({ isQueueOpen: open });
      },

      toggleQueue: () => {
        set((state) => ({ isQueueOpen: !state.isQueueOpen }));
      },

      setExpanded: (expanded) => {
        set({ isExpanded: expanded });
      },
    }),
    {
      name: 'wave-player',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        volume: state.volume,
        isMuted: state.isMuted,
        previousVolume: state.previousVolume,
        repeatMode: state.repeatMode,
        isShuffled: state.isShuffled,
        queue: state.queue.slice(0, 100),
        currentIndex: state.currentIndex,
        savedPosition: state.savedPosition,
        recentlyPlayed: state.recentlyPlayed.slice(0, 20),
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        const validQueue = Array.isArray(state.queue)
          ? state.queue.filter(
              (item): item is QueueItem =>
                Boolean(item && typeof item.uid === 'string' && item.track && item.track.id),
            )
          : [];

        let nextIndex =
          typeof state.currentIndex === 'number' &&
          state.currentIndex >= 0 &&
          state.currentIndex < validQueue.length
            ? state.currentIndex
            : validQueue.length > 0
              ? 0
              : -1;

        const currentTrack = nextIndex >= 0 ? validQueue[nextIndex].track : null;
        const duration = currentTrack?.duration ?? 0;
        const saved =
          typeof state.savedPosition === 'number' && state.savedPosition > 0
            ? duration > 0
              ? Math.min(state.savedPosition, duration)
              : state.savedPosition
            : 0;

        state.queue = validQueue;
        state.currentIndex = nextIndex;
        state.duration = duration;
        state.currentTime = saved;
        state.savedPosition = saved;
        state.pendingRestorePosition = currentTrack && saved > 0 ? saved : null;
        state.isPlaying = false;
        state.isBuffering = false;
        state.playbackError = null;
      },
    },
  ),
);
