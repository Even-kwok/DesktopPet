import { useEffect, useRef, useState } from "react";
import { processChromaKeyFrame } from "./chroma-key.ts";

type PetPlaybackMode = "loop" | "playOnce";

type PetCommand =
  | {
      type: "loadVideo";
      petIndex: number;
      videoPath: string;
      mode: PetPlaybackMode;
    }
  | {
      type: "pause";
    };

export function PetWindow() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDragLocationRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartLocationRef = useRef<{ x: number; y: number } | null>(null);
  const movedDuringClickRef = useRef(false);
  const dragStartedRef = useRef(false);
  const petIndexRef = useRef(0);
  const modeRef = useRef<PetPlaybackMode>("loop");
  const [videoSource, setVideoSource] = useState("");

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

      petIndexRef.current = command.petIndex;
      modeRef.current = command.mode;
      setVideoSource(toVideoSource(command.videoPath));
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSource) {
      return;
    }

    video.src = videoSource;
    video.loop = modeRef.current === "loop";
    void video.play();

    return () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [videoSource]);

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
        className="pet-canvas"
        onPointerDown={(event) => {
          lastDragLocationRef.current = { x: event.screenX, y: event.screenY };
          dragStartLocationRef.current = { x: event.screenX, y: event.screenY };
          movedDuringClickRef.current = false;
          dragStartedRef.current = false;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const lastLocation = lastDragLocationRef.current;
          const dragStartLocation = dragStartLocationRef.current;
          if (!lastLocation || !dragStartLocation) {
            return;
          }

          const totalX = event.screenX - dragStartLocation.x;
          const totalY = event.screenY - dragStartLocation.y;
          if (Math.hypot(totalX, totalY) > 3) {
            if (!dragStartedRef.current) {
              dragStartedRef.current = true;
              window.desktopPet?.petDragStarted?.(petIndexRef.current);
            }
            movedDuringClickRef.current = true;
          }

          const delta = {
            x: event.screenX - lastLocation.x,
            y: event.screenY - lastLocation.y
          };
          lastDragLocationRef.current = { x: event.screenX, y: event.screenY };

          if (delta.x !== 0 || delta.y !== 0) {
            window.desktopPet?.petDragBy?.(petIndexRef.current, delta);
          }
        }}
        onPointerUp={(event) => {
          if (!movedDuringClickRef.current) {
            window.desktopPet?.petClick?.(petIndexRef.current);
          } else if (dragStartedRef.current) {
            window.desktopPet?.petDragEnded?.(petIndexRef.current);
          }

          lastDragLocationRef.current = null;
          dragStartLocationRef.current = null;
          movedDuringClickRef.current = false;
          dragStartedRef.current = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
      />
    </div>
  );
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

function toVideoSource(videoPath: string) {
  if (/^(file|https?|blob):/i.test(videoPath)) {
    return videoPath;
  }

  const normalizedPath = videoPath.replace(/\\/g, "/");
  return normalizedPath.startsWith("/")
    ? `file://${encodeURI(normalizedPath)}`
    : `file:///${encodeURI(normalizedPath)}`;
}

function isPetCommand(command: unknown): command is PetCommand {
  if (!command || typeof command !== "object") {
    return false;
  }

  const record = command as Record<string, unknown>;
  return record.type === "pause" || record.type === "loadVideo";
}
