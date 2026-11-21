// Reproducible static/server artifact. No environment files, tests or database SQL.
// Classic-script globals are intentional: identifier minification stays disabled.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const hash = text => crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
const read = file => fs.readFile(path.join(root, file), 'utf8');
const write = async (file, value) => {
  const target = path.resolve(output, file);
  if (!target.startsWith(output + path.sep)) throw new Error('Build path escaped dist');
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, value);
};
async function copyTree(directory, extensions, prefix = '') {
  for (const entry of await fs.readdir(path.join(root, directory), { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`Build refuses symbolic link: ${directory}/${entry.name}`);
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await copyTree(file, extensions, prefix);
    else if (extensions.has(path.extname(entry.name))) await write(path.join(prefix, file), await fs.readFile(path.join(root, file)));
  }
}
async function build() {
  // Fixed, verified workspace target only. Never remove a linked output directory.
  if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Unsafe build output');
  const old = await fs.lstat(output).catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (old?.isSymbolicLink()) throw new Error('dist must not be a symbolic link or junction');
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output);
  const entries = await fs.readdir(root, { withFileTypes: true });
  const report = { pages: [], scripts: [], node: process.version, esbuild: esbuild.version };
  const scriptHashes = new Map();
  for (const entry of entries.filter(entry => entry.isFile() && entry.name.endsWith('.js') && entry.name !== 'server.js')) {
    const source = await read(entry.name);
    const { code, warnings } = await esbuild.transform(source, {
      loader: 'js', target: 'es2022', minifyWhitespace: true, minifySyntax: true,
      minifyIdentifiers: false, legalComments: 'inline', sourcefile: entry.name,
    });
    if (warnings.length) throw new Error(`Build warnings in ${entry.name}: ${warnings.map(w => w.text).join('; ')}`);
    await write(path.join('public', entry.name), code);
    scriptHashes.set(entry.name, hash(code));
    report.scripts.push({ file: entry.name, before: Buffer.byteLength(source), after: Buffer.byteLength(code) });
  }
  const pages = entries.filter(entry => entry.isFile() && entry.name.endsWith('.html') && entry.name !== 'admin.html').map(entry => entry.name);
  pages.push('api/_lib/admin.html');
  for (const file of pages) {
    let html = await read(file);
    const links = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)];
    const sheets = links.map(([tag]) => tag.match(/href="\/?([^"?]+)(?:\?[^\"]*)?"/)?.[1]);
    if (sheets.some(name => !name || name.includes('..') || !name.endsWith('.css'))) throw new Error(`Unsupported stylesheet in ${file}`);
    const css = (await Promise.all(sheets.map(read))).join('\n');
    const { code, warnings } = await esbuild.transform(css, { loader: 'css', minify: true, target: ['chrome110', 'safari16'], legalComments: 'inline' });
    if (warnings.length) throw new Error(`CSS build warnings for ${file}: ${warnings.map(w => w.text).join('; ')}`);
    const bundle = `styles-${hash(code)}.css`;
    await write(path.join('public', bundle), code);
    links.forEach(([tag], index) => { html = html.replace(tag, index === 0 ? `<link rel="stylesheet" href="/${bundle}" />` : ''); });
    // Source CSS preloads would otherwise download a second, unused copy.
    html = html.replace(/<link\b[^>]*rel="preload"[^>]*as="style"[^>]*>/g, '');
    html = html.replace(/(<script\b[^>]*\bsrc=")(\/?)([^"?]+)(?:\?[^\"]*)?("[^>]*>)/g, (tag, prefix, slash, name, suffix) =>
      scriptHashes.has(name) ? `${prefix}${slash}${name}?v=${scriptHashes.get(name)}${suffix}` : tag);
    await write(file.startsWith('api/') ? file : path.join('public', file), html);
    report.pages.push({ file, cssRequestsBefore: sheets.length, cssRequestsAfter: 1, cssBytesBefore: Buffer.byteLength(css), cssBytesAfter: Buffer.byteLength(code), bundle });
  }
  await copyTree('assets', new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.woff2', '.js', '.json', '.txt']), 'public');
  // Copy only server code; the protected admin template above is the sole API HTML.
  await copyTree('api', new Set(['.js']));
  for (const file of ['server.js', 'package.json', 'package-lock.json', 'content-security-policy.json']) {
    await write(file, await fs.readFile(path.join(root, file)));
  }
  await write('public/skillmate-mark.svg', await fs.readFile(path.join(root, 'skillmate-mark.svg')));
  await write('build-report.json', JSON.stringify(report, null, 2));
  console.log(`Built ${pages.length} pages, ${report.scripts.length} classic scripts and isolated server/API files in dist.`);
  const app = report.pages.find(page => page.file === 'index.html');
  console.log(`Student CSS: ${app.cssRequestsBefore} -> ${app.cssRequestsAfter} requests; ${app.cssBytesBefore} -> ${app.cssBytesAfter} bytes (uncompressed).`);
}
build().catch(error => { console.error(error.message); process.exitCode = 1; });
