import { BrowserWindow } from "electron";
import { studioCommandForShow, studioRendererLoadTarget } from "./studio-window-policy.js";
import type { StudioWindowCommand } from "./studio-window-policy.js";
import { ipcChannels } from "./ipc.js";

export type StudioWindowControllerOptions = {
  preloadPath: string;
  studioRendererURL?: string;
  studioRendererFile: string;
};

export class StudioWindowController {
  readonly #options: StudioWindowControllerOptions;
  #window?: BrowserWindow;
  #isVisible = false;

  constructor(options: StudioWindowControllerOptions) {
    this.#options = options;
  }

  get isVisible() {
    return this.#window?.isVisible() ?? this.#isVisible;
  }

  show(command?: StudioWindowCommand) {
    const window = this.#window ?? this.#createWindow();
    this.#isVisible = true;
    const loadTarget = studioRendererLoadTarget({
      currentURL: window.webContents.getURL(),
      studioRendererURL: this.#options.studioRendererURL,
      studioRendererFile: this.#options.studioRendererFile
    });
    let loadPromise: Promise<void> | undefined;
    if (loadTarget.type === "url") {
      loadPromise = window.loadURL(loadTarget.value);
    } else if (loadTarget.type === "file") {
      loadPromise = window.loadFile(loadTarget.value);
    }
    window.show();
    window.focus();
    const showCommand = studioCommandForShow(command);
    const sendCommand = () => window.webContents.send(ipcChannels.studioCommand, showCommand);
    if (loadPromise) {
      void loadPromise.then(sendCommand).catch(() => {});
    } else {
      sendCommand();
    }
  }

  hide() {
    this.#isVisible = false;
    this.#window?.hide();
  }

  #createWindow() {
    const window = new BrowserWindow({
      width: 560,
      height: 560,
      minWidth: 520,
      minHeight: 460,
      title: "CatDesktopPet",
      show: false,
      webPreferences: {
        preload: this.#options.preloadPath,
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    window.on("closed", () => {
      this.#window = undefined;
      this.#isVisible = false;
    });

    this.#window = window;
    return window;
  }
}
