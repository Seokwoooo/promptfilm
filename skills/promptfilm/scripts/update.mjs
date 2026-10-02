#!/usr/bin/env node
// Newer versions of promptfilm (setup.sh runs it first at step 0). promptfilm updates the way Claude Code updates plugins: with Claude
// Code's own auto-update for its marketplace — the switch under /plugin → Marketplaces → Enable auto-update, off by default for a
// marketplace like this one. Installed as a plugin (<plugins>/cache/<marketplace>/<plugin>/<version>/skills/promptfilm), it asks the
// marketplace's git repository for its newest commit (about half a second, at most every 20 minutes; quiet offline), then:
//   auto-update on         a newer version is installed at once (claude plugin update) — what Claude Code would do in the background
//   auto-update off        nothing (the requester said no; they can update or switch it on any time)
//   never decided          one line for Claude to ask the requester, once: turn automatic updates on · update this once · don't
//   a newer version already installed (by Claude Code in the background, or by hand) → this run switches to it
//   node update.mjs --auto-on    switch Claude Code's auto-update on for promptfilm (as the /plugin switch does), and update now
//   node update.mjs --install    update now, this once
//   node update.mjs --auto-off   switch it off (nobody is asked again)
//   --dry: say what it would do, change nothing (the selftest) · --skill <dir>: the copy to check (default: this one)
// After an update it prints `setup: promptfilm updated <old> → <new>. From now on <skill> is <dir> …` and, last, PF_SKILL=<dir>: setup.sh
// goes on from there, so the same run already uses the new version. PROMPTFILM_NO_UPDATE=1 turns the check off.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const args = process.argv.slice(2), has = a => args.includes(a), WIN = process.platform === 'win32';
const DRY = has('--dry'), ON = has('--auto-on'), OFF = has('--auto-off'), INSTALL = has('--install') || ON, ACT = INSTALL || OFF;
const at = args.indexOf('--skill'), SKILL = path.resolve(at >= 0 ? args[at + 1] : path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const say = s => console.log('setup: ' + s), short = v => String(v).slice(0, 7);
if (process.env.PROMPTFILM_NO_UPDATE && !ACT) process.exit(0);

const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
// rewrite a JSON file the way it was written — two-space indent, its own final newline or none, its permissions — through a temporary
// file next to it (next to the real file when it is a symbolic link, which stays a link)
const writeJson = (f, v) => {
  const real = fs.realpathSync(f), text = fs.readFileSync(real, 'utf8'), tmp = `${real}.promptfilm-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(v, null, 2) + (text.endsWith('\n') ? '\n' : ''), { mode: fs.statSync(real).mode & 0o777 });
  fs.renameSync(tmp, real);
};

// where this copy is installed: the plugins folder, the marketplace, the plugin and its version (Claude Code names the cache folder by it)
const m = /^(.*)[\\/]cache[\\/]([^\\/]+)[\\/]([^\\/]+)[\\/]([^\\/]+)[\\/]skills[\\/]promptfilm$/.exec(SKILL);
if (!m) { if (ACT) say('this copy of promptfilm is not a Claude Code plugin install — nothing to update here'); process.exit(0); }
const [, ROOT, MKT, PLUGIN, VERSION] = m, ID = `${PLUGIN}@${MKT}`;
const KNOWN = path.join(ROOT, 'known_marketplaces.json'), SETTINGS = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'settings.json');

// Claude Code's auto-update switch for this marketplace: the user settings' extraKnownMarketplaces entry first, then the marketplace record
// (the order Claude Code reads them in); undefined = never decided (off)
function autoUpdate() {
  const s = readJson(SETTINGS), v = s && s.extraKnownMarketplaces && s.extraKnownMarketplaces[MKT] && s.extraKnownMarketplaces[MKT].autoUpdate;
  if (typeof v === 'boolean') return v;
  const k = (readJson(KNOWN) || {})[MKT]; return k && typeof k.autoUpdate === 'boolean' ? k.autoUpdate : undefined;
}
// set it as the /plugin switch does: on the marketplace record, and on the settings entry when settings declare the marketplace
function setAutoUpdate(on) {
  if (DRY) return;
  const k = readJson(KNOWN); if (k && k[MKT]) { k[MKT].autoUpdate = on; writeJson(KNOWN, k); }
  const s = readJson(SETTINGS); if (s && s.extraKnownMarketplaces && s.extraKnownMarketplaces[MKT]) { s.extraKnownMarketplaces[MKT].autoUpdate = on; writeJson(SETTINGS, s); }
}

// the last look at the repository (a cache only: ~/.promptfilm/update.json). A requester who chose "always" in the version before
// this one gets Claude Code's switch on instead
const CACHE = path.join(os.homedir(), '.promptfilm', 'update.json'), cache = readJson(CACHE) || {}, mine = cache[ID] || {};
const saveCache = c => { if (DRY) return; try { fs.mkdirSync(path.dirname(CACHE), { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(c, null, 1) + '\n'); } catch (e) {} };
if (cache.mode && !DRY) { if (cache.mode === 'auto' && autoUpdate() === undefined) setAutoUpdate(true); delete cache.mode; saveCache(cache); }
const remember = latest => saveCache({ ...cache, [ID]: { version: VERSION, latest, at: Date.now() } });

if (OFF) { setAutoUpdate(false); say(`Claude Code's auto-update for promptfilm is off — promptfilm stays on ${short(VERSION)} until you update (ask Claude, or /plugin → Marketplaces → promptfilm)`); process.exit(0); }
if (ON) { setAutoUpdate(true); say('Claude Code now keeps promptfilm up to date by itself (/plugin → Marketplaces → promptfilm → auto-update: on)'); }

// the marketplace's repository, as Claude Code recorded it
const src = ((readJson(KNOWN) || {})[MKT] || {}).source || {};
const url = src.source === 'github' && src.repo ? `https://github.com/${src.repo}.git` : (src.source === 'git' || src.source === 'url') && /\.git$|^git@|^file:/.test(src.url || '') ? src.url : null;
if (!url) { if (INSTALL) say(`the ${MKT} marketplace is not a git repository — update with: claude plugin update ${ID}`); process.exit(0); }

// its newest commit: asked at most every 20 minutes (setup.sh may run several times in a session); in between, the last answer
let latest = mine.version === VERSION && mine.latest && Date.now() - mine.at < 20 * 60e3 && !INSTALL ? mine.latest : null;
if (!latest) {
  const git = spawnSync('git', ['ls-remote', url, src.ref || 'HEAD'], { encoding: 'utf8', timeout: 10000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' } });
  latest = (/^([0-9a-f]{40})\s/m.exec(git.stdout || '') || [])[1];
  if (!latest) { if (INSTALL) say(`could not reach ${url} — try again later`); process.exit(0); }          // offline, or git missing
  remember(latest);
}
const L = latest.slice(0, 12);
if (/^[0-9a-f]{12}$/.test(VERSION) && latest.startsWith(VERSION)) { if (INSTALL) say(`promptfilm ${short(VERSION)} is the newest version`); process.exit(0); }

// the folder of the newest version, when it is installed already: the cache folder named by it, else an install record of it
// (records of other scopes and projects may hold other versions — never one of those)
const found = () => { const recs = [].concat(((readJson(path.join(ROOT, 'installed_plugins.json')) || {}).plugins || {})[ID] || []);
  return [path.join(ROOT, 'cache', MKT, PLUGIN, L), ...recs.filter(x => x && x.version === L).map(x => x.installPath)].filter(Boolean)
    .map(d => path.join(d, 'skills', 'promptfilm')).find(d => path.resolve(d) !== SKILL && fs.existsSync(path.join(d, 'SKILL.md'))); };
const goOn = next => { say(`promptfilm updated ${short(VERSION)} → ${short(latest)}. From now on <skill> is ${next} — read its SKILL.md again and follow it from step 0 (the next session loads it by itself)`);
  console.log('PF_SKILL=' + next); process.exit(0); };

const ready = found();
if (ready) { if (DRY) { console.log(`would switch to ${ready}`); process.exit(0); } goOn(ready); }
const auto = autoUpdate();
if (!INSTALL && auto !== true) {
  if (auto === false) process.exit(0);                             // they said no: Claude Code's switch is off
  const changes = src.source === 'github' && /^[0-9a-f]{12}$/.test(VERSION) ? ` — what changed: https://github.com/${src.repo}/compare/${VERSION}...${L}` : '';
  say(`a newer promptfilm is out: ${short(VERSION)} → ${short(latest)}${changes}. Claude Code's auto-update for promptfilm is not set: ask the requester (SKILL.md step 0)`);
  process.exit(0);
}
if (DRY) { console.log(`would update ${ID} ${VERSION} → ${L} (from ${url})`); process.exit(0); }

// install: Claude Code puts it in a new folder next to this one (sessions that loaded this one keep it)
const claude = (...a) => spawnSync(WIN ? 'claude.cmd' : 'claude', a, { encoding: 'utf8', timeout: 240000, shell: WIN });
const howTo = `claude plugin marketplace update ${MKT} && claude plugin update ${ID}`;
const r1 = claude('plugin', 'marketplace', 'update', MKT), r2 = r1.status === 0 ? claude('plugin', 'update', ID) : r1;
if (r2.status !== 0) {
  say(`promptfilm ${short(latest)} could not be installed${r2.error ? ` (${r2.error.code || r2.error.message})` : ''} — this run goes on with ${short(VERSION)}; to update: ${howTo}`);
  process.exit(0);
}
const next = found();
if (!next) { say(`promptfilm ${short(latest)} is installed; it loads in the next session (or after /reload-plugins) — this run goes on with ${short(VERSION)}`); process.exit(0); }
goOn(next);
