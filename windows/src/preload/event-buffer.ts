export type EventScheduler = (callback: () => void) => void;

export function createLatestEventBuffer<T>(
  schedule: EventScheduler = (callback) => queueMicrotask(callback)
) {
  const listeners = new Set<(event: T) => void>();
  let hasPendingEvent = false;
  let pendingEvent: T | undefined;
  let pendingRevision = 0;

  return {
    emit(event: T) {
      pendingEvent = event;
      hasPendingEvent = true;
      pendingRevision += 1;
      let delivered = false;
      for (const listener of listeners) {
        delivered = true;
        listener(event);
      }
      if (delivered) {
        hasPendingEvent = false;
        pendingEvent = undefined;
      }
    },
    subscribe(listener: (event: T) => void) {
      listeners.add(listener);
      if (hasPendingEvent) {
        const event = pendingEvent as T;
        const revision = pendingRevision;
        schedule(() => {
          if (!listeners.has(listener) || !hasPendingEvent || pendingRevision !== revision) {
            return;
          }

          hasPendingEvent = false;
          pendingEvent = undefined;
          listener(event);
        });
      }

      return () => {
        listeners.delete(listener);
      };
    }
  };
}
