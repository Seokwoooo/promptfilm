#!/bin/sh
# Assemble a film's parts into one HTML file:  sh build.sh [film-dir] [name]   (defaults: this script's dir, NAME or 'film')
# Order: head, core, the film's scene parts (p3–p6), post, the film's timeline (p8), the engine, tail — the engine reads
# what the film defines. Writes <film-dir>/<name>.html.
DIR=${1:-$(dirname "$0")}
NAME=${2:-${NAME:-film}}
cd "$DIR" || exit 1
P=parts
JS="$P/p2_core.js $(ls $P/p3*.js $P/p4*.js $P/p5*.js $P/p6*.js 2>/dev/null) $P/p7_post.js $(ls $P/p8*.js) $P/p9_engine.js"
# Every part runs in ONE module scope: a film name that repeats an engine name (FT, PREV, HUD, TAGS …) or another part's
# name stops the whole film with "Identifier has already been declared". Catch it here, with the files and lines.
DUP=$( { sed -n -E 's/^import \* as ([A-Za-z_$][A-Za-z0-9_$]*).*/\1/p' $P/p1_head.html
         sed -n -E 's/^import \{([^}]*)\}.*/\1/p' $P/p1_head.html | tr ',' '\n' | sed -E 's/.* as //; s/[[:space:]]//g'
         cat $JS | sed -n -E 's/^(export )?(async )?(const|let|var|function\*?|class)[[:space:]]+([A-Za-z_$][A-Za-z0-9_$]*).*/\4/p'
       } | grep -v '^$' | sort | uniq -d )
if [ -n "$DUP" ]; then
  echo "build stopped: these names are declared twice at the top level (all parts share one scope):"
  for n in $DUP; do grep -n -E "^(export )?(async )?(const|let|var|function\*?|class)[[:space:]]+$n([^A-Za-z0-9_$]|$)|^import .*[{ ,]$n[ ,}]|^import \* as $n " $P/p1_head.html $JS | sed "s/^/  $n  ←  /"; done
  echo "rename the film's one (e.g. a prefix for the film's own constants)."
  exit 1
fi
cat $P/p1_head.html $P/p2_core.js $(ls $P/p3*.js $P/p4*.js $P/p5*.js $P/p6*.js 2>/dev/null) \
    $P/p7_post.js $(ls $P/p8*.js) $P/p9_engine.js $P/p10_tail.html > "$NAME.html" || exit 1
echo "built $DIR/$NAME.html ($(wc -c < "$NAME.html" | tr -d ' ') bytes)"
