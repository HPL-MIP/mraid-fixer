const path = require('node:path');
const fs = require('node:fs/promises');
const esbuild = require('esbuild');

async function build() {
  await esbuild.build({
    absWorkingDir: __dirname,
    entryPoints: ['src/main.jsx'],
    outfile: 'dist/app.js',
    bundle: true,
    jsx: 'automatic',
    minify: true,
    sourcemap: true,
    define: { 'process.env.NODE_ENV': '"production"' },
    target: ['es2022'],
  });
  const distHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>MIP · Reposition Studio</title>
    <link rel="icon" href="data:," />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="./app.css" />
  </head>
  <body>
    <div id="root"></div>
    <script defer src="./app.js"></script>
  </body>
</html>
`;
  await fs.writeFile(path.join(__dirname, 'dist/index.html'), distHtml, 'utf8');
}

module.exports = build;
if (require.main === module) build().catch(error => { console.error(error); process.exitCode = 1; });
