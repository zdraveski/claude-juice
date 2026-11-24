// Prints the CHANGELOG.md entry for a version tag, for the release workflow's notes.
// Fails if the tag does not match package.json and .claude-plugin/plugin.json, or has no changelog entry,
// so a half-finished release never gets published.
// Usage: node scripts/release-notes.mjs v1.5.3
import { readFileSync } from 'node:fs';

const tag = process.argv[2] ?? '';
const fail = (msg) => { console.error(`release: ${msg}`); process.exit(1); };
if (!/^v\d+\.\d+\.\d+$/.test(tag)) fail(`"${tag}" is not a version tag like v1.5.3`);
const version = tag.slice(1);

for (const file of ['package.json', '.claude-plugin/plugin.json']) {
  const found = JSON.parse(readFileSync(file, 'utf8')).version;
  if (found !== version) fail(`${file} says ${found}, the tag says ${version}`);
}

const lines = readFileSync('CHANGELOG.md', 'utf8').split(/\r?\n/);
const start = lines.findIndex((l) => l.startsWith(`## ${version} `) || l === `## ${version}`);
if (start === -1) fail(`CHANGELOG.md has no "## ${version}" entry`);
let end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
if (end === -1) end = lines.length;
const notes = lines.slice(start + 1, end).join('\n').trim();
if (!notes) fail(`the CHANGELOG.md entry for ${version} is empty`);
console.log(notes);
