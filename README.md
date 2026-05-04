豆顺的

## K-pop data scripts

The plugin reads private JSON files from `kpop_banner_data_dir`, which defaults to:

```text
/var/www/kpop-data/dist
```

To generate iChart data on a server:

```bash
cd /var/www/kpop-data
npm install --omit=dev
node scripts/fetch-ichart-rank.mjs
node scripts/build-unified-charts.mjs
```

The iChart script refuses to overwrite existing data if the source returns an empty day or week chart.
