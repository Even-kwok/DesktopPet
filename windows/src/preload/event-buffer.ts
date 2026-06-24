export type EventScheduler = (callback: () => void) => void;

export function createLatestEventBuffer<T>(
  schedule: EventScheduler = (callback) => queueMicrotask(callback)
) {
  const listeners = new Set<(event: T) => void>();
  let pendingEvent: T | undefined;

  return {
    emit(event: T) {
      pendingEvent = event;
      for (const listener of listeners) {
        listener(event);
      }
      if (listeners.size > 0) {
        pendingEvent = undefined;
      }
    },
    subscribe(listener: (event: T) => void) {
      listeners.add(listener);
      if (pendingEvent !== undefined) {
        const event = pendingEvent;
        pendingEvent = undefined;
        schedule(() => listener(event));
      }

      return () => {
        listeners.delete(listener);
      };
    }
  };
}
