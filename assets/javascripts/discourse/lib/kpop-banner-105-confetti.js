let confettiLoaderPromise = null;

function ensureConfettiLoaded() {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  if (typeof window.confetti === "function") {
    return Promise.resolve(true);
  }

  if (confettiLoaderPromise) {
    return confettiLoaderPromise;
  }

  confettiLoaderPromise = new Promise((resolve) => {
    const existing = document.querySelector("script[data-kpop-confetti='1']");
    if (existing) {
      const done = () => resolve(typeof window.confetti === "function");
      existing.addEventListener("load", done, { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js";
    script.async = true;
    script.defer = true;
    script.dataset.kpopConfetti = "1";
    script.onload = () => resolve(typeof window.confetti === "function");
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  }).finally(() => {
    confettiLoaderPromise = null;
  });

  return confettiLoaderPromise;
}

export async function fireMultipleCannons(colors) {
  const loaded = await ensureConfettiLoaded();
  if (!loaded || typeof window.confetti !== "function") {
    return;
  }

  const shootCannon = (x, y, particleCount, spread) => {
    window.confetti({
      particleCount,
      spread,
      origin: { x, y },
      colors,
      zIndex: 9999,
      disableForReducedMotion: true,
    });
  };

  shootCannon(0.5, 0.6, 60, 80);

  setTimeout(() => {
    shootCannon(0.2, 0.5, 50, 70);
    shootCannon(0.8, 0.5, 50, 70);
  }, 300);

  setTimeout(() => {
    shootCannon(0.5, 0.3, 80, 100);
  }, 600);

  setTimeout(() => {
    shootCannon(0.3, 0.5, 50, 70);
    shootCannon(0.7, 0.5, 50, 70);
    shootCannon(0.5, 0.4, 100, 120);
  }, 1100);
}
