import { localVideoSourceURL } from "./local-video-url.ts";

const metadataProbeTimeoutMs = 10000;

export function videoMetadataProbeScriptForLocalPath(videoPath: string) {
  return videoMetadataProbeScript(localVideoSourceURL(videoPath));
}

export function videoMetadataProbeScript(videoURL: string) {
  return `
    new Promise((resolve) => {
      const video = document.createElement("video");
      let finished = false;
      const finish = (metadata) => {
        if (finished) {
          return;
        }
        finished = true;
        video.removeAttribute("src");
        video.load();
        resolve(metadata);
      };
      const timeout = window.setTimeout(() => {
        finish({ durationSeconds: 0, hasVideoTrack: false, readError: true });
      }, ${metadataProbeTimeoutMs});
      video.preload = "metadata";
      video.muted = true;
      video.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        finish({
          durationSeconds: Number.isFinite(video.duration) ? video.duration : 0,
          hasVideoTrack: video.videoWidth > 0 && video.videoHeight > 0,
          readError: false
        });
      };
      video.onerror = () => {
        window.clearTimeout(timeout);
        finish({ durationSeconds: 0, hasVideoTrack: false, readError: true });
      };
      video.src = ${JSON.stringify(videoURL)};
    })
  `;
}
