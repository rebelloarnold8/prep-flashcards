#!/usr/bin/env python3
"""Convert the menubar-toolkit concepts.txt (TOPIC ::: Q ::: A) into flashcard JSON.
Usage: python3 convert_concepts.py /path/to/concepts.txt  > extra.json
Then merge the printed array into cards.json."""
import sys, json
if len(sys.argv) < 2:
    sys.exit("usage: convert_concepts.py <concepts.txt>")
out = []
with open(sys.argv[1], encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split(":::")]
        if len(parts) >= 3:
            out.append({"topic": parts[0].upper(), "q": parts[1], "a": parts[2]})
print(json.dumps(out, indent=2, ensure_ascii=False))
