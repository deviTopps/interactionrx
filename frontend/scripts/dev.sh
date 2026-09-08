#!/bin/bash
PORT="${PORT:-3000}"

echo "Starting InteractionRX frontend on http://localhost:${PORT}"
exec npx next dev -p "$PORT"
