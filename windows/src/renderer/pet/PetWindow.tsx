import { useEffect, useRef, useState } from "react";
import { processChromaKeyFrame } from "./chroma-key.ts";
import {
  nextPetPlaybackRequest,
  nextPetVisualEffectRequest
} from "./pet-playback-command.ts";
import { createPetPointerInteraction } from "./pet-pointer-interaction.ts";
import type {
  PetPlaybackMode,
  PetPlaybackRequest,
  PetVisualEffectRequest
} from "./pet-playback-command.ts";

type PetCommand =
  | {
      type: "loadVideo";
      petIndex: number;
      videoPath: string;
      mode: PetPlaybackMode;
    }
  | {
      type: "pause";
    }
  | {
      type: "playDropBounce";
    };

export function PetWindow() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const petIndexRef = useRef(0);
  const modeRef = useRef<PetPlaybackMode>("loop");
  const pointerInteractionRef = useRef<ReturnType<typeof createPetPointerInteraction> | null>(null);
  const [playbackRequest, setPlaybackRequest] = useState<PetPlaybackRequest>();
  const [visualEffectRequest, setVisualEffectRequest] = useState<PetVisualEffectRequest>();
  const [isDropBounceActive, setIsDropBounceActive] = useState(false);

  if (!pointerInteractionRef.current) {
    pointerInteractionRef.current = createPetPointerInteraction({
      onClick: () => window.desktopPet?.petClick?.(petIndexRef.current),
      onDragStarted: () => window.desktopPet?.petDragStarted?.(petIndexRef.current),
      onDragBy: (delta) => window.desktopPet?.petDragBy?.(petIndexRef.current, delta),
      onDragEnded: () => window.desktopPet?.petDragEnded?.(petIndexRef.current)
    });
  }

  useEffect(() => {
    const bridge = window.desktopPet;
    const unsubscribe = bridge?.onPetCommand?.((command) => {
      if (!isPetCommand(command)) {
        return;
      }

      if (command.type === "pause") {
        videoRef.current?.pause();
        return;
      }

      if (command.type === "playDropBounce") {
        setVisualEffectRequest((current) => nextPetVisualEffectRequest(current, "dropBounce"));
        return;
      }

      petIndexRef.current = command.petIndex;
      modeRef.current = command.mode;
      setPlaybackRequest((current) => nextPetPlaybackRequest(current, command));
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackRequest) {
      return;
    }

    video.src = playbackRequest.source;
    video.loop = playbackRequest.mode === "loop";
    void video.play();

    return () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [playbackRequest]);

  useEffect(() => {
    if (visualEffectRequest?.effect !== "dropBounce") {
      return;
    }

    setIsDropBounceActive(true);
    const timeout = window.setTimeout(() => {
      setIsDropBounceActive(false);
    }, 260);

    return () => window.clearTimeout(timeout);
  }, [visualEffectRequest]);

  useEffect(() => {
    const draw = () => {
      drawCurrentFrame(canvasRef.current, videoRef.current, offscreenCanvasRef);
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="pet-stage">
      <video
        ref={videoRef}
        className="pet-video-source"
        muted
        playsInline
        onEnded={() => {
          if (modeRef.current === "playOnce") {
            window.desktopPet?.petPlaybackEnded?.(petIndexRef.current);
          }
        }}
      />
      <canvas
        ref={canvasRef}
        className={isDropBounceActive ? "pet-canvas drop-bounce" : "pet-canvas"}
        onPointerDown={(event) => {
          pointerInteractionRef.current?.pointerDown({
            screenX: event.screenX,
            screenY: event.screenY
          });
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          pointerInteractionRef.current?.pointerMove({
            screenX: event.screenX,
            screenY: event.screenY
          });
        }}
        onPointerUp={(event) => {
          pointerInteractionRef.current?.pointerUp();
          releasePointerCaptureIfNeeded(event);
        }}
        onPointerCancel={(event) => {
          pointerInteractionRef.current?.pointerCancel();
          releasePointerCaptureIfNeeded(event);
        }}
        onLostPointerCapture={() => {
          pointerInteractionRef.current?.pointerCancel();
        }}
      />
    </div>
  );
}

function releasePointerCaptureIfNeeded(event: React.PointerEvent<HTMLCanvasElement>) {
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
}

function drawCurrentFrame(
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement | null,
  offscreenCanvasRef: React.MutableRefObject<HTMLCanvasElement | null>
) {
  if (!canvas || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    return;
  }

  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const offscreenCanvas = offscreenCanvasRef.current ?? document.createElement("canvas");
  offscreenCanvasRef.current = offscreenCanvas;
  offscreenCanvas.width = width;
  offscreenCanvas.height = height;

  const offscreenContext = offscreenCanvas.getContext("2d", { willReadFrequently: true });
  const visibleContext = canvas.getContext("2d");
  if (!offscreenContext || !visibleContext) {
    return;
  }

  offscreenContext.clearRect(0, 0, width, height);
  offscreenContext.drawImage(video, ...aspectFit(video.videoWidth, video.videoHeight, width, height));
  const frame = offscreenContext.getImageData(0, 0, width, height);
  visibleContext.clearRect(0, 0, width, height);
  visibleContext.putImageData(processChromaKeyFrame(frame), 0, 0);
}

function aspectFit(sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number) {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return [0, 0, targetWidth, targetHeight] as const;
  }

  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return [(targetWidth - width) / 2, (targetHeight - height) / 2, width, height] as const;
}

function isPetCommand(command: unknown): command is PetCommand {
  if (!command || typeof command !== "object") {
    return false;
  }

  const record = command as Record<string, unknown>;
  return record.type === "pause" || record.type === "playDropBounce" || record.type === "loadVideo";
}
