export type PetPointerLocation = {
  screenX: number;
  screenY: number;
};

export type PetPointerInteractionHandlers = {
  onClick: () => void;
  onDragStarted: () => void;
  onDragBy: (delta: { x: number; y: number }) => void;
  onDragEnded: () => void;
};

export function createPetPointerInteraction(
  handlers: PetPointerInteractionHandlers,
  clickDragThreshold = 3
) {
  let lastDragLocation: PetPointerLocation | undefined;
  let dragStartLocation: PetPointerLocation | undefined;
  let movedDuringClick = false;
  let dragStarted = false;

  function reset() {
    lastDragLocation = undefined;
    dragStartLocation = undefined;
    movedDuringClick = false;
    dragStarted = false;
  }

  return {
    pointerDown(location: PetPointerLocation) {
      lastDragLocation = location;
      dragStartLocation = location;
      movedDuringClick = false;
      dragStarted = false;
    },
    pointerMove(location: PetPointerLocation) {
      if (!lastDragLocation || !dragStartLocation) {
        return;
      }

      const totalX = location.screenX - dragStartLocation.screenX;
      const totalY = location.screenY - dragStartLocation.screenY;
      if (Math.hypot(totalX, totalY) > clickDragThreshold) {
        if (!dragStarted) {
          dragStarted = true;
          handlers.onDragStarted();
        }
        movedDuringClick = true;
      }

      const delta = {
        x: location.screenX - lastDragLocation.screenX,
        y: location.screenY - lastDragLocation.screenY
      };
      lastDragLocation = location;

      if (delta.x !== 0 || delta.y !== 0) {
        handlers.onDragBy(delta);
      }
    },
    pointerUp() {
      if (!lastDragLocation) {
        return;
      }

      if (!movedDuringClick) {
        handlers.onClick();
      } else if (dragStarted) {
        handlers.onDragEnded();
      }

      reset();
    },
    pointerCancel() {
      if (dragStarted) {
        handlers.onDragEnded();
      }

      reset();
    }
  };
}
