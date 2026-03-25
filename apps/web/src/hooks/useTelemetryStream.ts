import { useEffect, useRef, useState } from "react";

import {
  fetchCurrentSession,
  fetchRecentEvents,
  fetchLatestTelemetry,
  fetchRecentAlerts,
  openTelemetrySocket,
} from "../api/client";
import type { AlertEvent, SessionRecord, SystemEvent, TelemetrySnapshot } from "../types/telemetry";

type StreamStatus = "connecting" | "connected" | "disconnected";

interface TelemetryState {
  snapshot: TelemetrySnapshot | null;
  alerts: AlertEvent[];
  events: SystemEvent[];
  session: SessionRecord | null;
  streamStatus: StreamStatus;
}

export function useTelemetryStream(): TelemetryState {
  const [snapshot, setSnapshot] = useState<TelemetrySnapshot | null>(null);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("connecting");
  const reconnectTimerRef = useRef<number | null>(null);
  const restPollTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;

    const refreshFromRest = async () => {
      const [initialSnapshot, initialAlerts, initialEvents, currentSession] = await Promise.allSettled([
        fetchLatestTelemetry(),
        fetchRecentAlerts(),
        fetchRecentEvents(),
        fetchCurrentSession(),
      ]);

      if (!active) {
        return;
      }

      if (initialSnapshot.status === "fulfilled" && initialSnapshot.value) {
        setSnapshot(initialSnapshot.value);
      }

      if (initialAlerts.status === "fulfilled") {
        setAlerts(initialAlerts.value);
      }

      if (initialEvents.status === "fulfilled") {
        setEvents(initialEvents.value);
      }

      if (currentSession.status === "fulfilled") {
        setSession(currentSession.value);
      }

      if (
        initialSnapshot.status === "rejected" &&
        initialAlerts.status === "rejected" &&
        initialEvents.status === "rejected" &&
        currentSession.status === "rejected"
      ) {
        setStreamStatus("disconnected");
      }
    };

    const clearSocketTimers = () => {
      if (heartbeatTimerRef.current !== null) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (!active || reconnectTimerRef.current !== null) {
        return;
      }
      const nextDelay = Math.min(5000, 1000 * 2 ** reconnectAttemptRef.current);
      reconnectAttemptRef.current += 1;
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        void refreshFromRest();
        connect();
      }, nextDelay);
    };

    const connect = () => {
      setStreamStatus("connecting");
      const nextSocket = openTelemetrySocket();
      socket = nextSocket;

      nextSocket.addEventListener("open", () => {
        if (!active) {
          return;
        }
        reconnectAttemptRef.current = 0;
        setStreamStatus("connected");
        heartbeatTimerRef.current = window.setInterval(() => {
          if (nextSocket.readyState === WebSocket.OPEN) {
            nextSocket.send("ping");
          }
        }, 15000);
        void refreshFromRest();
      });

      nextSocket.addEventListener("message", (event) => {
        if (!active) {
          return;
        }
        try {
          const nextSnapshot = JSON.parse(event.data) as TelemetrySnapshot;
          if (typeof nextSnapshot.schema_version !== "string") {
            return;
          }
          setSnapshot(nextSnapshot);
        } catch {
          return;
        }
      });

      nextSocket.addEventListener("close", () => {
        if (!active) {
          return;
        }
        clearSocketTimers();
        setStreamStatus("disconnected");
        scheduleReconnect();
      });

      nextSocket.addEventListener("error", () => {
        if (!active) {
          return;
        }
        clearSocketTimers();
        setStreamStatus("disconnected");
        nextSocket.close();
      });
    };

    void refreshFromRest();
    restPollTimerRef.current = window.setInterval(() => {
      void refreshFromRest();
    }, 5000);
    connect();

    return () => {
      active = false;
      clearSocketTimers();
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (restPollTimerRef.current !== null) {
        window.clearInterval(restPollTimerRef.current);
      }
      socket?.close();
    };
  }, []);

  return {
    snapshot,
    alerts,
    events,
    session,
    streamStatus,
  };
}
