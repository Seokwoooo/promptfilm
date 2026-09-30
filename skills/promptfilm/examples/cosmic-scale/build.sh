#!/bin/sh
# Assemble the single-file film from its parts.
cd "$(dirname "$0")"
cat parts/p1_head.html parts/p0_data.js parts/p2_core.js parts/p3_bodies.js parts/p4_points.js parts/p5_maps.js parts/p6_volume.js parts/p7_post.js parts/p8_timeline.js parts/p9_tail.html > cosmic-scale.html
echo "built cosmic-scale.html ($(wc -c < cosmic-scale.html) bytes)"
