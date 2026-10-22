export type InstallPlatform = "ios" | "android" | "mac-safari" | "chromium" | "other";
export type InstallPhase = "guidance" | "available" | "prompting" | "requested" | "dismissed" | "installed";
export type InstallChoice = { outcome: "accepted" | "dismissed"; platform?: string };
export type InstallPrompt = { preventDefault(): void; prompt(): Promise<InstallChoice | void>; userChoice?: Promise<InstallChoice> };
export type InstallSnapshot = { phase: InstallPhase; platform: InstallPlatform; compact: boolean; error: string | null };
type InstallEnvironment = {
  userAgent: string; platform?: string; maxTouchPoints?: number;
  standalone(): boolean;
  listen(name: "beforeinstallprompt" | "appinstalled" | "displaychange", listener: (event: InstallPrompt) => void): () => void;
  getDismissed?(): boolean; setDismissed?(value: boolean): void;
  onChange?(state: InstallSnapshot): void;
};
export function installPlatform(userAgent: string, platform = "", maxTouchPoints = 0): InstallPlatform {
  if (/iPad|iPhone|iPod/i.test(userAgent) || platform === "MacIntel" && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  if (/Macintosh/i.test(userAgent) && /Safari/i.test(userAgent) && !/Chrome|Chromium|Edg|OPR/i.test(userAgent)) return "mac-safari";
  if (/Chrome|Chromium|Edg|OPR/i.test(userAgent)) return "chromium";
  return "other";
}
export function installGuidance(platform: InstallPlatform): { title: string; steps: readonly string[]; note: string } {
  if (platform === "ios") return {
    title: "Add Lucid to your Home Screen",
    steps: ["Open this Lucid address in your browser. Safari works on every supported iPhone and iPad.", "Tap Share, then Add to Home Screen. If it is hidden, scroll down or edit the Share actions.", "Keep Open as Web App on if that switch appears, then tap Add."],
    note: "On older iOS versions, use Safari. Your browser completes installation; this button cannot add an icon by itself.",
  };
  if (platform === "mac-safari") return { title: "Add Lucid to your Dock", steps: ["In Safari, choose File, then Add to Dock.", "Check the name Lucid, then choose Add."], note: "Add to Dock is available in Safari on macOS Sonoma and later." };
  if (platform === "android") return { title: "Add Lucid as an app", steps: ["Open your browser menu.", "Choose Install app or Add to Home screen if offered, then confirm."], note: "Your browser decides whether to install an app or a Home Screen shortcut. If no option appears, try Chrome or Samsung Internet." };
  if (platform === "chromium") return { title: "Install Lucid from your browser", steps: ["Look for the install icon in the address bar, or open the browser menu.", "Choose Install Lucid or Install app, then confirm."], note: "An in-app prompt will appear here when the browser makes it available. Browser policies or an existing installation can hide it." };
  return { title: "Open Lucid like an app", steps: ["Look in your browser’s menu or Share options for Install app or Add to Home Screen.", "If your browser has no install option, open this address in a browser that supports web apps."], note: "You can keep using Lucid in this browser. Installation is optional." };
}
export function createInstallController(environment: InstallEnvironment) {
  let deferred: InstallPrompt | null = null, disposed = false;
  const compact = (() => { try { return environment.getDismissed?.() ?? false; } catch { return false; } })();
  let state: InstallSnapshot = { phase: environment.standalone() ? "installed" : "guidance", platform: installPlatform(environment.userAgent, environment.platform, environment.maxTouchPoints), compact, error: null };
  const snapshot = () => ({ ...state });
  const publish = (patch: Partial<InstallSnapshot>) => { state = { ...state, ...patch }; if (!disposed) environment.onChange?.(snapshot()); };
  const installed = () => { deferred = null; publish({ phase: "installed", error: null }); };
  const removers = [
    environment.listen("beforeinstallprompt", (event) => {
      if (state.phase === "installed" || environment.standalone() || typeof event.prompt !== "function") return;
      event.preventDefault(); deferred = event; publish({ phase: "available", error: null });
    }),
    environment.listen("appinstalled", installed),
    environment.listen("displaychange", () => { if (environment.standalone()) installed(); }),
  ];
  async function install(): Promise<"guidance" | "accepted" | "dismissed" | "busy" | "installed"> {
    if (state.phase === "installed") return "installed";
    if (state.phase === "prompting") return "busy";
    if (!deferred) return "guidance";
    // Browser prompt objects are one-shot. Clear it before awaiting or a second tap could prompt twice.
    const prompt = deferred; deferred = null; publish({ phase: "prompting", error: null });
    try {
      const immediate = await prompt.prompt();
      const choice = immediate && "outcome" in immediate ? immediate : await prompt.userChoice;
      if (disposed) return choice?.outcome === "accepted" ? "accepted" : "dismissed";
      if (snapshot().phase === "installed" || environment.standalone()) { installed(); return "installed"; }
      const accepted = choice?.outcome === "accepted";
      publish({ phase: accepted ? "requested" : "dismissed", compact: !accepted || state.compact });
      if (!accepted) { try { environment.setDismissed?.(true); } catch { /* An optional install preference must not block learning. */ } }
      return accepted ? "accepted" : "dismissed";
    } catch {
      if (!disposed && snapshot().phase !== "installed") publish({ phase: "guidance", error: "The browser could not open the install prompt. You can use its menu instead." });
      return "guidance";
    }
  }
  return {
    snapshot, install,
    dismiss() { publish({ compact: true }); try { environment.setDismissed?.(true); } catch { /* Optional preference. */ } },
    dispose() { disposed = true; deferred = null; removers.forEach((remove) => remove()); },
  };
}
// No service-worker update may refresh a page while a local write is unresolved.
export async function prepareAppReload(canReload: () => boolean, prepare?: () => boolean | Promise<boolean>): Promise<boolean> {
  if (!canReload()) return false;
  try { if (prepare && !await prepare()) return false; } catch { return false; }
  return canReload();
}
