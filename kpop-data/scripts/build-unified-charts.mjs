import { mkdir, readFile, writeFile } from "node:fs/promises";

const OUTPUT_DIR = new URL("../dist/", import.meta.url);
const OUTPUT_FILE = new URL("../dist/charts-unified.json", import.meta.url);
const ICHART_FILE = new URL("../dist/ichart-banner.json", import.meta.url);
const CIRCLE_FILE = new URL("../dist/circlechart-global-day.json", import.meta.url);

async function readJson(fileUrl) {
  try {
    const raw = await readFile(fileUrl, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

async function main() {
  const ichart = await readJson(ICHART_FILE);
  const circle = await readJson(CIRCLE_FILE);

  if (!ichart && !circle) {
    throw new Error("No source JSON found. Generate ichart or circlechart first.");
  }

  const ichartDay = Array.isArray(ichart?.charts?.day?.items)
    ? ichart.charts.day
    : ichart
      ? {
          fetchedAt: ichart.fetchedAt || null,
          total: Number(ichart.total || 0),
          banner: ichart.banner || {},
          items: Array.isArray(ichart.items) ? ichart.items : [],
        }
      : null;
  const ichartWeek = Array.isArray(ichart?.charts?.week?.items)
    ? ichart.charts.week
    : null;

  const primary = ichartDay || circle;
  const payload = {
    source: "unified",
    fetchedAt: nowIso(),
    defaultSource: ichartDay ? "ichart" : "circlechart",
    total: Number(primary?.total || 0),
    banner: primary?.banner || {},
    items: Array.isArray(primary?.items) ? primary.items : [],
    charts: {
      ichart: ichartDay
        ? {
            fetchedAt: ichart?.fetchedAt || ichartDay.fetchedAt || null,
            total: Number(ichartDay.total || 0),
            banner: ichartDay.banner || {},
            items: Array.isArray(ichartDay.items) ? ichartDay.items : [],
            periods: {
              day: {
                fetchedAt: ichartDay.fetchedAt || null,
                total: Number(ichartDay.total || 0),
                banner: ichartDay.banner || {},
                items: Array.isArray(ichartDay.items) ? ichartDay.items : [],
              },
              week: ichartWeek
                ? {
                    fetchedAt: ichartWeek.fetchedAt || null,
                    yearWeek: ichartWeek.yearWeek || null,
                    total: Number(ichartWeek.total || 0),
                    banner: ichartWeek.banner || {},
                    items: Array.isArray(ichartWeek.items) ? ichartWeek.items : [],
                  }
                : null,
            },
          }
        : null,
      circlechart: circle
        ? {
            fetchedAt: circle.fetchedAt || null,
            chartDate: circle.chartDate || null,
            total: Number(circle.total || 0),
            banner: circle.banner || {},
            items: Array.isArray(circle.items) ? circle.items : [],
          }
        : null,
    },
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  console.log(`Saved unified charts to ${OUTPUT_FILE.pathname}`);
  console.log(`Primary source: ${payload.defaultSource}, total=${payload.total}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
