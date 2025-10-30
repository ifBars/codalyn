export interface TelemetryEvent {
  event: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface TelemetryConfig {
  enabled: boolean;
  endpoint?: string;
  apiKey?: string;
}

class Telemetry {
  private config: TelemetryConfig;
  private events: TelemetryEvent[] = [];

  constructor(config: TelemetryConfig = { enabled: false }) {
    this.config = config;
  }

  track(event: string, metadata?: Record<string, unknown>): void {
    if (!this.config.enabled) {
      return;
    }

    const telemetryEvent: TelemetryEvent = {
      event,
      metadata,
      timestamp: new Date(),
    };

    this.events.push(telemetryEvent);

    // In a real implementation, send to backend
    if (this.config.endpoint) {
      this.sendEvent(telemetryEvent).catch((error) => {
        console.error("Failed to send telemetry event:", error);
      });
    }
  }

  private async sendEvent(event: TelemetryEvent): Promise<void> {
    if (!this.config.endpoint) {
      return;
    }

    try {
      await fetch(this.config.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify(event),
      });
    } catch (error) {
      console.error("Telemetry send error:", error);
    }
  }

  getEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }
}

let telemetryInstance: Telemetry | null = null;

export function initializeTelemetry(config: TelemetryConfig): Telemetry {
  telemetryInstance = new Telemetry(config);
  return telemetryInstance;
}

export function getTelemetry(): Telemetry {
  if (!telemetryInstance) {
    telemetryInstance = new Telemetry({ enabled: false });
  }
  return telemetryInstance;
}

export function track(event: string, metadata?: Record<string, unknown>): void {
  getTelemetry().track(event, metadata);
}

