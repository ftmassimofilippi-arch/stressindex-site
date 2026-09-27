// Diario delle richieste: ogni prompt scritto a Claude Code finisce in diario/AAAA-MM-GG-<autore>.md
// con ora, ramo e sessione. Serve a chi ripara un difetto per capire qual era l'obiettivo.
// Non deve MAI bloccare il lavoro: qualunque errore viene ignorato e il programma esce con 0.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { userInfo } from 'node:os';

try {
  const radice = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const grezzo = readFileSync(0, 'utf8');
  const dati = grezzo.trim() ? JSON.parse(grezzo) : {};
  const prompt = (dati.prompt || '').trim();
  if (!prompt) process.exit(0);

  const comando = (c) => {
    try {
      return execSync(c, { cwd: radice, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      return '';
    }
  };
  const autore = comando('git config user.name') || userInfo().username || 'sconosciuto';
  const ramo = comando('git symbolic-ref --short -q HEAD') || '?';
  const slug =
    autore
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'sconosciuto';

  const adesso = new Date();
  const zero = (n) => String(n).padStart(2, '0');
  const giorno = `${adesso.getFullYear()}-${zero(adesso.getMonth() + 1)}-${zero(adesso.getDate())}`;
  const ora = `${zero(adesso.getHours())}:${zero(adesso.getMinutes())}`;
  const sessione = String(dati.session_id || '').slice(0, 8) || '?';

  const cartella = join(radice, 'diario');
  if (!existsSync(cartella)) mkdirSync(cartella, { recursive: true });
  const file = join(cartella, `${giorno}-${slug}.md`);
  if (!existsSync(file)) {
    appendFileSync(file, `# Diario delle richieste · ${giorno} · ${autore}\n`);
  }
  const corpo = prompt
    .split('\n')
    .map((r) => `> ${r}`)
    .join('\n');
  appendFileSync(file, `\n## ${ora} · ramo \`${ramo}\` · sessione ${sessione}\n\n${corpo}\n`);
} catch {
  // mai bloccare il lavoro per il diario
}
process.exit(0);
