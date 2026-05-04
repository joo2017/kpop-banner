import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// 获取当前脚本所在的绝对目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mode = process.argv[2] || "all";
const usage = "Usage: node scripts/run-kpop-cycle.mjs [ichart|circle|kpopping|soridata|all]";

if (mode === "--help" || mode === "-h") {
  console.log(usage);
  process.exit(0);
}

const outputDir = process.env.KPOP_DATA_OUTPUT_DIR || "/root/alldongtai";
const publicDir = process.env.KPOP_DATA_PUBLIC_DIR || "/var/www/kpop-data";
const distDir = process.env.KPOP_DATA_DIST_DIR || `${publicDir.replace(/\/$/, "")}/dist`;
const kpoppingLimit = process.env.KPOP_DATA_KPOPPING_LIMIT || "80";
const lightLimit = process.env.KPOP_DATA_KPOPPING_LIGHT_LIMIT || "30";
const skipKpoppingLocalImages = process.env.KPOP_DATA_KPOPPING_SKIP_LOCAL_IMAGES === "1";

const kpoppingStep = [
  "../fetch-kpopping-musicshows.mjs",
  "--output-dir", outputDir,
  "--public-dir", publicDir,
  "--light-output", `${distDir}/kpopping-musicshows-details.json`,
  "--limit", kpoppingLimit,
  "--light-limit", lightLimit,
  ...(skipKpoppingLocalImages ? ["--skip-local-images"] : []),
];

const soridataStep = [
  "fetch-soridata-musicshow-wins.mjs",
  "--output", `${distDir}/soridata-musicshow-wins-summary.json`,
];

const stepsByMode = {
  ichart: [
    ["fetch-ichart-rank.mjs"],
    ["build-unified-charts.mjs"],
    ["cleanup-local-images.mjs"],
  ],
  circle: [
    ["fetch-circlechart-global-day.mjs"],
    ["fetch-circlechart-multi.mjs"],
    ["build-unified-charts.mjs"],
    ["cleanup-local-images.mjs"],
  ],
  kpopping: [kpoppingStep],
  soridata: [soridataStep],
  all: [
    ["fetch-ichart-rank.mjs"],
    ["fetch-circlechart-global-day.mjs"],
    ["fetch-circlechart-multi.mjs"],
    ["build-unified-charts.mjs"],
    kpoppingStep,
    soridataStep,
    ["cleanup-local-images.mjs"],
  ],
};

if (!stepsByMode[mode]) {
  console.error(`❌ Unsupported mode: ${mode}`);
  console.error(usage);
  process.exit(1);
}

/**
 * 运行单个子脚本
 * @param {string[]} step
 */
function runStep(step) {
  return new Promise((resolve, reject) => {
    const [scriptFile, ...extraArgs] = step;
    const scriptPath = join(__dirname, scriptFile);
    const label = [scriptFile, ...extraArgs].join(" ");

    console.log(`\n▶️ Running: ${label}`);
    
    const child = spawn(process.execPath, [scriptPath, ...extraArgs], {
      stdio: "inherit",
      env: process.env,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`❌ ${label} failed with code ${code}`));
      }
    });

    child.on("error", (err) => {
      console.error(`💥 Spawn error in ${label}:`, err);
      reject(err);
    });
  });
}

// 执行流程
try {
  for (const step of stepsByMode[mode]) {
    await runStep(step);
  }
  console.log(`\n✅ K-pop cycle completed successfully: ${mode}`);
} catch (error) {
  console.error(`\n🚨 Cycle aborted: ${error.message}`);
  process.exit(1);
}
