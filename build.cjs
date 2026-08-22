// Production build: minifies the JS/CSS that ship internal engineering
// comments (bug history, founder-feedback quotes, reasoning about pricing
// logic) as plain readable text today, and copies everything else through
// unchanged. Output goes to dist/ - vercel.json points Vercel's build at
// this script and serves dist/ as the deployed root, so the *source* files
// in the repo stay exactly as they are for editing; only what actually
// ships to a visitor's browser changes.
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const OUT = path.join(ROOT, "dist");

function clean() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (entry === ".gitkeep") continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

async function minifyJs(file) {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, file)],
    bundle: false,
    minify: true,
    legalComments: "none",
    write: false,
    target: "es2019",
  });
  fs.writeFileSync(path.join(OUT, file), result.outputFiles[0].contents);
}

async function minifyCss(file) {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, file)],
    bundle: false,
    minify: true,
    loader: { [`.${file.split(".").pop()}`]: "css" },
    write: false,
  });
  fs.writeFileSync(path.join(OUT, file), result.outputFiles[0].contents);
}

async function main() {
  clean();

  await minifyJs("script.js");
  await minifyJs("airports.js");
  await minifyCss("style.css");

  // Passed through unchanged: HTML has no internal-narrative comments like
  // script.js/style.css do, and binary assets (images/fonts) aren't
  // minifiable text in the first place.
  for (const file of ["index.html", "privacy.html", "terms.html", "favicon-32.png", "favicon.svg", "apple-touch-icon.png", "og-image.png"]) {
    copyRecursive(path.join(ROOT, file), path.join(OUT, file));
  }
  copyRecursive(path.join(ROOT, "assets"), path.join(OUT, "assets"));

  console.log("[build] dist/ ready");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
