import { useEffect, useRef, useState } from "react";
import { hasVisibleChromaKeyContent, processChromaKeyFrame } from "./chroma-key.ts";
import {
  nextPetPlaybackRequest,
  nextPetVisualEffectRequest,
  petCommandFromUnknown
} from "./pet-playback-command.ts";
import { createPetPointerInteraction } from "./pet-pointer-interaction.ts";
import type {
  PetPlaybackRequest,
  PetVisualEffectRequest
} from "./pet-playback-command.ts";
import { playOnceRecoveryDelayMs } from "./pet-playback-command.ts";

export function PetWindow() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const petIndexRef = useRef(0);
  const pointerInteractionRef = useRef<ReturnType<typeof createPetPointerInteraction> | null>(null);
  const [playbackRequest, setPlaybackRequest] = useState<PetPlaybackRequest>();
  const [visualEffectRequest, setVisualEffectRequest] = useState<PetVisualEffectRequest>();
  const [isDropBounceActive, setIsDropBounceActive] = useState(false);

  if (!pointerInteractionRef.current) {
    pointerInteractionRef.current = createPetPointerInteraction({
      onClick: () => window.desktopPet?.petClick?.(petIndexRef.current),
      onDragBy: (delta) => window.desktopPet?.petDragBy?.(petIndexRef.current, delta)
    });
  }

  useEffect(() => {
    const bridge = window.desktopPet;
    const unsubscribe = bridge?.onPetCommand?.((rawCommand) => {
      const command = petCommandFromUnknown(rawCommand);
      if (!command) {
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
    let recoveryTimeout: number | undefined;
    let didNotifyPlaybackEnded = false;
    const clearRecoveryTimeout = () => {
      if (recoveryTimeout !== undefined) {
        window.clearTimeout(recoveryTimeout);
        recoveryTimeout = undefined;
      }
    };
    const notifyPlaybackEnded = () => {
      if (playbackRequest.mode === "playOnce" && !didNotifyPlaybackEnded) {
        didNotifyPlaybackEnded = true;
        clearRecoveryTimeout();
        window.desktopPet?.petPlaybackEnded?.(petIndexRef.current);
      }
    };
    const armRecoveryTimeout = () => {
      clearRecoveryTimeout();
      if (playbackRequest.mode !== "playOnce") {
        return;
      }

      recoveryTimeout = window.setTimeout(
        notifyPlaybackEnded,
        playOnceRecoveryDelayMs(video.duration)
      );
    };
    const handleEnded = () => {
      notifyPlaybackEnded();
    };
    const handleError = () => {
      notifyPlaybackEnded();
    };
    const handleLoadedMetadata = () => {
      armRecoveryTimeout();
    };

    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", handleError);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    armRecoveryTimeout();
    void video.play().catch(handleError);

    return () => {
      clearRecoveryTimeout();
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("error", handleError);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
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
  const keyedFrame = processChromaKeyFrame(frame);
  if (!hasVisibleChromaKeyContent(keyedFrame)) {
    return;
  }

  visibleContext.clearRect(0, 0, width, height);
  visibleContext.putImageData(keyedFrame, 0, 0);
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
