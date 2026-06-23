import { BrowserWindow } from "electron";

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

  show() {
    const window = this.#window ?? this.#createWindow();
    this.#isVisible = true;
    if (this.#options.studioRendererURL) {
      void window.loadURL(this.#options.studioRendererURL);
    } else if (!window.webContents.getURL()) {
      void window.loadFile(this.#options.studioRendererFile);
    }
    window.show();
    window.focus();
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
