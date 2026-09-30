#!/usr/bin/env node
// Is this the environment the skill is made and checked for? Recommended: Claude Code, with Claude Opus 5.5, Sonnet 5.5 or Fable 5.1
// or newer, at medium effort or above. Anything else still runs — this only prints a notice for the requester to read.
//   node env_check.mjs --model <your exact model id or name> [--lang en|ko] [--json]
// The model is passed by the agent (it knows its own model from its instructions). The host is the nearest agent among the processes
// that launched this one — environment variables can be inherited, e.g. another agent started from a Claude Code terminal still carries
// CLAUDECODE=1 — else the environment (host.mjs); the effort from CLAUDE_EFFORT, else ~/.claude/settings.json.
// In any host that is not Claude Code, the notice always shows.
import fs from 'fs';
import { hostOf } from './host.mjs';
import os from 'os';
import path from 'path';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const lang = opt('lang', 'en') === 'ko' ? 'ko' : 'en';
const model = String(opt('model', '') || '').trim();
const env = process.env;

// the host: the agent that launched us (host.mjs — the process tree first, then the environment)
const host = hostOf();

// the model: family and version from an id or a name ('claude-opus-5-5', 'Opus 5.5', 'claude-sonnet-5-5', 'claude-fable-5-1', 'claude-opus-6' …)
function parseModel(m) {
  const f = /(fable|opus|sonnet|haiku)/i.exec(m); if (!f) return { family: m ? 'other' : null, version: null };
  const v = /^[\s_-]*(\d+)(?:[\s._-](\d{1,2})(?!\d))?/.exec(m.slice(f.index + f[1].length));
  return { family: f[1].toLowerCase(), version: v ? +v[1] + (v[2] ? +v[2] / 10 : 0) : null };
}
const M = parseModel(model);
const MIN = { opus: 5.5, sonnet: 5.5, fable: 5.1 };           // recommended families and their lowest versions
const modelOk = M.family in MIN && M.version != null && M.version >= MIN[M.family] - 1e-9;

// the effort
let effort = env.CLAUDE_EFFORT || null;
if (!effort && host === 'claude-code') { try { effort = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude', 'settings.json'), 'utf8')).effortLevel || null; } catch (e) {} }
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const effortOk = effort == null ? null : EFFORTS.indexOf(String(effort).toLowerCase()) >= 1;

const T = {
  ko: { host: h => h === 'unknown' ? 'Claude Code 아님' : `Claude Code 아님 (${h})`, model: m => m || '모델 확인 불가', effort: e => `effort ${e}`,
        ok: (m, e) => `환경 확인: Claude Code · ${m}${e ? ` · effort ${e}` : ''} — 권장 환경이에요.`,
        notice: r => `⚠️ 권장 환경(Claude Code · Opus 5.5↑ / Sonnet 5.5↑ / Fable 5.1↑ · effort medium↑)이 아니라서 품질을 보장할 수 없어요. (지금: ${r.join(' · ')})` },
  en: { host: h => h === 'unknown' ? 'not Claude Code' : `not Claude Code (${h})`, model: m => m || 'model unknown', effort: e => `effort ${e}`,
        ok: (m, e) => `Environment: Claude Code · ${m}${e ? ` · effort ${e}` : ''} — as recommended.`,
        notice: r => `⚠️ Not the recommended setup (Claude Code · Opus 5.5+ / Sonnet 5.5+ / Fable 5.1+ · effort medium+), so quality can't be guaranteed. (Now: ${r.join(' · ')})` },
}[lang];
const reasons = [];
if (host !== 'claude-code') reasons.push(T.host(host));
if (!modelOk) reasons.push(T.model(model));
if (effortOk === false) reasons.push(T.effort(effort));

const result = { recommended: reasons.length === 0, host, model: model || null, family: M.family, version: M.version, effort, reasons };
if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
else console.log(result.recommended ? T.ok(model, effort) : T.notice(reasons));
