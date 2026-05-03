import Component from "@glimmer/component";
import { tracked } from "@glimmer/tracking";
import { htmlSafe } from "@ember/template";
import { modifier as modifierFn } from "ember-modifier";
import { mountKpopBanner, unmountKpopBanner } from "../initializers/kpop-banner";

export default class KpopBanner105 extends Component {
  @tracked heroState = {
    rank: "1",
    title: "",
    artist: "",
    points: "",
    pointsLabel: "TOTAL POINTS",
    coverSrc: "",
    coverAlt: "",
    coverHref: "#",
    coverAriaLabel: "Open music video in a new tab",
    badgeHtml: "",
    extraInfoHtml: "",
    isMusicShow: false,
    hideLikeButton: false,
    winnerArtist: "",
    winnerSong: "",
  };

  @tracked sidebarItems = [];
  @tracked historyItems = [];
  @tracked modalState = {
    title: "",
    artist: "",
    totalPoints: "0",
    coverSrc: "",
    coverAlt: "",
    badgeHtml: "",
    tableTitle: "各平台实时排名数据",
    tableHeadHtml: "",
    tableBodyHtml: "",
    pointsTitle: "iChart 综合总分",
    pointsSummaryVisible: true,
  };

  get heroBadgeHtml() {
    return htmlSafe(this.heroState.badgeHtml || "");
  }

  get heroExtraInfoHtml() {
    return htmlSafe(this.heroState.extraInfoHtml || "");
  }

  get modalBadgeHtml() {
    return htmlSafe(this.modalState.badgeHtml || "");
  }

  get modalTableHeadHtml() {
    return htmlSafe(this.modalState.tableHeadHtml || "");
  }

  get modalTableBodyHtml() {
    return htmlSafe(this.modalState.tableBodyHtml || "");
  }

  bannerMount = modifierFn((element) => {
    let disposed = false;
    void mountKpopBanner(element, {
      setHeroState: (patch) => {
        this.heroState = { ...this.heroState, ...patch };
      },
      setSidebarState: (items) => {
        this.sidebarItems = Array.isArray(items) ? items : [];
      },
      setHistoryState: (items) => {
        this.historyItems = Array.isArray(items) ? items : [];
      },
      setModalState: (patch) => {
        this.modalState = { ...this.modalState, ...patch };
      },
    });

    return () => {
      if (disposed) {
        return;
      }
      disposed = true;
      unmountKpopBanner(element);
    };
  });

  <template>
    <section class="kpop-celebration" data-kpop-banner data-kpop-hidden="0" data-kpop-loading="0" data-kpop-modal-open="0" aria-label="K-pop chart banner" {{this.bannerMount}}>
      <div class="kpop-controls-row">
        <select id="kpop-source-select" class="kpop-select" aria-label="chart source selector">
          <option value="ichart">iChart 综合榜</option>
          <option value="circle-global">Circle Chart (全球)</option>
          <option value="circle-digital">Circle Chart (数字音源)</option>
          <option value="circle-album">Circle Chart (专辑销量)</option>
                  <option value="kpopping">打歌节目</option>
        </select>

        <select id="kpop-period-select" class="kpop-select" aria-label="chart period selector">
          <option value="day">日榜 (Daily)</option>
          <option value="week">周榜 (Weekly)</option>
          <option value="month">月榜 (Monthly)</option>
          <option value="year">年榜 (Yearly)</option>
          <option value="stages">最新打歌舞台</option>
        </select>
      </div>

      <div class="kpop-celebration__shell">
        <div class="kpop-celebration__stage">
          <div class="kpop-celebration__slide" data-kpop-slide="0">
            <section class="kpop-celebration__card kpop-celebration__card--pak">
              <div class="kpop-celebration__glow"></div>

              <div class="kpop-celebration__main-row">
                <button class="kpop-celebration__close-banner" id="close-banner-btn" type="button" data-kpop-dismiss aria-label="닫기">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>

                <div class="kpop-celebration__hero-main">
                  <div class="kpop-celebration__left">
                    <div id="hero-cover-badge-container">{{this.heroBadgeHtml}}</div>
                    <a class="kpop-celebration__cover-link" href={{this.heroState.coverHref}} target="_blank" rel="noopener noreferrer" aria-label={{this.heroState.coverAriaLabel}}>
                      <span class="kpop-celebration__rank-badge" id="hero-rank">{{this.heroState.rank}}</span>
                      <div class="kpop-celebration__cover-frame">
                        <img class="kpop-celebration__cover" id="hero-cover" src={{this.heroState.coverSrc}} alt={{this.heroState.coverAlt}} loading="lazy" decoding="async" width="72" height="72" draggable="false" />
                      </div>
                      <span class="kpop-celebration__cover-play">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                      </span>
                    </a>
                  </div>

                  <div class="kpop-celebration__center">
                    <div class="kpop-celebration__info-header">
                      <div class="kpop-celebration__title" id="hero-title">{{this.heroState.title}}</div>
                      <div class="kpop-celebration__artist-row">
                        <div class="kpop-celebration__artist" id="hero-artist">{{this.heroState.artist}}</div>
                        <div class="kpop-celebration__status-wrap" id="hero-status-wrap"></div>
                      </div>
                    </div>

                    <div class="kpop-celebration__extra-info" id="hero-extra-info">{{this.heroExtraInfoHtml}}</div>
                  </div>

