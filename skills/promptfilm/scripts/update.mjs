#!/usr/bin/env node
// Keeps promptfilm up to date (setup.sh runs it first at step 0). When the skill runs from a Claude Code plugin install
// (<plugins>/cache/<marketplace>/<plugin>/<version>/skills/promptfilm), it asks the marketplace's git repository for its newest commit
// and, when that is not the installed version, installs it with Claude Code's own commands (claude plugin marketplace update,
// claude plugin update). It then prints one line for the requester and, last, PF_SKILL=<the new skill folder>: setup.sh goes on from
// there, so this very run already uses the new version. Uses nothing but Node and git; quiet when there is nothing to do, offline, or
// not a plugin install (a copied skill, Codex, a development checkout).
//   node update.mjs [--dry] [--skill <dir>]     --dry: say what it would do, change nothing (the selftest)
// PROMPTFILM_NO_UPDATE=1 turns it off. Claude Code's own background auto-update (/plugin → Marketplaces → Enable auto-update) works
// alongside it.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const args = process.argv.slice(2), DRY = args.includes('--dry'), WIN = process.platform === 'win32';
const at = args.indexOf('--skill'), SKILL = path.resolve(at >= 0 ? args[at + 1] : path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const say = s => console.log('setup: ' + s);
if (process.env.PROMPTFILM_NO_UPDATE) process.exit(0);

// where this copy is installed: the plugins folder, the marketplace, the plugin and its version (Claude Code names the cache folder by it)
const m = /^(.*)[\\/]cache[\\/]([^\\/]+)[\\/]([^\\/]+)[\\/]([^\\/]+)[\\/]skills[\\/]promptfilm$/.exec(SKILL);
if (!m) process.exit(0);
const [, ROOT, MKT, PLUGIN, VERSION] = m, ID = `${PLUGIN}@${MKT}`;
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };

// at most one look every 20 minutes (setup.sh may run several times in a session)
const STATE = path.join(os.homedir(), '.promptfilm', 'update.json'), state = readJson(STATE) || {};
if (!DRY && state[ID] && state[ID].version === VERSION && Date.now() - state[ID].at < 20 * 60e3) process.exit(0);
const remember = latest => { if (DRY) return; try { fs.mkdirSync(path.dirname(STATE), { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify({ ...state, [ID]: { version: VERSION, latest, at: Date.now() } }, null, 1) + '\n'); } catch (e) {} };

// the marketplace's repository, as Claude Code recorded it
const src = ((readJson(path.join(ROOT, 'known_marketplaces.json')) || {})[MKT] || {}).source || {};
const url = src.source === 'github' && src.repo ? `https://github.com/${src.repo}.git` : (src.source === 'git' || src.source === 'url') && /\.git$|^git@|^file:/.test(src.url || '') ? src.url : null;
if (!url) process.exit(0);                                         // a directory or hosted-json marketplace: Claude Code's update covers it
const git = spawnSync('git', ['ls-remote', url, src.ref || 'HEAD'], { encoding: 'utf8', timeout: 10000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' } });
const latest = (/^([0-9a-f]{40})\s/m.exec(git.stdout || '') || [])[1];
if (!latest) process.exit(0);                                      // offline, or git missing: try again next time
if (/^[0-9a-f]{12}$/.test(VERSION) && latest.startsWith(VERSION)) { remember(latest); process.exit(0); }
if (DRY) { console.log(`would update ${ID} ${VERSION} → ${latest.slice(0, 12)} (from ${url})`); process.exit(0); }

// newer: Claude Code installs it (a new folder next to this one; sessions that loaded this one keep it)
const claude = (...a) => spawnSync(WIN ? 'claude.cmd' : 'claude', a, { encoding: 'utf8', timeout: 240000, shell: WIN });
const howTo = `claude plugin marketplace update ${MKT} && claude plugin update ${ID}`;
const r1 = claude('plugin', 'marketplace', 'update', MKT), r2 = r1.status === 0 ? claude('plugin', 'update', ID) : r1;
remember(latest);
if (r2.status !== 0) {
  say(`a newer promptfilm is out (${latest.slice(0, 7)}) but it could not install itself${r2.error ? ` (${r2.error.code || r2.error.message})` : ''} — this run goes on with ${VERSION.slice(0, 7)}; to update: ${howTo}`);
  process.exit(0);
}
// the folder it installed: the cache folder named by the new version, else an install record of that version (records of other scopes
// and projects may hold other versions — never one of those)
const recs = [].concat(((readJson(path.join(ROOT, 'installed_plugins.json')) || {}).plugins || {})[ID] || []);
const dirs = [path.join(ROOT, 'cache', MKT, PLUGIN, latest.slice(0, 12)), ...recs.filter(x => x && x.version === latest.slice(0, 12)).map(x => x.installPath)]
  .filter(Boolean).map(d => path.join(d, 'skills', 'promptfilm'));
const next = dirs.find(d => path.resolve(d) !== SKILL && fs.existsSync(path.join(d, 'SKILL.md')));
if (!next) { say(`promptfilm updated to ${latest.slice(0, 7)}; it loads in the next session (or after /reload-plugins) — this run goes on with ${VERSION.slice(0, 7)}`); process.exit(0); }
say(`promptfilm updated ${VERSION.slice(0, 7)} → ${latest.slice(0, 7)}. From now on <skill> is ${next} — read its SKILL.md again and follow it (the next session loads it by itself)`);
console.log('PF_SKILL=' + next);
