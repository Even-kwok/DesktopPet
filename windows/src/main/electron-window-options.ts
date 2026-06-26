type WindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type WindowWebPreferences = {
  preload: string;
  contextIsolation: true;
  nodeIntegration: false;
  sandbox: true;
};

function preloadBridgePreferences(preloadPath: string): WindowWebPreferences {
  return {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  };
}

export function petWindowBrowserOptions(input: {
  bounds: WindowBounds;
  title: string;
  preloadPath: string;
}) {
  return {
    ...input.bounds,
    title: input.title,
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    focusable: false,
    resizable: false,
    minWidth: input.bounds.width,
    minHeight: input.bounds.height,
    maxWidth: input.bounds.width,
    maxHeight: input.bounds.height,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: preloadBridgePreferences(input.preloadPath)
  };
}

export function studioWindowBrowserOptions(preloadPath: string, appVersion?: string) {
  return {
    width: 560,
    height: 560,
    minWidth: 520,
    minHeight: 460,
    title: appVersion ? `CatDesktopPet v${appVersion}` : "CatDesktopPet",
    show: false,
    autoHideMenuBar: true,
    menuBarVisible: false,
    webPreferences: preloadBridgePreferences(preloadPath)
  };
}
