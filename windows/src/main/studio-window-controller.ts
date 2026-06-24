import { BrowserWindow } from "electron";
import { studioWindowBrowserOptions } from "./electron-window-options.js";
import {
  studioCommandDispatchPlan,
  studioRendererLoadTarget
} from "./studio-window-policy.js";
import type { StudioWindowCommand } from "./studio-window-policy.js";
import { ipcChannels } from "./ipc.js";
import { nextRendererShowRevision } from "./renderer-load-policy.js";

export type StudioWindowControllerOptions = {
  preloadPath: string;
  studioRendererURL?: string;
  studioRendererFile: string;
};

export class StudioWindowController {
  readonly #options: StudioWindowControllerOptions;
  #window?: BrowserWindow;
  #isVisible = false;
  #showRevision = 0;

  constructor(options: StudioWindowControllerOptions) {
    this.#options = options;
  }

  get isVisible() {
    return this.#window?.isVisible() ?? this.#isVisible;
  }

  show(command?: StudioWindowCommand) {
    const window = this.#window ?? this.#createWindow();
    this.#isVisible = true;
    const showRevision = this.#nextShowRevision();
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
    const sendCommand = () => {
      const showCommand = studioCommandDispatchPlan({
        command,
        requestRevision: showRevision,
        currentRevision: this.#showRevision,
        isVisible: this.#isVisible
      });
      if (showCommand) {
        window.webContents.send(ipcChannels.studioCommand, showCommand);
      }
    };
    if (loadPromise) {
      void loadPromise.then(sendCommand).catch(() => {});
    } else {
      sendCommand();
    }
  }

  hide() {
    this.#nextShowRevision();
    this.#isVisible = false;
    this.#window?.hide();
  }

  #createWindow() {
    const window = new BrowserWindow(studioWindowBrowserOptions(this.#options.preloadPath));

    window.on("closed", () => {
      this.#window = undefined;
      this.#isVisible = false;
    });

    this.#window = window;
    return window;
  }

  #nextShowRevision() {
    this.#showRevision = nextRendererShowRevision(this.#showRevision);
    return this.#showRevision;
  }
}
