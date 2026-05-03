export function createKpopBanner105ViewController(context) {
  const {
    instance,
    sourceSelect,
    periodSelect,
    getPeriodLabel,
    getKpoppingHistoryItems,
    resolveKpoppingHistoryView,
    setHistoryState,
    root,
    bannerDataUpdatedEvent,
    renderController,
    applyCurrentView,
    resolveAvailableView,
    getStoredSource,
    getStoredPeriod,
    availablePeriods,
    normalizeSelectedSource,
    normalizeSelectedPeriod,
    defaultPeriodForSource,
    sourceNeedsCircleMultiData,
    ensureCircleMultiDataAvailable,
    ensureKpoppingDataAvailable,
    maybeCelebrateOnTopSongChange,
  } = context;

  const controller = {
    setControlsDisabled(disabled) {
      sourceSelect.disabled = disabled;
      periodSelect.disabled = disabled;
    },

    seedInstanceView() {
      applyCurrentView(resolveAvailableView(getStoredSource(), getStoredPeriod()), {
        persist: false,
        instance,
      });
    },

    setSelectControls() {
      sourceSelect.value = instance.currentSource;

      const periods = availablePeriods(instance.currentSource);
      const isHistoryPeriod = instance.currentSource === "kpopping" && /^ep\d+$/.test(instance.currentPeriod || "");
      if (!periods.includes(instance.currentPeriod) && !isHistoryPeriod) {
        instance.currentPeriod = periods[0] || "day";
      }

      if (instance.currentSource === "kpopping") {
        const visiblePeriods = isHistoryPeriod ? [...periods, instance.currentPeriod] : periods;
        periodSelect.replaceChildren(...visiblePeriods.map((period) => {
          const option = document.createElement("option");
          option.value = period;
          option.textContent = typeof getPeriodLabel === "function" ? getPeriodLabel(period) : period;
          return option;
        }));
      } else {
        periodSelect.replaceChildren(...["day", "week", "month", "year"].map((period) => {
          const option = document.createElement("option");
          option.value = period;
          option.textContent = typeof getPeriodLabel === "function" ? getPeriodLabel(period) : period;
          return option;
        }));
        Array.from(periodSelect.options).forEach((option) => {
          option.disabled = !periods.includes(option.value);
        });
      }

      periodSelect.value = instance.currentPeriod;
      periodSelect.style.display = periods.length > 1 ? "inline-block" : "none";

      if (typeof setHistoryState === "function") {
        setHistoryState(instance.currentSource === "kpopping" ? getKpoppingHistoryItems() : []);
      }
    },

    getCurrentSong() {
      return instance.allSongs[instance.currentSongIndex] || null;
    },

    normalizeSongIndex(index) {
      if (!instance.allSongs.length) {
        return 0;
      }

      const nextIndex = Number.isFinite(index) ? index : 0;
      return Math.min(Math.max(nextIndex, 0), instance.allSongs.length - 1);
    },

    showSongAt(index) {
      if (!instance.allSongs.length) {
        return false;
      }

      renderController.updateHeroSection(controller.normalizeSongIndex(index));
      return true;
    },

    renderCurrentSelection() {
      controller.setSelectControls();
      renderController.renderSidebar();
      if (!controller.showSongAt(instance.currentSongIndex)) {
        return;
      }
      maybeCelebrateOnTopSongChange(instance);
    },

    applyViewAndRender(view, options = {}) {
      if (!view?.songs?.length) {
        return false;
      }

      applyCurrentView(view, { persist: options.persist, instance });

      if (options.resetIndex !== false) {
        instance.currentSongIndex = 0;
      } else {
        instance.currentSongIndex = controller.normalizeSongIndex(instance.currentSongIndex);
      }

      controller.renderCurrentSelection();
      return true;
    },

    async applySourceAndRender(source, period = instance.currentPeriod) {
      const nextSource = normalizeSelectedSource(source);
      let nextPeriod = normalizeSelectedPeriod(period, nextSource);
      let periods = availablePeriods(nextSource);
      if (!periods.includes(nextPeriod)) {
        nextPeriod = periods[0] || defaultPeriodForSource(nextSource);
      }

      if (sourceNeedsCircleMultiData(nextSource, nextPeriod)) {
        controller.setControlsDisabled(true);
        try {
          await ensureCircleMultiDataAvailable();
        } finally {
          controller.setControlsDisabled(false);
        }

        periods = availablePeriods(nextSource);
        if (!periods.includes(nextPeriod)) {
          nextPeriod = periods[0] || defaultPeriodForSource(nextSource);
        }
      }

      if (nextSource === "kpopping" && !periods.length) {
        controller.setControlsDisabled(true);
        try {
          await ensureKpoppingDataAvailable();
        } finally {
          controller.setControlsDisabled(false);
        }

        periods = availablePeriods(nextSource);
        if (!periods.includes(nextPeriod)) {
          nextPeriod = periods[0] || defaultPeriodForSource(nextSource);
        }
      }

      controller.applyViewAndRender(resolveAvailableView(nextSource, nextPeriod), {
        persist: true,
        resetIndex: true,
      });
    },

    handleDataUpdated() {
      if (!root.isConnected) {
        window.removeEventListener(bannerDataUpdatedEvent, controller.handleDataUpdated);
        return;
      }

      if (root.dataset.kpopBound !== "1" || root.dataset.kpopHidden === "1") {
        return;
      }

      controller.applyViewAndRender(resolveAvailableView(instance.currentSource, instance.currentPeriod), {
        persist: false,
        resetIndex: true,
      });
    },

    handleSourceChange(e) {
      const target = e.currentTarget;
      if (!(target instanceof HTMLSelectElement)) {
        return;
      }
      void controller.applySourceAndRender(target.value, instance.currentPeriod);
    },

    handlePeriodChange(e) {
      const target = e.currentTarget;
      if (!(target instanceof HTMLSelectElement)) {
        return;
      }
      void controller.applySourceAndRender(instance.currentSource, target.value);
    },

    applyKpoppingHistoryPeriod(period) {
      const view = typeof resolveKpoppingHistoryView === "function" ? resolveKpoppingHistoryView(period) : null;
      if (!view?.songs?.length) {
        return false;
      }

      controller.applyViewAndRender(view, {
        persist: false,
        resetIndex: true,
      });
      return true;
    },
  };

  return controller;
}
