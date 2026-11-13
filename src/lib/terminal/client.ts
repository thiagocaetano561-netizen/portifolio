"use client";

import type { SignalKind, SignalResponse, TerminalResponse, UiStateResponse } from "./protocol";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const ACTIVE_KEY = "tp_active";

/**
 * Marca local (não sensível) de que este navegador já conversou com a API.
 * Serve apenas para não consultar /api/ui em visitas casuais — a autorização
 * de verdade é sempre a sessão no servidor.
 */
export function hasActiveSession(): boolean {
  try {
    return localStorage.getItem(ACTIVE_KEY) === "1";
  } catch {
    return false;
  }
}

function markActive() {
  try {
    localStorage.setItem(ACTIVE_KEY, "1");
  } catch {
    /* armazenamento indisponível */
  }
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-tryggport-client": "1" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let message = "falha de comunicação";
    try {
      const json = (await res.json()) as { error?: string };
      if (typeof json.error === "string") message = json.error.slice(0, 120);
    } catch {
      /* corpo inválido: mantém a mensagem genérica */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export async function sendCommand(input: string, signal?: AbortSignal) {
  const res = await post<TerminalResponse>("/api/terminal", { input }, signal);
  markActive();
  return res;
}

export async function sendSignal(kind: SignalKind) {
  const res = await post<SignalResponse>("/api/signal", { kind });
  markActive();
  return res;
}

export function fetchUi() {
  return post<UiStateResponse>("/api/ui", {});
}
