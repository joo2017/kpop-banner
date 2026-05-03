import { apiInitializer } from "discourse/lib/api";
import KpopBanner105 from "../components/kpop-banner-105";

export default apiInitializer("1.34.0", (api) => {
  if (typeof api.renderInOutlet !== "function") {
    return;
  }

  const siteSettings = api.container.lookup("service:site-settings");
  if (!siteSettings?.kpop_banner_enabled || !siteSettings?.kpop_banner_ui_enabled) {
    return;
  }

  api.renderInOutlet("above-main-container", KpopBanner105);
});
