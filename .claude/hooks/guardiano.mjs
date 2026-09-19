// Guardiano: ferma i gesti pericolosi PRIMA che partano, e spiega il perché all'AI.
// Claude Code lo chiama su ogni Bash / Write / Edit (hook PreToolUse). Uscita 2 = bloccato.
// Sul Mac di chi amministra (Matteo) il file ~/.lavoro-a-due-admin lo disattiva del tutto.
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const blocca = (motivo) => {
  process.stderr.write(`GUARDIANO (REGOLE-A-DUE.md): ${motivo}\n`);
  process.exit(2);
};

try {
  if (existsSync(join(homedir(), '.lavoro-a-due-admin'))) process.exit(0);
  const radice = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const grezzo = readFileSync(0, 'utf8');
  const dati = grezzo.trim() ? JSON.parse(grezzo) : {};
  const strumento = dati.tool_name || '';
  const input = dati.tool_input || {};

  const ramoAttuale = () => {
    try {
      return execSync('git symbolic-ref --short -q HEAD', { cwd: radice, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      return '';
    }
  };

  // --- File scritti direttamente (Write / Edit) ---
  if (strumento === 'Write' || strumento === 'Edit' || strumento === 'MultiEdit' || strumento === 'NotebookEdit') {
    const f = String(input.file_path || input.notebook_path || '');
    if (/(^|\/)\.env(\.|$)/.test(f)) blocca(`non si scrive nei file .env (${f}): i segreti non si toccano. Regola 4.`);
    if (/\/migrazioni\//.test(f) && !/\.test\.tsx?$/.test(f))
      blocca(`le migrazioni del database (${f}) le scrive solo Matteo: descrivi il bisogno nella proposta. Regola 3.`);
    if (/(^|\/)\.claude\/hooks\/|(^|\/)\.githooks\/|(^|\/)\.claude\/settings\.json$/.test(f))
      blocca(`il guardiano e gli automatismi (${f}) non si modificano dall'AI: se serve, si scrive nella proposta.`);
    process.exit(0);
  }

  if (strumento !== 'Bash') process.exit(0);
  const c = String(input.command || '');
  const ha = (re) => re.test(c);

  // --- Segreti ---
  if (ha(/(^|[\s;&|(])(cat|less|more|head|tail|bat|grep|rg|sed|awk|open|code|vim|nano|pbcopy|source|\.)\s+[^\n|;&]*\.env(\.[\w-]+)?(\s|$|['"])/) && !ha(/\.env\.example/))
    blocca('non si leggono né si stampano i file .env: una chiave finita in chat è bruciata. Regola 4.');
  if (ha(/(>|>>|tee)\s*['"]?[^\s'"]*\.env(\.[\w-]+)?\b/) && !ha(/\.env\.example/)) blocca('non si scrive nei file .env. Regola 4.');
  if (ha(/\b(cp|mv)\b[^\n|;&]*\.env(\.[\w-]+)?\b/) && !ha(/\.env\.example/)) blocca('non si copiano né spostano i file .env. Regola 4.');
  if (ha(/\b(printenv|env)\b\s*$/) || ha(/\becho\s+\$\{?\w*(KEY|TOKEN|SECRET|PASSWORD|SEGRETO|DATABASE_URL|DB_URL)/i))
    blocca('non si stampano le variabili con i segreti. Regola 4.');

  // --- Migrazioni ---
  if (ha(/\bnpm\s+run\s+migra\b/) || ha(/\bpsql\b[^\n|;&]*migrazioni\//) || ha(/\bpg_restore\b/))
    blocca('le migrazioni si applicano solo da Matteo, mai da un ramo di lavoro. Regola 3.');
  if (ha(/(>|>>|tee|touch|cp|mv)\s*['"]?[^\s'"]*\/migrazioni\/[^\s'"]*\.sql/))
    blocca('le migrazioni del database le scrive solo Matteo: descrivi il bisogno nella proposta. Regola 3.');

  // --- Git ---
  if (ha(/\bgit\s+push\b/)) {
    if (ha(/\s(-f|--force|--force-with-lease)\b/)) blocca('mai git push --force. Si apre una proposta, non si riscrive la storia.');
    if (ha(/\bgit\s+push\b[^\n|;&]*(\s|:)main(\s|$)/) || ha(/\bgit\s+push\b[^\n|;&]*--delete/) || ha(/\bgit\s+push\b[^\n|;&]*\s:\S/))
      blocca('non si spinge su main e non si cancellano rami sul server: si apre una proposta (gh pr create). Regola 1 e 5.');
    if (!ha(/\bgit\s+push\b[^\n|;&]*\s\S+\s+\S+/) && ramoAttuale() === 'main')
      blocca('sei su main: non si spinge main. Crea un ramo (git switch -c <nome>/<cosa>) e apri una proposta. Regola 1.');
  }
  if (ha(/\bgit\s+commit\b/) && ha(/\s(-a|-am|-aC|--all)\b/)) blocca('mai git commit -a: si committano solo i propri file (git commit -- <file…>). Regola 5.');
  if (ha(/\bgit\s+(commit|merge|rebase|cherry-pick|revert)\b/) && ramoAttuale() === 'main')
    blocca('sei su main: prima crea un ramo di lavoro (git fetch origin && git switch -c <nome>/<cosa> origin/main). Regola 1.');
  if (ha(/\bgit\s+(reset\s+--hard|clean\s+-\w*f|branch\s+-D)\b/)) blocca('niente gesti distruttivi (reset --hard, clean -f, branch -D): se serve, si scrive nella proposta.');
  if (ha(/\bgit\s+(add|commit)\b[^\n|;&]*\.env(\.[\w-]+)?\b/) && !ha(/\.env\.example/)) blocca('i file .env non si committano mai. Regola 4.');

  // --- Supabase (database e funzioni del cliente) ---
  if (ha(/\bsupabase\s+(db\s+(push|reset|remote|dump)|migration\s+up|link|functions\s+deploy)\b/))
    blocca('il database e le funzioni Supabase non si toccano da un ramo di lavoro: la migrazione si descrive nella proposta e si applica a mano dopo. Regola 3.');

  // --- GitHub e pubblicazione ---
  if (ha(/\bgh\s+pr\s+merge\b/)) blocca('le proposte le unisce Matteo dopo averle lette. Regola 5.');
  if (ha(/\bgh\s+(repo\s+delete|api\s+-X\s+DELETE|secret|ssh-key|auth\s+refresh)\b/)) blocca('impostazioni di GitHub: non dall\'AI. Si scrive nella proposta.');
  if (ha(/\b(vercel\s+(deploy|--prod|promote|alias)|rsync\b[^\n|;&]*:|ssh\s+[^\n|;&]*(vps|@)|docker\s+(build|run|compose)|scp\b)/i))
    blocca('non si pubblica e non si tocca il server da un ramo di lavoro: pubblica Matteo. Regola 5.');
} catch {
  // in caso di dubbio non si blocca il lavoro
}
process.exit(0);
