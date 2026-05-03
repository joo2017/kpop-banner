# Discourse K-pop Banner Plugin

Unified Discourse plugin for the K-pop banner UI and private K-pop chart data proxy.

## Responsibilities

- Renders the K-pop banner in the `above-main-container` outlet.
- Serves private chart JSON through `/kpop/banner-data`, the single UI data endpoint.
- Keeps raw JSON files under `kpop_banner_data_dir` private.
- Controls data access with plugin site settings.
- Caches parsed JSON by file modified time.

## Data Endpoints

```text
/kpop/banner-data?source=unified
/kpop/banner-data?source=ichart
/kpop/banner-data?source=circle
/kpop/banner-data?source=kpopping
/kpop/banner-data?source=soridata&chart=song&limit=20
/kpop/banner-data?source=soridata&chart=artist&limit=20
```

Legacy compatibility endpoint:

```text
/kpop/soridata-musicshow-wins
```

The plugin UI does not fall back to raw JSON files. If the raw files are outside Discourse's public paths, guests can still see the banner without being able to download the complete Soridata JSON.

## Access Modes

- `public_limited`: visitors can read limited public slices, not full Soridata JSON.
- `logged_in`: logged-in users only.
- `group`: only members of `kpop_banner_allowed_groups`.
- `admin`: admins only.

## Install

Copy this folder into the Discourse plugins directory and rebuild:

```bash
cp -a discourse-kpop-banner /var/discourse/shared/standalone/plugins/discourse-kpop-banner
cd /var/discourse
./launcher rebuild app
```

For Docker installs, ensure `kpop_banner_data_dir` is mounted inside the app container.

The data proxy is enabled by default. The plugin-rendered UI is disabled by default so it can be installed beside the old theme component safely. Enable `kpop_banner_ui_enabled` only after the old theme component is disabled or removed.
