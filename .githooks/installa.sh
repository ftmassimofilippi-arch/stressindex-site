#!/bin/bash
# Installa il guardiano git in questo clone (una volta sola, dopo il clone): copia i hook in .git/hooks
# senza toccare quelli già presenti (nel CRM c'è già il pre-commit dei cancelli).
set -e
cd "$(dirname "$0")/.."
for h in .githooks/*; do
  n=$(basename "$h"); [ "$n" = "installa.sh" ] && continue
  if [ -e ".git/hooks/$n" ] && ! grep -q "GUARDIANO" ".git/hooks/$n"; then
    echo "  .git/hooks/$n esiste già: aggiungo il guardiano in coda"
    printf '\n# --- guardiano (lavoro a due) ---\nbash "$(git rev-parse --show-toplevel)/.githooks/%s" "$@" || exit 1\n' "$n" >> ".git/hooks/$n"
  else
    cp "$h" ".git/hooks/$n"
  fi
  chmod +x ".git/hooks/$n"
done
echo "Guardiano git installato."
