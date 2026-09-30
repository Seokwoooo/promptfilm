#!/bin/sh
# Build the engine's own test films into engine/<name>-build/<name>.html — used to check the engine
# and the QA scripts; not a starting point for a film (start from film-template via scripts/new_film.sh).
cd "$(dirname "$0")"
# Two films: demo (a continuous journey through scale) and demo-ad (a shot-based product ad).
for d in demo demo-ad; do
  rm -rf "$d-build" && mkdir -p "$d-build/parts" && cp core/* "$d"/* "$d-build/parts/" &&
  sed -i.bak 's/data-length="45-60"/data-length="12-20"/' "$d-build/parts/p1_head.html" && rm "$d-build/parts/p1_head.html.bak" &&  # test films are short
  sh build.sh "$d-build" "$d"
done
