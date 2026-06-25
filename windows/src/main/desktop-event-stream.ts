export type DesktopEventType =
  | "hosting_request_created"
  | "hosting_request_accepted"
  | "hosting_request_declined"
  | "pet_recalled"
  | "desktop_bundle_changed";

export type DesktopEvent = {
  id: string;
  userId: string;
  type: DesktopEventType;
  actorUserId?: string | null;
  petId?: string | null;
  hostingRequestId?: string | null;
  payload?: Record<string, unknown>;
  createdAt: string;
};

export type DesktopEventAction = "syncDesktopBundle";

type DesktopEventStreamOptions = {
  streamURL: URL;
  accessToken: string;
  fetchImpl?: typeof fetch;
  onEvent: (event: DesktopEvent) => Promise<void> | void;
  onError?: (error: unknown) => void;
  reconnectDelayMs?: number;
};

export class DesktopEventStream {
  #options: DesktopEventStreamOptions;
  #abortController: AbortController | null = null;
  #isStopped = true;
  #cursor: string | null = null;

  constructor(options: DesktopEventStreamOptions) {
    this.#options = options;
  }

  start(cursor?: string | null) {
    if (!this.#isStopped) {
      return;
    }

    this.#isStopped = false;
    this.#cursor = cursor ?? null;
    void this.#connectLoop();
  }

  stop() {
    this.#isStopped = true;
    this.#abortController?.abort();
    this.#abortController = null;
  }

  async #connectLoop() {
    while (!this.#isStopped) {
      try {
        await this.#connectOnce();
      } catch (error) {
        if (!this.#isStopped) {
          this.#options.onError?.(error);
        }
      }

      if (!this.#isStopped) {
        await sleep(this.#options.reconnectDelayMs ?? 3000);
      }
    }
  }

  async #connectOnce() {
    this.#abortController = new AbortController();
    const streamURL = new URL(this.#options.streamURL);

    if (this.#cursor) {
      streamURL.searchParams.set("after", this.#cursor);
    }

    const response = await (this.#options.fetchImpl ?? fetch)(streamURL, {
      headers: {
        Accept: "text/event-stream",
        Authorization: `Bearer ${this.#options.accessToken}`
      },
      signal: this.#abortController.signal
    });

    if (!response.ok || !response.body) {
      throw new Error("DESKTOP_EVENT_STREAM_UNAVAILABLE");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (!this.#isStopped) {
      const chunk = await reader.read();

      if (chunk.done) {
        return;
      }

      const parsed = parseDesktopEventStreamChunk(buffer, decoder.decode(chunk.value, { stream: true }));
      buffer = parsed.buffer;

      for (const event of parsed.events) {
        this.#cursor = event.id;
        await this.#options.onEvent(event);
      }
    }
  }
}

export function parseDesktopEventStreamChunk(previousBuffer: string, chunk: string) {
  const combined = `${previousBuffer}${chunk}`.replace(/\r\n/g, "\n");
  const frames = combined.split("\n\n");
  const buffer = frames.pop() ?? "";
  const events = frames
    .map(parseDesktopEventFrame)
    .filter((event): event is DesktopEvent => event !== null);

  return { buffer, events };
}

export function desktopEventAction(type: string): DesktopEventAction | null {
  switch (type) {
    case "hosting_request_accepted":
    case "pet_recalled":
    case "desktop_bundle_changed":
      return "syncDesktopBundle";
    default:
      return null;
  }
}

function parseDesktopEventFrame(frame: string): DesktopEvent | null {
  const lines = frame.split("\n");
  let eventName = "";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    const field = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line;
    const value = separatorIndex >= 0 ? line.slice(separatorIndex + 1).replace(/^ /, "") : "";

    if (field === "event") {
      eventName = value;
    } else if (field === "data") {
      dataLines.push(value);
    }
  }

  if (!eventName || dataLines.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(dataLines.join("\n")) as unknown;
    return isDesktopEvent(parsed) && parsed.type === eventName ? parsed : null;
  } catch {
    return null;
  }
}

function isDesktopEvent(value: unknown): value is DesktopEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.userId === "string" &&
    typeof record.type === "string" &&
    typeof record.createdAt === "string"
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
