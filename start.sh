#!/bin/bash
cd "$(dirname "$0")"
echo "no cap fr fr serving on http://localhost:8765 rn bestie 🔥"
python3 -m http.server 8765 --bind 127.0.0.1
