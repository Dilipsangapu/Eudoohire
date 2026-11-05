/*
 * generate-tech-icons.mjs
 *
 * Extracts the SVG markup for the technologies this app actually displays
 * from the installed `tech-stack-icons` package (single source of truth:
 * node_modules/tech-stack-icons/dist/index.js) and writes:
 *
 *   backend/src/main/resources/static/js/tech-icons-data.js
 *
 * as `window.TechIconAssets = { <iconName>: { label, svg }, ... }`.
 *
 * Every SVG's internal ids (clipPath / gradients referenced via url(#..) and
 * href="#..") are rewritten with an `ti-<icon>-` suffix so any number of
 * inline instances can live on one page without id collisions - the same
 * transformation the package's StackIcon applies per React instance.
 *
 * Re-run after upgrading the package:  npm run tech-icons:generate
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, "../node_modules/tech-stack-icons/dist/index.js");
const out = path.resolve(here, "../../backend/src/main/resources/static/js/tech-icons-data.js");

/* icon key in the package -> { label, keep?: alternate package key } */
const INCLUDE = {
  java: { label: "Java" },
  spring: { label: "Spring" },
  js: { label: "JavaScript" },
  typescript: { label: "TypeScript" },
  react: { label: "React" },
  html5: { label: "HTML5" },
  css3: { label: "CSS3" },
  tailwindcss: { label: "Tailwind CSS" },
  nodejs: { label: "Node.js" },
  nextjs: { label: "Next.js" },
  graphql: { label: "GraphQL" },
  redux: { label: "Redux" },
  docker: { label: "Docker" },
  kubernetes: { label: "Kubernetes" },
  aws: { label: "AWS" },
  mongodb: { label: "MongoDB" },
  mysql: { label: "MySQL" },
  postgresql: { label: "PostgreSQL" },
  python: { label: "Python" },
  git: { label: "Git" },
  github: { label: "GitHub" },
  go: { label: "Go" },
  figma: { label: "Figma" },
  openai: { label: "OpenAI" },
  redis: { label: "Redis" },
  rabbitmq: { label: "RabbitMQ" },
  django: { label: "Django" },
  flask: { label: "Flask" },
  vuejs: { label: "Vue.js" },
  angular: { label: "Angular" },
  sass: { label: "Sass" },
  expressjs: { label: "Express.js" },
  php: { label: "PHP" },
  ruby: { label: "Ruby" },
  rust: { label: "Rust" },
  kotlin: { label: "Kotlin" },
  swift: { label: "Swift" },
  "c++": { label: "C++" },
  "c#": { label: "C#" },
  net: { label: ".NET" },
  firebase: { label: "Firebase" },
  supabase: { label: "Supabase" },
  stripe: { label: "Stripe" },
  postman: { label: "Postman" },
  linux: { label: "Linux" },
  tomcat: { label: "Apache Tomcat" },
  jira: { label: "Jira" },
  pandas: { label: "Pandas" },
  numpy: { label: "NumPy" },
  scikitlearn: { label: "scikit-learn" },
  pytorch: { label: "PyTorch" },
  tensorflow: { label: "TensorFlow" }
};

const src = fs.readFileSync(dist, "utf8");
const start = src.indexOf("var f={");
if (start < 0) {
  console.error("tech-stack-icons: icon map (`var f={`) not found in dist/index.js");
  process.exit(1);
}

/* Uniquify each id attribute inside one SVG string with a fixed suffix. */
function uniquifyIds(svg, prefix) {
  const ids = new Set();
  for (const match of svg.matchAll(/\bid="([^"]+)"/g)) ids.add(match[1]);
  if (ids.size === 0) return svg;
  let out = svg;
  for (const id of ids) {
    const qualified = `${prefix}-${id}`;
    out = out.replaceAll(`id="${id}"`, `id="${qualified}"`);
    out = out.replaceAll(`url(#${id})`, `url(#${qualified})`);
    out = out.replaceAll(`href="#${id}"`, `href="#${qualified}"`);
  }
  return out;
}

/* Scan a JS single-quoted string literal starting at `from` (position after
   the opening quote) and return the raw value + end index. Handles escapes. */
function readSingleQuoted(text, from) {
  let i = from;
  let value = "";
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\") {
      const next = text[i + 1];
      if (next === "'" || next === "\\" || next === "/" || next === "\n") { value += next === "\n" ? "\n" : next; i += 2; continue; }
      if (next === "u" || next === "x") {
        const width = next === "u" ? 4 : 2;
        const hex = text.slice(i + 2, i + 2 + width);
        const code = parseInt(hex, 16);
        if (!Number.isNaN(code)) { value += String.fromCharCode(code); i += 2 + width; continue; }
      }
      value += ch + (next ?? ""); i += 2; continue;
    }
    if (ch === "'") return { value, end: i };
    value += ch;
    i++;
  }
  throw new Error("unterminated string literal in icons bundle");
}

const assets = {};
const missing = [];
for (const [icon, meta] of Object.entries(INCLUDE)) {
  /* keys may be unquoted (valid identifiers) or quoted ("c++", "c#") */
  const needles = [
    `${icon}:{svg:{light:'`,
    `"${icon}":{svg:{light:'`,
    `'${icon}':{svg:{light:'`
  ];
  let idx = -1;
  for (const needle of needles) {
    idx = src.indexOf(needle, start);
    if (idx >= 0) break;
  }
  if (idx < 0) { missing.push(icon); continue; }
  const svgStart = idx + needles.find(n => src.startsWith(n, idx)).length;
  const { value } = readSingleQuoted(src, svgStart);
  let svg = value.replace(/<title>[\s\S]*?<\/title>/g, "");
  svg = uniquifyIds(svg, "ti-" + icon);
  assets[icon] = { label: meta.label, svg };
}

const header = `/* ==========================================================================
 * tech-icons-data.js - technology SVG assets for the shared icon pills
 *
 * GENERATED FILE - do not edit. Regenerate after upgrading tech-stack-icons:
 *   cd frontend && npm run tech-icons:generate
 *
 * SVG path/markup data extracted verbatim from the installed
 * tech-stack-icons package (MIT, https://tech-stack-icons.com).
 * Internal icon ids are namespaced (ti-<icon>-) so multiple inline
 * instances can coexist in one page without clip-path collisions.
 * ========================================================================== */
`;
const body = "window.TechIconAssets = " + JSON.stringify(assets) + ";\n";
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, header + body, "utf8");

const size = Math.round(fs.statSync(out).size / 1024);
console.log(`written ${out} (${size} KB), ${Object.keys(assets).length} icons`);
if (missing.length) console.log("MISSING from package: " + missing.join(", "));