                  <div class="kpop-celebration__right">
                    <div class="kpop-celebration__stats {{if this.heroState.isMusicShow 'stage-winner-card'}}" aria-label={{if this.heroState.isMusicShow "Music show winner" "Chart points"}}>
                      <div class="kpop-celebration__points {{if this.heroState.isMusicShow 'stage-winner-main'}}" id="hero-points">
                        {{#if this.heroState.isMusicShow}}
                        <div class="stage-winner-artist">🏆 {{this.heroState.winnerArtist}}</div>
                        {{else}}
                        {{this.heroState.points}}
                        {{/if}}
                      </div>
                      <div class="kpop-celebration__points-label {{if this.heroState.isMusicShow 'stage-winner-song'}}" id="hero-points-label">
                        {{#if this.heroState.isMusicShow}}
                          {{this.heroState.winnerSong}}
                        {{else}}
                          {{this.heroState.pointsLabel}}
                        {{/if}}
                      </div>
                    </div>

                    <div class="kpop-celebration__actions">
                      {{#if this.heroState.isMusicShow}}
                        <button class="kpop-celebration__details-btn" id="open-history-btn" type="button" aria-haspopup="dialog" aria-controls="history-modal">
                          <span class="kpop-celebration__details-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                          </span>
                          <span class="kpop-celebration__details-text">往期节目</span>
                        </button>
                      {{else}}
                        {{#unless this.heroState.hideLikeButton}}
                        <button class="kpop-celebration__icon-btn kpop-celebration__like-btn" id="confetti-btn" type="button" title="点赞" aria-label="点赞" aria-pressed="false" data-liked="0">
                          <span class="kpop-celebration__like-icon" aria-hidden="true">♡</span>
                        </button>
                        {{/unless}}
                      {{/if}}
                      <button class="kpop-celebration__details-btn" id="open-modal-btn" type="button" aria-haspopup="dialog" aria-controls="details-modal">
                        <span class="kpop-celebration__details-icon">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                        </span>
                        <span class="kpop-celebration__details-text">查看详情</span>
                      </button>
                    </div>
                  </div>
                </div>

                <aside class="kpop-celebration__mini-sidebar" aria-label="Top chart entries">
                  {{#each this.sidebarItems as |item|}}
                    <button class="kpop-celebration__mini-item {{if item.isActive 'is-active'}}" type="button" data-index={{item.index}} title={{item.title}}>
                      <div class="kpop-celebration__mini-left">
                        <span class="kpop-celebration__mini-rank {{if item.isTop 'is-top'}}">{{item.rank}}</span>
                        <span class="kpop-celebration__mini-title">{{item.title}}</span>
                      </div>
                      <span class="kpop-celebration__mini-trend is-{{item.trend}}">
                        {{#if item.isUp}}
                          <span class="kpop-celebration__mini-trend-icon"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg></span>
                        {{else if item.isDown}}
                          <span class="kpop-celebration__mini-trend-icon"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg></span>
                        {{else}}
                          <span class="kpop-celebration__mini-trend-icon"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg></span>
                        {{/if}}
                        {{item.trendVal}}
                      </span>
                    </button>
                  {{/each}}
                </aside>
              </div>
            </section>
          </div>
        </div>
      </div>

      <div class="kpop-modal-backdrop" id="details-modal" aria-hidden="true">
        <div class="kpop-modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1" style="border: 2px solid var(--primary-low-mid); box-shadow: 0 16px 40px -12px rgba(0, 0, 0, 0.35);">
          <div class="kpop-modal-header">
            <div class="kpop-modal-header-info">
              <img src={{this.modalState.coverSrc}} alt={{this.modalState.coverAlt}} class="kpop-modal-cover" id="modal-cover" loading="lazy" decoding="async" width="80" height="80" />
              <div class="kpop-modal-title-wrap">
                <div class="kpop-modal-title" id="modal-title">{{this.modalState.title}}</div>
                <div class="kpop-modal-artist" id="modal-artist">{{this.modalState.artist}}</div>
                <div id="modal-badge-container">{{this.modalBadgeHtml}}</div>
              </div>
            </div>
            <button class="kpop-modal-close" id="close-modal-btn" type="button" aria-label="닫기">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <div class="kpop-modal-body">
            <div class="kpop-modal-section-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              <span id="modal-table-title">{{this.modalState.tableTitle}}</span>
            </div>

            <div class="kpop-modal-table-wrapper">
              <table class="kpop-modal-table">
                <thead id="modal-table-head">{{this.modalTableHeadHtml}}</thead>
                <tbody id="modal-table-body">{{this.modalTableBodyHtml}}</tbody>
              </table>
            </div>

            {{#if this.modalState.pointsSummaryVisible}}
            <div class="kpop-modal-points-summary" id="modal-points-summary">
              <span class="kpop-modal-points-title">{{this.modalState.pointsTitle}}</span>
              <span class="kpop-modal-points-total" id="modal-total-points">{{this.modalState.totalPoints}}</span>
            </div>
            {{/if}}
          </div>
        </div>
      </div>

      <div class="kpop-modal-backdrop" id="history-modal" aria-hidden="true">
        <div class="kpop-modal-content kpop-history-modal-content" role="dialog" aria-modal="true" aria-labelledby="history-modal-title" tabindex="-1" style="border: 2px solid var(--primary-low-mid); box-shadow: 0 16px 40px -12px rgba(0, 0, 0, 0.35);">
          <div class="kpop-modal-header">
            <div class="kpop-modal-title" id="history-modal-title">📺 往期打歌舞台</div>
            <button class="kpop-modal-close" id="close-history-btn" type="button" aria-label="关闭">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div class="kpop-modal-body kpop-history-modal-body">
            <div class="history-list" id="history-list">
              {{#each this.historyItems as |item|}}
                <button class="history-item" type="button" data-history-period={{item.period}}>
                  <div class="history-show">{{item.title}}</div>
                  <div class="history-date">{{item.date}}</div>
                  <div class="history-winner">🏆 {{item.winner}}</div>
                </button>
              {{/each}}
            </div>
          </div>
        </div>
      </div>
    </section>
  </template>
}
