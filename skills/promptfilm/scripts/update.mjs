#!/usr/bin/env node
// Newer versions of promptfilm (setup.sh runs it first at step 0). When the skill runs from a Claude Code plugin install
// (<plugins>/cache/<marketplace>/<plugin>/<version>/skills/promptfilm), it asks the marketplace's git repository for its newest commit
// (about half a second; quiet offline). It installs nothing on its own: Claude Code leaves updates of a marketplace like this one to
// the user, and so does promptfilm.
//   node update.mjs             check: a newer version → one line for Claude to ask the requester (update now · always · not now);
//                               when they chose always (--always), it installs it instead; a newer version already installed (by
//                               another session, by hand, by Claude Code's own auto-update) → this run switches to it
//   node update.mjs --install   update now: Claude Code installs it (claude plugin marketplace update, claude plugin update)
//   node update.mjs --always    the same, and from now on install new versions without asking
//   node update.mjs --skip      not now: stay on this version; ask again when a still newer one is out
//   node update.mjs --ask       after --always: ask before each update again
//   --dry: say what it would do, change nothing (the selftest) · --skill <dir>: the copy to check (default: this one)
// After an update it prints `setup: promptfilm updated <old> → <new>. From now on <skill> is <dir> …` and, last, PF_SKILL=<dir>:
// setup.sh goes on from there, so the same run already uses the new version. The choice lives in ~/.promptfilm/update.json.
// PROMPTFILM_NO_UPDATE=1 turns the check off. Claude Code's own background auto-update (/plugin → Marketplaces → Enable auto-update)
// works alongside it.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const args = process.argv.slice(2), has = a => args.includes(a), WIN = process.platform === 'win32';
const DRY = has('--dry'), INSTALL = has('--install'), ALWAYS = has('--always'), SKIP = has('--skip'), ASK = has('--ask'), ACT = INSTALL || ALWAYS || SKIP;
const at = args.indexOf('--skill'), SKILL = path.resolve(at >= 0 ? args[at + 1] : path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const say = s => console.log('setup: ' + s), short = v => String(v).slice(0, 7);
if (process.env.PROMPTFILM_NO_UPDATE && !ACT && !ASK) process.exit(0);

const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const STATE = path.join(os.homedir(), '.promptfilm', 'update.json'), state = readJson(STATE) || {};
const save = s => { if (DRY) return; try { fs.mkdirSync(path.dirname(STATE), { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(s, null, 1) + '\n'); } catch (e) {} };
if (ASK) { const { mode, ...rest } = state; save(rest); say('promptfilm asks again before each update'); process.exit(0); }

// where this copy is installed: the plugins folder, the marketplace, the plugin and its version (Claude Code names the cache folder by it)
const m = /^(.*)[\\/]cache[\\/]([^\\/]+)[\\/]([^\\/]+)[\\/]([^\\/]+)[\\/]skills[\\/]promptfilm$/.exec(SKILL);
if (!m) { if (ACT) say('this copy of promptfilm is not a Claude Code plugin install — nothing to update here'); process.exit(0); }
const [, ROOT, MKT, PLUGIN, VERSION] = m, ID = `${PLUGIN}@${MKT}`, mine = state[ID] || {};
const remember = more => save({ ...state, ...(ALWAYS ? { mode: 'auto' } : {}), [ID]: { ...mine, version: VERSION, at: Date.now(), ...more } });

// the marketplace's repository, as Claude Code recorded it
const src = ((readJson(path.join(ROOT, 'known_marketplaces.json')) || {})[MKT] || {}).source || {};
const url = src.source === 'github' && src.repo ? `https://github.com/${src.repo}.git` : (src.source === 'git' || src.source === 'url') && /\.git$|^git@|^file:/.test(src.url || '') ? src.url : null;
if (!url) { if (ACT) say(`the ${MKT} marketplace is not a git repository — update it with: claude plugin update ${ID}`); process.exit(0); }

// its newest commit: asked at most every 20 minutes (setup.sh may run several times in a session); in between, the last answer
let latest = mine.version === VERSION && mine.latest && Date.now() - mine.at < 20 * 60e3 && !ACT ? mine.latest : null;
if (!latest) {
  const git = spawnSync('git', ['ls-remote', url, src.ref || 'HEAD'], { encoding: 'utf8', timeout: 10000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' } });
  latest = (/^([0-9a-f]{40})\s/m.exec(git.stdout || '') || [])[1];
  if (!latest) { if (ACT) say(`could not reach ${url} — try again later`); process.exit(0); }          // offline, or git missing
  remember({ latest });
}
const L = latest.slice(0, 12), newest = /^[0-9a-f]{12}$/.test(VERSION) && latest.startsWith(VERSION);
if (newest) { if (ALWAYS) remember({ latest }); if (ACT) say(`promptfilm ${short(VERSION)} is the newest version${ALWAYS ? ' — later versions will install without asking' : ''}`); process.exit(0); }

// the folder of the newest version, when it is installed already: the cache folder named by it, else an install record of it
// (records of other scopes and projects may hold other versions — never one of those)
const found = () => { const recs = [].concat(((readJson(path.join(ROOT, 'installed_plugins.json')) || {}).plugins || {})[ID] || []);
  return [path.join(ROOT, 'cache', MKT, PLUGIN, L), ...recs.filter(x => x && x.version === L).map(x => x.installPath)].filter(Boolean)
    .map(d => path.join(d, 'skills', 'promptfilm')).find(d => path.resolve(d) !== SKILL && fs.existsSync(path.join(d, 'SKILL.md'))); };
const goOn = (next, how) => { say(`promptfilm ${how} ${short(VERSION)} → ${short(latest)}. From now on <skill> is ${next} — read its SKILL.md again and follow it from step 0 (the next session loads it by itself)`);
  console.log('PF_SKILL=' + next); process.exit(0); };

const ready = found();
if (ready && !SKIP) { if (DRY) { console.log(`would switch to ${ready}`); process.exit(0); } remember({ latest }); goOn(ready, 'updated'); }
if (SKIP) { remember({ latest, skip: latest }); say(`staying on promptfilm ${short(VERSION)}; it asks again when a version newer than ${short(latest)} is out`); process.exit(0); }
if (!ACT && state.mode !== 'auto') {
  if (mine.skip === latest) process.exit(0);                       // they said not now to this very version
  const changes = src.source === 'github' && /^[0-9a-f]{12}$/.test(VERSION) ? ` — what changed: https://github.com/${src.repo}/compare/${VERSION}...${L}` : '';
  say(`a newer promptfilm is out: ${short(VERSION)} → ${short(latest)}${changes}. Nothing was installed: ask the requester (SKILL.md step 0)`);
  process.exit(0);
}
if (DRY) { console.log(`would update ${ID} ${VERSION} → ${L} (from ${url})`); process.exit(0); }

// install: Claude Code puts it in a new folder next to this one (sessions that loaded this one keep it)
const claude = (...a) => spawnSync(WIN ? 'claude.cmd' : 'claude', a, { encoding: 'utf8', timeout: 240000, shell: WIN });
const howTo = `claude plugin marketplace update ${MKT} && claude plugin update ${ID}`;
const r1 = claude('plugin', 'marketplace', 'update', MKT), r2 = r1.status === 0 ? claude('plugin', 'update', ID) : r1;
remember({ latest });
if (r2.status !== 0) {
  say(`promptfilm ${short(latest)} could not be installed${r2.error ? ` (${r2.error.code || r2.error.message})` : ''} — this run goes on with ${short(VERSION)}; to update: ${howTo}`);
  process.exit(0);
}
const next = found();
if (!next) { say(`promptfilm ${short(latest)} is installed; it loads in the next session (or after /reload-plugins) — this run goes on with ${short(VERSION)}`); process.exit(0); }
goOn(next, 'updated');
