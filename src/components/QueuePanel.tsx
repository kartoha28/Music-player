import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';
import { GripVertical, ListMusic, Pause, Play, Trash2, X } from 'lucide-react';
import { useEffect } from 'react';
import { selectCurrentTrack, usePlayerStore, type QueueItem } from '../store/playerStore';
import { formatCountWithUnit, formatDuration, handleArtworkError } from '../utils/format';
import { GlassButton } from './GlassButton';

interface SortableQueueRowProps {
  item: QueueItem;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  onSelect: (index: number) => void;
  onRemove: (uid: string) => void;
}

function SortableQueueRow({
  item,
  index,
  isCurrent,
  isPlaying,
  onSelect,
  onRemove,
}: SortableQueueRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.uid,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'group flex items-center gap-2.5 rounded-2xl border p-2 transition-colors',
        isCurrent
          ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
          : 'border-[var(--glass-border-subtle)] bg-[var(--glass-bg)] hover:bg-[var(--glass-bg-hover)]',
        isDragging ? 'z-20 opacity-90 shadow-2xl scale-[1.01]' : '',
      ].join(' ')}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Змінити порядок: ${item.track.title}`}
        className="flex h-8 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-grab active:cursor-grabbing bg-transparent border-0 p-0 touch-none"
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => onSelect(index)}
        aria-label={
          isCurrent && isPlaying
            ? `Призупинити ${item.track.title}`
            : `Відтворити ${item.track.title}`
        }
        className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-elevated)] cursor-pointer border-0 p-0"
      >
        <img
          src={item.track.artworkThumbnailUrl || item.track.artworkUrl}
          alt=""
          width={40}
          height={40}
          loading="lazy"
          decoding="async"
          onError={(event) => handleArtworkError(event, item.track.artworkMirrors)}
          className="h-full w-full object-cover"
        />
        <span
          className={[
            'absolute inset-0 flex items-center justify-center bg-black/45 text-white transition-opacity',
            isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
          ].join(' ')}
        >
          {isCurrent && isPlaying ? (
            <Pause className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current translate-x-0.5" aria-hidden="true" />
          )}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onSelect(index)}
        className="min-w-0 flex-1 text-left bg-transparent border-0 p-0 cursor-pointer"
      >
        <p
          className={`m-0 truncate text-sm font-medium ${
            isCurrent ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
          }`}
        >
          {item.track.title}
        </p>
        <p className="m-0 truncate text-xs text-[var(--text-secondary)]">{item.track.artist}</p>
      </button>

      <span className="text-xs text-[var(--text-muted)] tabular-nums shrink-0">
        {formatDuration(item.track.duration)}
      </span>

      <button
        type="button"
        onClick={() => onRemove(item.uid)}
        aria-label={`Видалити ${item.track.title} з черги`}
        title="Видалити з черги"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--glass-bg)] hover:text-rose-400 transition-colors cursor-pointer bg-transparent border-0"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function QueuePanel() {
  const isQueueOpen = usePlayerStore((s) => s.isQueueOpen);
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const currentTrack = usePlayerStore(selectCurrentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const setQueueOpen = usePlayerStore((s) => s.setQueueOpen);
  const playQueueIndex = usePlayerStore((s) => s.playQueueIndex);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const reorderQueue = usePlayerStore((s) => s.reorderQueue);
  const clearQueue = usePlayerStore((s) => s.clearQueue);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    if (!isQueueOpen) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setQueueOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isQueueOpen, setQueueOpen]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = queue.findIndex((item) => item.uid === active.id);
    const newIndex = queue.findIndex((item) => item.uid === over.id);
    if (oldIndex >= 0 && newIndex >= 0) {
      reorderQueue(oldIndex, newIndex);
    }
  };

  return (
    <AnimatePresence>
      {isQueueOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setQueueOpen(false)}
            aria-hidden="true"
            className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]"
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Черга відтворення"
            initial={{ opacity: 0, x: 36, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 36, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className="fixed top-3 right-3 bottom-3 left-3 sm:left-auto sm:w-[400px] lg:bottom-[calc(var(--player-bar-height)+1.75rem)] z-50 glass-panel-strong flex flex-col overflow-hidden"
          >
            <header className="flex items-center justify-between gap-3 border-b border-[var(--glass-border-subtle)] px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-[var(--text-primary)] m-0">
                  Черга відтворення
                </h2>
                <p className="text-xs text-[var(--text-muted)] m-0 mt-0.5">
                  {formatCountWithUnit(queue.length, 'трек', 'треки', 'треків')}
                  {currentTrack ? ` · Зараз: ${currentTrack.title}` : ''}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {queue.length > 0 && (
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    onClick={clearQueue}
                    aria-label="Очистити чергу"
                  >
                    Очистити
                  </GlassButton>
                )}

                <GlassButton
                  variant="glass"
                  size="icon"
                  onClick={() => setQueueOpen(false)}
                  aria-label="Закрити чергу"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </GlassButton>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
              {queue.length === 0 ? (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center px-4 gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--accent)]">
                    <ListMusic className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)] m-0">
                      Черга поки порожня
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] m-0 max-w-xs">
                      Запустіть будь-який трек або скористайтеся кнопкою «Додати в чергу».
                    </p>
                  </div>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={queue.map((item) => item.uid)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {queue.map((item, idx) => (
                        <SortableQueueRow
                          key={item.uid}
                          item={item}
                          index={idx}
                          isCurrent={idx === currentIndex}
                          isPlaying={isPlaying}
                          onSelect={playQueueIndex}
                          onRemove={removeFromQueue}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
