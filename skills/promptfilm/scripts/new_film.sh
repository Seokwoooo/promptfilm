#!/bin/sh
# Start a new film:  sh new_film.sh <film-dir> <name> [--aspect 9x16|16x9|1x1|4x5] [--length 45-60] [--langs "en ko"]
# Copies the engine (core parts) and the empty film template into <film-dir>/parts, adds build.sh, research/ and plan.md, and writes
# the kickoff answers (aspect, target loop length in seconds, caption languages) onto the frame in parts/p1_head.html.
set -e
SKILL=$(cd "$(dirname "$0")/.." && pwd)
DIR=$1; NAME=$2
[ -n "$DIR" ] && [ -n "$NAME" ] || { echo "usage: sh new_film.sh <film-dir> <name> [--aspect 9x16] [--length 45-60] [--langs \"en ko\"]"; exit 2; }
shift 2
ASPECT=9x16; LENGTH=45-60; LANGS="en ko"
while [ $# -gt 0 ]; do
  case $1 in
    --aspect) ASPECT=$2; shift 2 ;;
    --length) LENGTH=$2; shift 2 ;;
    --langs)  LANGS=$2; shift 2 ;;
    *) echo "unknown option $1"; exit 2 ;;
  esac
done
case $ASPECT in 9x16|16x9|1x1|4x5) ;; *) echo "--aspect must be 9x16, 16x9, 1x1 or 4x5 (got $ASPECT)"; exit 2 ;; esac
echo "$LENGTH" | grep -Eq '^[0-9]+-[0-9]+$' || { echo "--length must be MIN-MAX seconds, e.g. 45-60 (got $LENGTH)"; exit 2; }
[ -e "$DIR/parts" ] && { echo "$DIR/parts already exists — not overwriting"; exit 1; }

# a Noto family for every language whose script Barlow does not cover (Barlow covers Latin, incl. Vietnamese)
FAMS=""; FACES=""
for l in $LANGS; do
  case $l in
    ko*) f="Noto Sans KR" ;;  ja*) f="Noto Sans JP" ;;  zh-TW|zh-HK|zh-Hant*) f="Noto Sans TC" ;;  zh*) f="Noto Sans SC" ;;
    th*) f="Noto Sans Thai" ;;  hi*|mr*|ne*) f="Noto Sans Devanagari" ;;  ar*|fa*|ur*) f="Noto Sans Arabic" ;;  he*) f="Noto Sans Hebrew" ;;
    ru*|uk*|bg*|sr*|el*|kk*) f="Noto Sans" ;;
    *) f="" ;;
  esac
  [ -z "$f" ] && continue
  case "$FACES" in *"\"$f\""*) continue ;; esac
  FAMS="$FAMS&family=$(echo "$f" | tr ' ' '+'):wght@500"
  FACES="${FACES:+$FACES, }\"$f\""
done
case " $LANGS " in *" ar"*|*" fa"*|*" ur"*|*" he"*) echo "note: right-to-left lines are set right to left; look at the captions and labels once by eye" ;; esac

mkdir -p "$DIR/parts" "$DIR/research/refs" "$DIR/qa"
cp "$SKILL"/engine/core/* "$DIR/parts/"
cp "$SKILL"/engine/film-template/* "$DIR/parts/"
H="$DIR/parts/p1_head.html"
FAMS_SED=$(printf '%s' "$FAMS" | sed 's/&/\\\&/g')      # '&' means "the match" in a sed replacement
sed -e "s#data-aspect=\"9x16\" data-langs=\"en ko\" data-length=\"45-60\"#data-aspect=\"$ASPECT\" data-langs=\"$LANGS\" data-length=\"$LENGTH\"#" \
    -e "s#&family=Noto+Sans+KR:wght@500#$FAMS_SED#" \
    -e "s#--face-lang: \"Noto Sans KR\";#--face-lang: ${FACES:-sans-serif};#" "$H" > "$H.tmp" && mv "$H.tmp" "$H"
sed "s#^NAME=\${2:-\${NAME:-film}}#NAME=\${2:-\${NAME:-$NAME}}#" "$SKILL/engine/build.sh" > "$DIR/build.sh"
sed "s#^const NAME = 'film';#const NAME = '$NAME';#" "$SKILL/engine/build.mjs" > "$DIR/build.mjs"     # the same build without a shell (node build.mjs)
[ -e "$DIR/plan.md" ] || sed -e "s#^- Aspect / length / languages (kickoff):.*#- Aspect / length / languages (kickoff): $ASPECT · $LENGTH s · $LANGS#" "$SKILL/references/plan-template.md" > "$DIR/plan.md"
echo "new film in $DIR  ($ASPECT · one loop $LENGTH s · captions: $LANGS)"
echo "  parts/     p1_head.html (title + header comment), p3_scene.js, p8_timeline.js are yours; p2/p7/p9/p10 are the engine"
echo "  build:     sh $DIR/build.sh   ->  $DIR/$NAME.html"
echo "  QA:        node $SKILL/scripts/qa.mjs http://127.0.0.1:8765/<path to $NAME.html> --out $DIR/qa"
