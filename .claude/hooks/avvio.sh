#!/bin/bash
# All'avvio di una sessione ricorda all'AI dove si trova. Il testo stampato entra nel contesto.
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
ramo=$(git symbolic-ref --short -q HEAD 2>/dev/null || echo "?")
autore=$(git config user.name 2>/dev/null || echo '?')
echo "Regole di lavoro a due: leggi REGOLE-A-DUE.md prima di toccare codice."
echo "Autore git: $autore. Ramo attuale: $ramo."
if [ "$ramo" = "main" ]; then
  echo "ATTENZIONE: sei su main. Prima di qualunque modifica crea un ramo: git fetch origin && git switch -c <nome>/<cosa> origin/main"
fi
exit 0
