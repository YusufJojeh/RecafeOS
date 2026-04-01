/**
 * True when the browser is likely iOS / iPadOS Safari family (including Chrome on iOS / WebKit).
 * Used to show manual "Add to Home Screen" instructions — there is no `beforeinstallprompt` on these engines.
 */
export function isIosWebKitInstallSurface(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) {
    return true;
  }
  // iPadOS 13+ desktop UA can report as Mac with touch
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}
