"use client";

import { useEffect, useRef, useState } from "react";
import { createInstallController, installGuidance, prepareAppReload, type InstallPrompt, type InstallSnapshot } from "../lib/pwa-install";

type Props = { canReload?: boolean; prepareReload?: () => boolean | Promise<boolean>; promoteInstall?: boolean };
const initial: InstallSnapshot = { phase: "guidance", platform: "other", compact: false, error: null };
export default function PWAInstall({ canReload = false, prepareReload, promoteInstall = true }: Props) {
  const [install, setInstall] = useState(initial);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [notice, setNotice] = useState("");
  const [offlineStatus, setOfflineStatus] = useState<"preparing" | "ready" | "incomplete" | "unsupported">("preparing");
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const installController = useRef<ReturnType<typeof createInstallController> | null>(null);
  const waitingWorker = useRef<ServiceWorker | null>(null);
  const reloadApproved = useRef(false);
  const updateTimer = useRef<number | undefined>(undefined);
  const guards = useRef({ canReload, prepareReload });
  useEffect(() => { guards.current = { canReload, prepareReload }; }, [canReload, prepareReload]);

  useEffect(() => {
    const display = window.matchMedia("(display-mode: standalone)");
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    const controller = createInstallController({
      userAgent: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints,
      standalone: () => display.matches || navigatorWithStandalone.standalone === true,
      getDismissed: () => sessionStorage.getItem("lucid-install-dismissed-v1") === "yes",
      setDismissed: (value) => sessionStorage.setItem("lucid-install-dismissed-v1", value ? "yes" : "no"),
      listen: (name, listener) => {
        const handler = (event: Event) => listener(event as unknown as InstallPrompt);
        if (name === "displaychange") { display.addEventListener("change", handler); return () => display.removeEventListener("change", handler); }
        window.addEventListener(name, handler); return () => window.removeEventListener(name, handler);
      },
      onChange: setInstall,
    });
    installController.current = controller;
    // Browser installation state is available only after the server-rendered view hydrates.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInstall(controller.snapshot());
    return () => { controller.dispose(); installController.current = null; };
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOfflineStatus("unsupported"); return;
    }
    let disposed = false;
    const removers: (() => void)[] = [];
    let hadController = Boolean(navigator.serviceWorker.controller);
    let queryId = 0;
    const verifyOffline = () => {
      const worker = navigator.serviceWorker.controller;
      if (!worker) return;
      const id = ++queryId, channel = new MessageChannel();
      const timer = window.setTimeout(() => {
        channel.port1.close();
        if (!disposed && id === queryId && navigator.serviceWorker.controller === worker) setOfflineStatus("incomplete");
      }, 8000);
      const cleanup = () => { window.clearTimeout(timer); channel.port1.close(); };
      removers.push(cleanup);
      channel.port1.onmessage = (event: MessageEvent<unknown>) => {
        cleanup();
        if (disposed || id !== queryId || navigator.serviceWorker.controller !== worker) return;
        const value = event.data as { type?: unknown; ready?: unknown } | null;
        setOfflineStatus(value?.type === "LUCID_OFFLINE_STATUS" && value.ready === true ? "ready" : "incomplete");
      };
      try { worker.postMessage({ type: "LUCID_OFFLINE_STATUS" }, [channel.port2]); }
      catch { cleanup(); if (!disposed && id === queryId) setOfflineStatus("incomplete"); }
    };
    const refresh = () => {
      verifyOffline();
      window.clearTimeout(updateTimer.current);
      if (!hadController) { hadController = true; return; }
      if (reloadApproved.current && guards.current.canReload) { reloadApproved.current = false; window.location.reload(); }
      else if (navigator.serviceWorker.controller) { reloadApproved.current = false; setUpdating(false); setUpdateReady(true); setNotice("An app update is ready. Your current page stays open until you choose to refresh."); }
    };
    navigator.serviceWorker.addEventListener("controllerchange", refresh);
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then((registration) => {
      if (disposed) return;
      const checkWaiting = () => { if (registration.waiting && navigator.serviceWorker.controller) { waitingWorker.current = registration.waiting; setUpdateReady(true); } };
      checkWaiting();
      const found = () => {
        const worker = registration.installing; if (!worker) return;
        const changed = () => {
          if (worker.state === "installed") checkWaiting();
          if (worker.state === "activated") verifyOffline();
          if (worker.state === "redundant") { setOfflineStatus("incomplete"); setNotice("Offline app setup could not finish. Keep this page open and reconnect to try again; your saved local work stays on this device."); }
        };
        worker.addEventListener("statechange", changed); removers.push(() => worker.removeEventListener("statechange", changed)); changed();
      };
      registration.addEventListener("updatefound", found); removers.push(() => registration.removeEventListener("updatefound", found));
      found(); // register() may resolve after the initial updatefound event.
      verifyOffline();
      void navigator.serviceWorker.ready.then(() => { if (!disposed) verifyOffline(); });
      const checkUpdate = () => { if (document.visibilityState === "visible") { verifyOffline(); if (navigator.onLine) void registration.update().catch(() => undefined); } };
      window.addEventListener("online", checkUpdate); document.addEventListener("visibilitychange", checkUpdate);
      removers.push(() => { window.removeEventListener("online", checkUpdate); document.removeEventListener("visibilitychange", checkUpdate); });
    }).catch(() => { if (!disposed) { setOfflineStatus("incomplete"); setNotice("Offline app setup could not finish. Lucid still works in this browser while connected."); } });
    return () => { disposed = true; window.clearTimeout(updateTimer.current); reloadApproved.current = false; navigator.serviceWorker.removeEventListener("controllerchange", refresh); removers.forEach((remove) => remove()); };
  }, []);

  useEffect(() => {
    const element = dialog.current; if (!element) return;
    if (guidanceOpen && !element.open) {
      if (typeof element.showModal === "function") element.showModal();
      else { element.setAttribute("open", ""); element.querySelector<HTMLButtonElement>("button")?.focus(); }
    }
    if (!guidanceOpen && element.open) {
      if (typeof element.close === "function") element.close();
      else { element.removeAttribute("open"); opener.current?.focus(); }
    }
  }, [guidanceOpen]);

  async function handleInstall() {
    const result = await installController.current?.install();
    if (result === "guidance") setGuidanceOpen(true);
    if (result === "accepted") setNotice("Installation requested. Open Lucid from your Home Screen or app launcher when your browser finishes.");
    if (result === "dismissed") setNotice("Installation was dismissed. You can install later from this button or your browser menu.");
  }
  async function handleUpdate() {
    if (updating) return;
    if (!await prepareAppReload(() => guards.current.canReload, () => guards.current.prepareReload?.() ?? true)) {
      setNotice("Finish or retry saving your current work before refreshing the app."); return;
    }
    setUpdating(true);
    if (waitingWorker.current) {
      reloadApproved.current = true; waitingWorker.current.postMessage({ type: "LUCID_ACTIVATE_UPDATE" });
      window.clearTimeout(updateTimer.current);
      updateTimer.current = window.setTimeout(() => { reloadApproved.current = false; setUpdating(false); setNotice("The update is taking longer than expected. Your current work stays open; try Update app again when connected."); }, 18_000);
    }
    else window.location.reload();
  }
  const guidance = installGuidance(install.platform);
  const installPanel = <section className={`pwa-install ${install.compact ? "pwa-install-compact" : ""}`} aria-label="Lucid app installation">
    <div className="pwa-install-copy">
      <strong>{install.phase === "installed" ? "Lucid app view" : "Keep Lucid one tap away"}</strong>
      {!install.compact && <span>{install.phase === "installed" ? "You are using the standalone app view." : "Add Lucid to your Home Screen or app launcher."}</span>}
    </div>
    {install.phase !== "installed" && <button className="pwa-install-button" ref={opener} onClick={handleInstall} disabled={install.phase === "prompting"}>{install.phase === "prompting" ? "Opening prompt…" : install.phase === "requested" ? "Install help" : "Install app"}</button>}
    {install.phase !== "installed" && !install.compact && <button className="pwa-install-dismiss" onClick={() => installController.current?.dismiss()} aria-label="Dismiss installation suggestion">Later</button>}
    {updateReady && promoteInstall && <button className="pwa-install-button pwa-update-button" onClick={handleUpdate} disabled={updating || !canReload}>{updating ? "Updating…" : "Update app"}</button>}
    <p className="pwa-install-notice" role="status" data-offline-ready={offlineStatus === "ready"}>{offlineStatus === "ready" ? "Offline app ready on this browser. Account sign-in still needs a connection." : offlineStatus === "unsupported" ? "Offline app setup is unavailable in this browser. You can practise while connected." : offlineStatus === "incomplete" ? "Offline setup is not ready yet. Keep Lucid open while connected, then try again." : "Preparing this browser for offline practice…"}</p>
    {(notice || install.error) && <p className="pwa-install-notice" role="status">{notice || install.error}</p>}
    <dialog ref={dialog} className="pwa-install-dialog" aria-labelledby="pwa-guidance-title" onCancel={() => setGuidanceOpen(false)} onClose={() => { setGuidanceOpen(false); opener.current?.focus(); }}>
      <h2 id="pwa-guidance-title">{guidance.title}</h2>
      <ol>{guidance.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      <p>{guidance.note}</p>
      <p>Your browser and the installed app may keep separate local storage. New guest practice is temporary for this tab’s session. Earlier local records are preserved; download their original backup from the guest notice before changing browsers or app views. When shared sign-in is enabled for your build, use the same Lucid account to sync supported progress. Personal situations and sentences stay on their originating device.</p>
      <button className="pwa-install-button" onClick={() => setGuidanceOpen(false)}>Got it</button>
    </dialog>
  </section>;
  if (promoteInstall) return installPanel;
  return <div className="pwa-optional-access">
    {updateReady && <section className="pwa-update-notice" aria-label="Lucid app update"><p role="status">An app update is ready. Keep exploring or refresh when your current work is safe.</p><button className="pwa-install-button pwa-update-button" onClick={handleUpdate} disabled={updating || !canReload}>{updating ? "Updating…" : "Update app"}</button>{notice && <p role="status">{notice}</p>}</section>}
    <details className="pwa-install-optional"><summary>App installation · optional</summary>{installPanel}</details>
  </div>;
}
