// Which agent host runs this process: 'claude-code', the name of another coding agent, or 'unknown'. Used by env_check.mjs (the
// environment notice: the skill is made and checked in Claude Code; anywhere else the notice shows).
// First the nearest agent among the processes that launched this one — environment variables can be inherited (another agent started
// from a Claude Code terminal still carries CLAUDECODE=1) — then the environment (CLAUDECODE, AI_AGENT).
import path from 'path';
import { execFileSync } from 'child_process';

// other coding agents, by the name of their executable (or of the script a node / bun / deno runtime runs)
const OTHERS = ['codex', 'gemini', 'cursor-agent', 'opencode', 'aider', 'goose', 'amp', 'qwen', 'crush'];

export function agentAncestor() {
  if (process.platform === 'win32') return null;
  let pid = process.ppid;
  for (let i = 0; i < 16 && pid > 1; i++) {
    let out = ''; try { out = execFileSync('ps', ['-o', 'ppid=,comm=,args=', '-p', String(pid)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch (e) { return null; }
    const m = /^(\d+)\s+(\S+)\s*([\s\S]*)$/.exec(out); if (!m) return null;
    // what runs: the executable, or — for a script runtime (node, bun, deno) — the script it runs. Never a shell's command text: a shell
    // that merely mentions an agent's name in its command is not that agent. (macOS cuts the comm column at 16 characters: the
    // executable's name comes from the command's first word too.)
    const argv = m[3].split(/\s+/), exe = [path.basename(m[2]), path.basename(argv[0] || '')].map(x => x.toLowerCase());
    const script = exe.some(x => /^(node|nodejs|bun|deno)$/.test(x)) ? (argv.slice(1).find(a => a && !a.startsWith('-')) || '') : '';
    const what = [...exe, path.basename(script).toLowerCase()], full = script.toLowerCase();
    if (what.some(w => /^claude([.]js)?$/.test(w)) || full.includes('@anthropic-ai/claude-code')) return 'claude-code';
    const other = OTHERS.find(o => what.some(w => w === o || w.startsWith(o + '-') || w.startsWith(o + '.')));
    if (other) return other;
    pid = +m[1];
  }
  return null;
}

export function hostOf(env = process.env) {
  return agentAncestor() || (env.CLAUDECODE === '1' ? 'claude-code' : env.AI_AGENT ? String(env.AI_AGENT).split(/[_\s]/)[0] : 'unknown');
}
