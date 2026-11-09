# Adding songs and links

Everything is done with one command, `pnpm choir`, from the repo folder. Nothing here needs a deploy:
songs and choirs are just data in the R2 bucket.

`--env dev` (default) is the test site, `--env prod` is the real one, `--env local` is the data
`pnpm dev` shows on your computer. Real uploads to `prod` ask "Upload to PRODUCTION? (y/N)" first.

## 1. One-time setup

```sh
brew install ffmpeg          # audio converter
pnpm install
pnpm exec wrangler login     # opens your browser; sign in to Cloudflare once
```

## 2. Export the parts from GarageBand

One audio file per part (Organ, Soprano, Alto, ...). For each part:

1. Solo that part. If it is made of several tracks (e.g. the organ), solo **all** of its tracks.
2. Turn the **cycle region** on and cover the whole song. Use the **same** cycle region for every part,
   so all the files are exactly the same length.
3. **Share → Export Song to Disk**, format **AIFF**, 16-bit. Name the file after the part (`organ.aif`,
   `soprano.aif`).
4. Put all the files for one song in one folder, named after the song (`candlelight-carol`).

Do not use MP3 or AAC exports: the parts can drift out of sync.

## 3. Upload a song

```sh
pnpm choir init-song  path/to/candlelight-carol     # writes song.yaml for you to check
# open song.yaml, fix title/credits/labels, save
pnpm choir add-song   path/to/candlelight-carol --dry-run     # try it: converts, uploads nothing
pnpm choir add-song   path/to/candlelight-carol --env dev     # upload to the test site
pnpm choir add-song   path/to/candlelight-carol --env prod    # upload to the real site
```

`song.yaml` looks like this. The order of `parts` is the order in the player.

```yaml
id: candlelight-carol        # lowercase letters, numbers, dashes. Part of URLs: don't change it later
title: Candlelight Carol
credits: John Rutter         # optional
parts:
  - { id: organ,   label: Organ,   file: organ.aif,   kind: accompaniment }
  - { id: soprano, label: Soprano, file: soprano.aif }
  - { id: alto,    label: Alto,    file: alto.aif }
```

Per part you can also set `channels: 2` (keep stereo; default is mono, which is smaller and plenty for
practice) and `defaultGain: 0.8` (quieter by default). `kind` is `voice` (default) or `accompaniment`.
`label` is what singers see, so write it for them ("Part 1", "Piano").

`add-song` checks the files, converts them, and uploads only what is new. Running it again with nothing
changed uploads nothing, so it is always safe to re-run. To fix a part, re-export it, run `add-song` again: re-uploading a changed part removes the old file.

### Two examples

**Organ + SATBB**: folder with `organ.aif soprano.aif alto.aif tenor.aif baritone.aif bass.aif`.
`init-song` produces exactly the list above (organ first, then voices high to low). Done.

**Piano + Part 1 / Part 2** (folder `joyful-song` with `piano.aif part-1.aif part-2.aif`):

```yaml
id: joyful-song
title: Joyful Song
parts:
  - { id: piano,  label: Piano,  file: piano.aif,  kind: accompaniment }
  - { id: part-1, label: Part 1, file: part-1.aif }
  - { id: part-2, label: Part 2, file: part-2.aif }
```

Any names and any number of parts work. Nothing assumes SATB.

## 4. Make a choir, add songs, share a link

```sh
pnpm choir add-choir oak-hills-3rd --name "Oak Hills 3rd Ward Choir" --env prod
pnpm choir add-song-to-choir oak-hills-3rd candlelight-carol --env prod
pnpm choir new-link oak-hills-3rd --label "Fall 2026" --env prod
```

`new-link` prints a URL like `https://practice.jpatrickbeal.com/c/oak-hills-3rd/AbC...`.
**It is shown only once** (only a fingerprint is stored). Copy it and send it to the choir; people open it
once on their phone and are in. Anyone with the link can listen, so share it only with the choir.
If you lose it, make another. Changes show up for singers within about a minute.

`pnpm choir remove-song-from-choir <choir> <song>` takes a song off a choir (the song stays uploaded).
`pnpm choir list --env prod` shows choirs, songs and link labels with dates (never the links).

## 5. Revoke or rotate a link

- A link got shared too widely, or someone left: revoke it. It stops working within about a minute.

  ```sh
  pnpm choir revoke-link oak-hills-3rd "Fall 2026" --env prod
  ```

- Rotating without a gap: `new-link` with a new label, send that to the choir, then `revoke-link` the old
  one. (A choir can have several active links at once.)

## 6. Remove a song after the performance

Two different things:

- **Hide it** from a choir (the audio stays uploaded, so you can add it back later):

  ```sh
  pnpm choir remove-song-from-choir oak-hills-3rd candlelight-carol --env prod
  ```

- **Delete it permanently** (the audio is erased from storage):

  ```sh
  pnpm choir delete-song candlelight-carol --env prod --dry-run   # shows what would go
  pnpm choir delete-song candlelight-carol --env prod             # asks you to type the song id
  ```

  It refuses while any choir still lists the song and tells you which. Add `--from-all-choirs` to remove it
  from every choir and delete it in one go. It cannot be undone: to bring the song back, upload it again
  with `add-song`. If it is interrupted (e.g. the network drops), just run the same command again.

## 7. Options at a glance

| Option | Applies to | Meaning |
|---|---|---|
| `--env local\|dev\|prod` | all | Where to work (default `dev`) |
| `--yes` | all | Skip the "Upload to PRODUCTION?" question (e.g. scripted prod runs). For `delete-song` on prod it also skips typing the song id: use with care |
| `--dry-run` | `add-song`, `delete-song` | Do everything except upload / delete |
| `--allow-lossy` | `add-song` | Accept MP3/AAC sources (not recommended) |
| `--name "..."` | `add-choir` | The choir's display name (required) |
| `--label "..."` | `new-link` | A name for the link, used later by `revoke-link` (default: `link <date>`) |
| `--from-all-choirs` | `delete-song` | Remove the song from every choir, then delete it |
| `--force` | `init-song` | Overwrite an existing `song.yaml` |

`pnpm choir help` prints the same list.

## 8. Troubleshooting

| You see | What to do |
|---|---|
| `ffmpeg is not installed` | `brew install ffmpeg` |
| `Not logged in to Cloudflare` | `pnpm exec wrangler login`, then run the command again |
| `more than one account` | Run again as `CLOUDFLARE_ACCOUNT_ID=<id> pnpm choir ...` |
| `The parts are not the same length` | In GarageBand use the same cycle region for every part and re-export them all |
| `different sample rates` | Re-export all the parts from the same GarageBand project |
| `These files are lossy` | Export AIFF/WAV instead (step 2) |
| `song.yaml has problems` | The message names the line; ids need lowercase letters, numbers, dashes |
| `There is no choir ...` / `There is no song ...` | Create it first (`add-choir` / `add-song`); check the `--env` |
| A song doesn't show up for singers | Wait a minute; check `pnpm choir list --env ...` for the choir's songs |
| `Choirs still list ...` when deleting | Run the `remove-song-from-choir` lines it prints, or add `--from-all-choirs` |
| Want to try without risk | Add `--dry-run` to `add-song`, or use `--env dev` / `--env local` (`delete-song` also has `--dry-run`) |
