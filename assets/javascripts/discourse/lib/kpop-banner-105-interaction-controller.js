export function createKpopBanner105InteractionController(context) {
  const {
    instance,
    root,
    modal,
    historyModal,
    modalCover,
    modalContent,
    openModalBtn,
    closeModalBtn,
    closeHistoryBtn,
    confettiBtn,
    viewController,
    setImageSource,
    resolveIchartAggregatePoints,
    buildCircleModalTableHtml,
    buildMusicShowModalTableHtml,
    buildMusicShowRankModalTableHtml,
    buildIchartModalTableHtml,
    getCountBadgeHtml,
    getModalPlaceholderRowHtml,
    isBannerHiddenNow,
    getReappearMinutes,
    setHiddenUntil,
    setModalState,
    isSongLiked,
    setSongLiked,
    updateLikeButtonState,
    shouldCelebrateOnUserLike,
    fireMultipleCannons,
    buildMvSearchUrl,
  } = context;

  const controller = {
    renderModalShell(song) {
      if (song.chartFamily === "music_show") {
        setModalState({ badgeHtml: "", tableTitle: "舞台详细信息", tableHeadHtml: '<tr><th style="width:120px">项目</th><th>详细内容</th></tr>', tableBodyHtml: getModalPlaceholderRowHtml(2, "正在加载详情..."), pointsTitle: "", pointsSummaryVisible: false });
        return;
      }

      if (song.chartFamily === "music_show_rank") {
        setModalState({ badgeHtml: "", tableTitle: "打歌获奖详细数据", tableHeadHtml: '<tr><th style="width:120px">项目</th><th>详细内容</th></tr>', tableBodyHtml: getModalPlaceholderRowHtml(2, "正在加载详情..."), pointsTitle: "一位总数", pointsSummaryVisible: true });
        return;
      }

      if (song.chartFamily) {
        setModalState({ badgeHtml: "", tableTitle: "详细信息 (Circle Chart)", tableHeadHtml: '<tr><th style="width:120px">项目</th><th>详细内容</th></tr>', tableBodyHtml: getModalPlaceholderRowHtml(2, "正在加载详情..."), pointsTitle: "", pointsSummaryVisible: false });
        return;
      }

      setModalState({ badgeHtml: getCountBadgeHtml(song), tableTitle: "各平台实时排名数据", tableHeadHtml: "<tr><th>平台</th><th>榜单名</th><th>排名</th><th>分数</th><th>加成</th></tr>", tableBodyHtml: getModalPlaceholderRowHtml(5, "正在加载详情..."), pointsTitle: "iChart 综合总分", pointsSummaryVisible: true });
    },

    scheduleModalDetailRender(song, token) {
      requestAnimationFrame(() => {
        if (token !== instance.modalDetailRenderToken || !modal.classList.contains("is-open")) {
          return;
        }

        const tableBodyHtml = song.chartFamily === "music_show" ? buildMusicShowModalTableHtml(song) : song.chartFamily === "music_show_rank" ? buildMusicShowRankModalTableHtml(song) : song.chartFamily ? buildCircleModalTableHtml(song) : buildIchartModalTableHtml(song);
        setModalState({ tableBodyHtml });
      });
    },

    openModal() {
      const song = viewController.getCurrentSong();
      if (!song) return;
      setImageSource(modalCover, song.imageUrl, `${song.title || "K-pop song"} by ${song.artist || "Unknown artist"}`);
      setModalState({
        title: song.title,
        artist: song.artist,
        totalPoints: song.chartFamily === "music_show" ? "" : resolveIchartAggregatePoints(song),
        coverSrc: song.imageUrl || "",
        coverAlt: `${song.title || "K-pop song"} by ${song.artist || "Unknown artist"}`,
      });
      instance.modalDetailRenderToken += 1;
      const renderToken = instance.modalDetailRenderToken;
      controller.renderModalShell(song);

      root.dataset.kpopModalOpen = "1";
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      openModalBtn.setAttribute("aria-expanded", "true");
      instance.previousBodyOverflow = document.body.style.overflow || "";
      document.body.style.overflow = "hidden";
      instance.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (modalContent instanceof HTMLElement) {
        modalContent.scrollTop = 0;
        modalContent.style.border = "2px solid var(--primary-low-mid, #bdbdbd)";
        modalContent.style.boxShadow = "0 16px 40px -12px rgba(0, 0, 0, 0.35)";
      }
      closeModalBtn.focus();
      controller.scheduleModalDetailRender(song, renderToken);
    },

    closeModal() {
      instance.modalDetailRenderToken += 1;
      root.dataset.kpopModalOpen = "0";
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      openModalBtn.setAttribute("aria-expanded", "false");
      document.body.style.overflow = instance.previousBodyOverflow;
      setModalState({ title: "", artist: "", totalPoints: "0", coverSrc: "", coverAlt: "", badgeHtml: "", tableTitle: "各平台实时排名数据", tableHeadHtml: "", tableBodyHtml: "", pointsTitle: "iChart 综合总分", pointsSummaryVisible: true });
      if (instance.lastFocusedElement instanceof HTMLElement) {
        instance.lastFocusedElement.focus();
      }
      instance.lastFocusedElement = null;
    },

    openHistoryModal() {
      if (!(historyModal instanceof HTMLElement)) {
        return;
      }

      historyModal.classList.add("is-open");
      historyModal.setAttribute("aria-hidden", "false");
      instance.previousBodyOverflow = document.body.style.overflow || "";
      document.body.style.overflow = "hidden";
      if (closeHistoryBtn instanceof HTMLElement) {
        closeHistoryBtn.focus();
      }
    },

    closeHistoryModal() {
      if (!(historyModal instanceof HTMLElement)) {
        return;
      }

      historyModal.classList.remove("is-open");
      historyModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = instance.previousBodyOverflow;
    },

    hideBannerTemporarily() {
      const hiddenUntil = Date.now() + getReappearMinutes() * 60 * 1000;
      setHiddenUntil(hiddenUntil);

      root.style.opacity = "0";
      root.style.transform = "translateY(-10px)";
      root.style.transition = "all 0.3s ease";

      setTimeout(() => {
        root.dataset.kpopHidden = "1";
        root.style.opacity = "";
        root.style.transform = "";
        root.style.transition = "";
      }, 300);

      const waitMs = hiddenUntil - Date.now();
      if (waitMs > 0) {
        window.setTimeout(() => {
          if (!isBannerHiddenNow()) {
            root.dataset.kpopHidden = "0";
          }
        }, waitMs);
      }
    },

    toggleCurrentSongLike() {
      const song = viewController.getCurrentSong();
      if (!song) {
        return;
      }

      const nextLiked = !isSongLiked(song);
      setSongLiked(song, nextLiked);
      updateLikeButtonState(confettiBtn, song);
      if (!nextLiked || !shouldCelebrateOnUserLike(song)) {
        return;
      }

      const pakColors = ['#f472b6', '#60a5fa', '#4ade80', '#fb7185', '#c084fc', '#fcd34d', '#ffffff'];
      fireMultipleCannons(pakColors);
    },

    openCurrentSongVideo(e) {
      e.preventDefault();
      const song = viewController.getCurrentSong();
      const targetUrl = song?.mvUrl || buildMvSearchUrl(song?.title, song?.artist);
      if (!targetUrl) {
        return;
      }
      window.open(targetUrl, "_blank", "noopener,noreferrer,width=1200,height=720");
    },

    handleModalKeydown(e) {
      if (!modal.classList.contains("is-open")) {
        return;
      }

      if (e.key === "Escape") {
        controller.closeModal();
        return;
      }

      if (e.key !== "Tab") {
        return;
      }

      const focusable = Array.from(modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter((item) => item instanceof HTMLElement && !item.hasAttribute("disabled") && item.offsetParent !== null);

      if (!focusable.length) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },

    handleModalBackdropClick(e) {
      if (e.target === modal) {
        controller.closeModal();
      }
    },

    handleHistoryModalClick(e) {
      if (e.target === historyModal) {
        controller.closeHistoryModal();
        return;
      }

      const target = e.target instanceof Element ? e.target.closest(".history-item") : null;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const period = target.getAttribute("data-history-period") || "";
      if (period && typeof viewController.applyKpoppingHistoryPeriod === "function") {
        viewController.applyKpoppingHistoryPeriod(period);
      }
      controller.closeHistoryModal();
    },

    handleRootClick(e) {
      const target = e.target instanceof Element ? e.target : null;
      const historyButton = target?.closest("#open-history-btn");
      if (historyButton instanceof HTMLElement) {
        e.preventDefault();
        controller.openHistoryModal();
        return;
      }

      const likeButton = target?.closest("#confetti-btn");
      if (likeButton instanceof HTMLElement) {
        e.preventDefault();
        controller.toggleCurrentSongLike();
      }
    },
  };

  return controller;
}
