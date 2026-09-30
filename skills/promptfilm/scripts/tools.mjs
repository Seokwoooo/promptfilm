// Where the outside programs are. ffmpeg: $FFMPEG, else the one on PATH, else the local copy setup.mjs installs (ffmpeg-static,
// in node_modules — no admin rights needed). Uses nothing but Node, so setup.mjs can load it before the packages exist.
//   node tools.mjs ffmpeg        prints the ffmpeg to use (for shell scripts: FF=$(node tools.mjs ffmpeg))
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(HERE, 'package.json'));

export const runs = (bin, args = ['-hide_banner', '-version']) => {
  try { return spawnSync(bin, args, { stdio: 'pipe', timeout: 20000 }).status === 0; } catch (e) { return false; }
};
// the local copy's path (whether or not it has been downloaded yet), or null when ffmpeg-static isn't installed / has no build here
export function localFfmpegPath() { try { return require('ffmpeg-static') || null; } catch (e) { return null; } }

let FF = null;
export function ffmpegBin() {
  if (FF) return FF;
  if (process.env.FFMPEG) return (FF = process.env.FFMPEG);
  if (runs('ffmpeg')) return (FF = 'ffmpeg');
  const local = localFfmpegPath();
  if (local && fs.existsSync(local) && runs(local)) return (FF = local);
  return 'ffmpeg';                                              // none: the caller's error names it (sh scripts/setup.sh installs one)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === 'ffmpeg') console.log(ffmpegBin());
