// @originjs/vite-plugin-federation (last released for Rollup-based Vite) ships
// a post-build step that substitutes a `__v__css__<path>` placeholder in
// remoteEntry.js with a real array of that exposed module's CSS chunk names.
// Under Vite 8's Rolldown-based bundler that substitution never runs, leaving
// the literal placeholder string in place — which crashes at runtime with
// "e.forEach is not a function" the moment a host tries to load this remote,
// since dynamicLoadingCss() expects an array. We inject our own CSS via a
// static <link> in the host's index.html instead, so it's safe to neutralize
// the placeholder into an empty array here.
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', 'dist', 'assets', 'remoteEntry.js');
const content = fs.readFileSync(file, 'utf8');
const fixed = content.replace(/(["'`])__v__css__.*?\1/g, '[]');

if (fixed !== content) {
  fs.writeFileSync(file, fixed);
  console.log('Patched remoteEntry.js: replaced __v__css__ placeholder with [].');
} else {
  console.log('remoteEntry.js: no placeholder found, nothing to patch.');
}
