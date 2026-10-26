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
  await fs.copyFile(path.join(__dirname, 'index.html'), path.join(__dirname, 'dist/index.html'));
}

module.exports = build;
if (require.main === module) build().catch(error => { console.error(error); process.exitCode = 1; });
