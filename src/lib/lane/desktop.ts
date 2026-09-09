export type LaneDesktopApi = {
  isDesktop: true;
  connect: (
    marketplace: string,
    opts?: {
      pairingToken?: string;
      origin?: string;
      connectId?: string;
      connectSecret?: string;
    },
  ) => Promise<{ ok: boolean; error?: string; username?: string }>;
  setPairing?: (token: string, origin: string) => Promise<{ ok: boolean }>;
  setAppUrl?: (url: string) => Promise<{ ok: boolean; appUrl?: string }>;
  config?: () => Promise<{ appUrl?: string; pairingToken?: string }>;
};

declare global {
  interface Window {
    lane?: LaneDesktopApi;
    laneDesktop?: LaneDesktopApi;
  }
}

export function desktopApi(): LaneDesktopApi | null {
  if (typeof window === "undefined") return null;
  return window.lane ?? window.laneDesktop ?? null;
}
