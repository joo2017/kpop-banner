export function createKpopBanner105RenderController(context) {
  const {
    instance,
    sidebar,
    heroTitle,
    heroArtist,
    heroPoints,
    heroCover,
    heroLeft,
    heroMain,
    heroCenter,
    heroRight,
    heroStatusWrap,
    confettiBtn,
    prefersReducedMotion,
    setImageSource,
    buildMvSearchUrl,
    getCountBadgeHtml,
    getCircleHeroMetaHtml,
    getHeroCoverBadgeHtml,
    getPlatformPillsHtml,
    updateLikeButtonState,
    syncTopRunState,
    setHeroState,
    setSidebarState,
  } = context;

  const controller = {
    getMusicShowBadgeHtml(song) {
      const badges = Array.isArray(song?.musicShowMeta?.badges) ? song.musicShowMeta.badges : [];
      return badges.map((badge) => {
        const value = String(badge || "").toUpperCase();
        if (value === "WINNER") {
          return '<div class="kpop-celebration__badge kpop-celebration__badge--winner"><span class="kpop-celebration__badge-text">WINNER</span></div>';
        }
        if (value === "COMEBACK") {
          return '<div class="kpop-celebration__badge kpop-celebration__badge--comeback"><span class="kpop-celebration__badge-text">COMEBACK</span></div>';
        }
        if (value === "DEBUT") {
          return '<div class="kpop-celebration__badge kpop-celebration__badge--debut"><span class="kpop-celebration__badge-text">DEBUT</span></div>';
        }
        return "";
      }).join("");
    },

    getMusicShowMetaHtml(song) {
      const meta = song?.musicShowMeta || {};
      const showName = meta.showName || "Kpopping";
      const airDate = meta.airDate || "-";
      return `<div class="kpop-celebration__circle-meta"><div class="circle-badges-row"><span class="circle-badge kpopping">${showName}</span><span class="circle-badge period">${airDate}</span></div></div>`;
    },

    getMusicShowRankMetaHtml(song) {
      const meta = song?.musicShowRankMeta || {};
      const label = song?.chartPeriod === "artist-wins" ? "艺人总榜" : "歌曲一位榜";
      const sub = meta.winningSongs ? `${meta.winningSongs} 首夺冠歌曲` : `${meta.wins || "-"} 次一位`;
      return `<div class="kpop-celebration__circle-meta"><div class="circle-badges-row"><span class="circle-badge kpopping">${label}</span><span class="circle-badge period">${sub}</span></div></div>`;
    },

    applyHeroAnimations() {
      if (prefersReducedMotion) {
        heroCover.classList.add("is-visible");
        return;
      }

      requestAnimationFrame(() => {
        heroTitle.classList.add("animate-fade-in");
        heroArtist.classList.add("animate-fade-in");
        heroPoints.classList.add("animate-fade-in");
        if (!heroCover.getAttribute("src")) {
          heroCover.classList.add("is-visible");
        }
      });
    },

    renderHeroSupplementary(song) {
      if (song.chartFamily === "music_show") {
        setHeroState({
          artist: song.artist || "-",
          badgeHtml: "",
          extraInfoHtml: controller.getMusicShowMetaHtml(song),
        });
        heroStatusWrap.innerHTML = controller.getMusicShowBadgeHtml(song);
        return;
      }

      if (song.chartFamily === "music_show_rank") {
        heroStatusWrap.innerHTML = "";
        setHeroState({
          artist: song.artist || "-",
          badgeHtml: "",
          extraInfoHtml: controller.getMusicShowRankMetaHtml(song),
        });
        return;
      }

      heroStatusWrap.innerHTML = song.chartFamily ? "" : getCountBadgeHtml(song);

      if (song.chartFamily) {
        setHeroState({
          artist: `${song.artist || ""} · ${song.circleMeta?.album || "未知专辑"}`,
          badgeHtml: "",
          extraInfoHtml: getCircleHeroMetaHtml(song),
        });
        return;
      }

      const extraInfoHtml = `<div class="kpop-celebration__platform-marquee"><div class="kpop-celebration__platform-track" role="list">${getPlatformPillsHtml(song.platforms)}</div></div>`;
      setHeroState({
        badgeHtml: getHeroCoverBadgeHtml(song),
        extraInfoHtml,
      });
    },

    updateHeroSection(index) {
      instance.currentSongIndex = index;
      const song = instance.allSongs[index];
      if (!song) {
        return;
      }

      sidebar.querySelectorAll(".kpop-celebration__mini-item").forEach((btn, idx) => {
        btn.classList.toggle("is-active", idx === index);
      });

      heroTitle.classList.remove("animate-fade-in");
      heroArtist.classList.remove("animate-fade-in");
      heroPoints.classList.remove("animate-fade-in");
      heroCover.classList.remove("is-visible");
      const isMusicShowLayout = song.chartFamily === "music_show" || song.chartFamily === "music_show_rank";
      const shouldCompactCenter = isMusicShowLayout && !window.matchMedia?.("(max-width: 900px)")?.matches;
      if (heroMain instanceof HTMLElement) {
        heroMain.classList.toggle("is-music-show", isMusicShowLayout);
      }
      if (heroLeft instanceof HTMLElement) {
        heroLeft.classList.remove("is-video");
        heroLeft.style.flexBasis = "72px";
        heroLeft.style.width = "72px";
        heroLeft.style.height = "72px";
        heroLeft.style.minHeight = "72px";
      }
      if (heroCenter instanceof HTMLElement) {
        heroCenter.style.flex = shouldCompactCenter ? "0 1 360px" : "1 1 0%";
        heroCenter.style.maxWidth = shouldCompactCenter ? "420px" : "";
      }
      if (heroRight instanceof HTMLElement) {
        heroRight.classList.toggle("is-music-show", song.chartFamily === "music_show");
      }

      setImageSource(heroCover, song.imageUrl, `${song.title || "K-pop song"} by ${song.artist || "Unknown artist"}`);
      const mvTarget = song.mvUrl || buildMvSearchUrl(song.title, song.artist);
      setHeroState({
        rank: String(song.rank),
        title: song.title,
        artist: song.artist,
        points: song.points,
        pointsLabel: song.pointsLabel || "TOTAL POINTS",
        isMusicShow: song.chartFamily === "music_show",
        hideLikeButton: song.chartFamily === "music_show_rank",
        winnerArtist: song.chartFamily === "music_show" ? song.musicShowMeta?.winnerArtist || "-" : "",
        winnerSong: song.chartFamily === "music_show" ? song.musicShowMeta?.winnerSong || "-" : "",
        coverSrc: song.imageUrl || "",
        coverAlt: `${song.title || "K-pop song"} by ${song.artist || "Unknown artist"}`,
        coverHref: mvTarget,
        coverAriaLabel: `${song.title || "K-pop song"} by ${song.artist || "Unknown artist"} - open music video`,
      });
      controller.renderHeroSupplementary(song);

      updateLikeButtonState(confettiBtn, song);

      controller.applyHeroAnimations();
      syncTopRunState(song);
    },

    renderSidebar() {
      setSidebarState(instance.allSongs.map((song, index) => ({
        index,
        rank: song.rank,
        title: song.title,
        trend: song.trend,
        trendVal: song.trendVal,
        isTop: song.rank === 1,
        isActive: index === instance.currentSongIndex,
        isUp: song.trend === "up",
        isDown: song.trend === "down",
      })));
    },
  };

  return controller;
}
