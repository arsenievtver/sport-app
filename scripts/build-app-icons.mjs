import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "packages/ui/assets/icon-sport-source.svg"), "utf8");

const paths = [...src.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
const [mainPath, ...detailPaths] = paths;

function figurePaths(fill) {
  const details = detailPaths.map((d) => `    <path d="${d}"/>`).join("\n");
  return `<g transform="translate(0,1254) scale(0.1,-0.1)" fill="${fill}" stroke="none">
    <path d="${mainPath}"/>
${details}
  </g>`;
}

function makeIcon({ id, viewBox, stops, glow }) {
  const gradientStops = stops
    .map((s) => `      <stop offset="${s.offset}" stop-color="${s.color}"/>`)
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="512" height="512">
  <defs>
    <linearGradient id="${id}-bg" x1="0%" y1="0%" x2="100%" y2="100%">
${gradientStops}
    </linearGradient>
    <radialGradient id="${id}-glow" cx="78%" cy="12%" r="50%">
      <stop stop-color="${glow}" stop-opacity="0.3"/>
      <stop offset="1" stop-color="${stops[0].color}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1254" height="1254" fill="#f5f0e6"/>
  ${figurePaths(`url(#${id}-bg)`)}
  <rect width="1254" height="1254" fill="url(#${id}-glow)" style="mix-blend-mode:soft-light"/>
</svg>
`;
}

const athlete = makeIcon({
  id: "athlete",
  viewBox: "380 0 720 1254",
  glow: "#ff2d95",
  stops: [
    { offset: "0%", color: "#ff3355" },
    { offset: "55%", color: "#ff6600" },
    { offset: "100%", color: "#ff8800" },
  ],
});

const coach = makeIcon({
  id: "coach",
  viewBox: "150 0 720 1254",
  glow: "#14b8a6",
  stops: [
    { offset: "0%", color: "#2dd4bf" },
    { offset: "100%", color: "#34d399" },
  ],
});

writeFileSync(join(root, "apps/athlete/public/icon.svg"), athlete);
writeFileSync(join(root, "apps/coach/public/icon.svg"), coach);
console.log("icons ok");
