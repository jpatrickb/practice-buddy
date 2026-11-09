import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import * as cmd from './commands';
import { resolveTarget } from './env';
import { UserError } from './errors';
import { WranglerStorage } from './storage';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

const HELP = `choir: manage songs, choirs and links for practice-buddy

Usage: pnpm choir <command> [options]

Songs
  init-song <folder>                   write a starter song.yaml for the audio files in <folder>
  add-song <folder>                    encode and upload the song described by <folder>/song.yaml
      --dry-run                        do everything except upload (safe to try)
      --allow-lossy                    accept MP3/AAC sources (not recommended)
Choirs and links
  add-choir <choir-id> --name "..."    create a choir
  add-song-to-choir <choir-id> <song-id>
  remove-song-from-choir <choir-id> <song-id>
  delete-song <song-id>                permanently delete a song and its audio (must not be in any choir)
      --from-all-choirs                remove it from every choir first, then delete
      --dry-run                        show what would be deleted
  new-link <choir-id> [--label "..."]  make a link (shown once!)
  revoke-link <choir-id> <label>       disable a link
  list                                 show choirs, songs and links (never the link URLs)

Options (all commands)
  --env local|dev|prod                 where to work (default: dev). local = the data 'pnpm dev' uses
  --yes                                skip the "Upload to PRODUCTION?" question

First time: pnpm exec wrangler login    Full guide: docs/adding-songs.md
`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      env: { type: 'string' },
      yes: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      'allow-lossy': { type: 'boolean' },
      force: { type: 'boolean' },
      'from-all-choirs': { type: 'boolean' },
      name: { type: 'string' },
      label: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [command, ...args] = positionals;
  if (!command || values.help || command === 'help') return console.log(HELP);

  const need = (n: number, usage: string) => {
    if (args.length !== n) throw new UserError(`Usage: pnpm choir ${command} ${usage}`);
  };
  const target = resolveTarget(values.env);
  const ctx: cmd.Ctx = {
    storage: new WranglerStorage(target, repoRoot),
    target,
    log: (l) => console.log(l),
    yes: values.yes,
    today: () => new Date().toLocaleDateString('en-CA'),
    ask: async (q) => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      try {
        return await rl.question(q);
      } finally {
        rl.close();
      }
    },
    confirm: async (q) => /^y(es)?$/i.test((await ctx.ask(q)).trim()),
  };

  switch (command) {
    case 'init-song':
      need(1, '<folder>');
      return cmd.initSong(ctx, args[0]!, values.force);
    case 'add-song':
      need(1, '<folder> [--dry-run]');
      return void (await cmd.addSong(ctx, args[0]!, {
        dryRun: values['dry-run'],
        allowLossy: values['allow-lossy'],
      }));
    case 'add-choir':
      need(1, '<choir-id> --name "Display Name"');
      return cmd.addChoir(ctx, args[0]!, values.name);
    case 'add-song-to-choir':
      need(2, '<choir-id> <song-id>');
      return cmd.addSongToChoir(ctx, args[0]!, args[1]!);
    case 'remove-song-from-choir':
      need(2, '<choir-id> <song-id>');
      return cmd.removeSongFromChoir(ctx, args[0]!, args[1]!);
    case 'delete-song':
      need(1, '<song-id> [--from-all-choirs] [--dry-run]');
      return cmd.deleteSong(ctx, args[0]!, {
        dryRun: values['dry-run'],
        fromAllChoirs: values['from-all-choirs'],
      });
    case 'new-link':
      need(1, '<choir-id> [--label "text"]');
      return cmd.newLink(ctx, args[0]!, values.label);
    case 'revoke-link':
      need(2, '<choir-id> "<label>"');
      return cmd.revokeLink(ctx, args[0]!, args[1]!);
    case 'list':
      need(0, '');
      return cmd.list(ctx);
    default:
      throw new UserError(
        `Unknown command "${command}". Run "pnpm choir help" to see the commands.`,
      );
  }
}

main().catch((e) => {
  if (e instanceof UserError) console.error(`\nError: ${e.message}`);
  else if (
    (e as { code?: string }).code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION' ||
    (e as { code?: string }).code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE'
  )
    console.error(`\nError: ${(e as Error).message}\nRun "pnpm choir help" to see the options.`);
  else console.error(e);
  process.exit(1);
});
