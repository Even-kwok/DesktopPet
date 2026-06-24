import { BrowserWindow } from "electron";
import { videoMetadataProbeScriptForLocalPath } from "../shared/local-video-metadata-script.ts";

export type LocalVideoMetadata = {
  durationSeconds: number;
  hasVideoTrack: boolean;
  readError?: boolean;
};

export async function probeLocalVideoMetadata(videoPath: string): Promise<LocalVideoMetadata> {
  const probeWindow = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // The hidden data-page probe needs to read a user-selected file:// video.
      webSecurity: false
    }
  });

  try {
    await probeWindow.loadURL("data:text/html;charset=utf-8,<html><body></body></html>");
    return (await probeWindow.webContents.executeJavaScript(
      videoMetadataProbeScriptForLocalPath(videoPath),
      true
    )) as LocalVideoMetadata;
  } finally {
    if (!probeWindow.isDestroyed()) {
      probeWindow.destroy();
    }
  }
}
