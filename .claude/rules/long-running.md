<!-- Shared rule (stacks: base). Maintained outside this repository; local edits are overwritten. -->

# Long-running processes must show visible progress

Never start a long-running process (anything that may take more than ~1 minute: installs, builds, test suites, batch loops over many repos, migrations) without a progress indicator the user can see.

- Prefer a percentage: for batches print `[k/N, xx%] <item>` before each step.
- Run it where the user can watch it: a Terminal panel tab (`run_in_terminal`) rather than a hidden background shell; if it must run in the background, tell the user how to watch it and report progress in percent.
- If no real percentage is possible, show some live indicator (step counter, elapsed time, streaming output) so it never looks hung.

## Hard rules (no exceptions, checked before every such command)

A visible window is not visible progress. These are violations, every time:

1. **Log to a file, show an indicator.** Do not flood the console with long output. Split the stream with `tee`: the full output goes to a log file, and the console shows only a short live indicator of progress: `cmd 2>&1 | tee <log> | grep --line-buffered -E '<progress lines>'` (test counts, `[k/N]` steps, compiled / analyzed lines), or a line counter / elapsed-time heartbeat. The indicator must update while the command runs. Forbidden: `> file`, `>> file`, `&> file`, `2>&1 > file` without `tee` (nothing visible), and filters that hold the output until the end (`| tail`, `| head`, `| wc`, `| sort`, `| uniq`, `grep` without `--line-buffered`). Read the log file afterwards for details; never paste it whole into the chat.
2. **The progress is for the user's tab, not for the agent or the chat.** The heartbeat in the tab shows the user that the run is alive; that is enough (user 2026-11-21). Do not poll the tab (`read_terminal` in a loop) and do not repeat progress in the chat (user 2026-11-19); write in the chat only when the run starts, fails, hangs or finishes. Both are useless to everyone (user 2026-11-22). The terminal tab itself does **not** tell the agent that a command ended: the agent learns it only from the waiter of rule 7, so it arms one every time.
3. **Announce before starting.** Before the command: one line in the chat with what runs, in which tab (linked), and the expected duration.
4. **Self-check.** Before sending the command, read it once more: is there a `tee` to a log, and a live indicator after it? Does the line write the exit code to `<log>.exit` (rule 7)? Is any rule-1 forbidden form on the long-running part? If not right, rewrite the command; do not send it.
5. **A tool without its own progress** (a compiler, an analyzer, a test runner that prints only at the end) still gets an indicator: its verbose/streaming flag filtered to progress lines, or a heartbeat (elapsed seconds, every ≤ 10 s) printed next to it while it runs.
6. **Long means the Terminal panel, not Bash.** Every command that may run longer than ~60 seconds goes to a Terminal panel tab (`run_in_terminal`) with `tee` and a live indicator. The Bash tool is forbidden for it, in every form: no foreground call with a raised `timeout`, no `run_in_background` (its output is hidden from the user), no `&` subshells, no polling loops (`for … sleep`, `until … sleep`, `wait`) inside a Bash call. The only exception is the waiter of rule 7: it does no work and only waits for the exit-code file. Always long, no estimate needed: `npm i` / `npm install` / `npm uninstall`, any build (`build`, `build:full`, `nest build`, `tsc` over a whole project, webpack), any test run (jest, playwright, hardhat, `npm t`, `test:e2e`), lint or prettier over more than a handful of files, migrations, starting an app to see whether it starts, anything over many repositories.
7. **One wake-up per run: an exit-code file and a waiter.** It works for any command:
   - The line typed into the tab ends by writing the exit code next to the log, whatever happens inside: `rm -f <log>.exit; bash <script>; echo $? > <log>.exit`. `<log>` is the log the script tees to, and the script exits with the real code of the work (Variants below); a pipeline typed straight into the tab would give the indicator's code instead, so even a single long command goes into a script.
   - Right after `run_in_terminal`, start one waiter with the Bash tool and `run_in_background: true`. It wakes the agent exactly once, when the command ends or when none of its logs (`<log>` and every `<log>.*` the script writes) has changed for 10 minutes (hung; set the minutes above the longest quiet stretch of the run):
     `L=<log>; touch "$L"; until [ -f "$L.exit" ]; do sleep 5; [ -z "$(find "$L"* -mmin -10)" ] && { echo "HUNG: $L* unchanged for 10 min"; exit 1; }; done; echo "EXIT $(cat "$L.exit")"`
   - Then do other work or end the turn. On the wake-up, read the result once (`grep` the log, or the tab's last lines) and act: report it, fix the failure, or say it hung and stop it. Never wait for a notice without a waiter, and never use a watch that sends a message per log line (`Monitor` is for many events, not one end).
8. **Stop on a slip.** If a long command was already sent the wrong way (Bash, hidden background, no indicator), say so in the next message before anything else, stop it, and restart it the right way. Do not let it finish quietly and report the result as if nothing happened.

Breaking any of these is a mistake to admit in the reply right away, not to explain away.

## How to build the indicator (works for any project and tool)

The indicator lives in the terminal tab only. Do not copy it into the chat: no "500 of 8000 lines", "step 3/6" or percent lines. In the chat, say only that the run started (which tab, how long), and then that it finished, failed or hung, with the result.

Below are two worked variants: one for test runs and checks, one for a release (build → publish). **Neither is mandatory.** They are examples of what has worked; if you see a better way for the task at hand (a tool's own progress bar, a `[k/N]` loop over items, a percentage from known totals, something else), do it the better way: what matters is the hard rules above, not these recipes.

### Variant 1: test runs and multi-stage checks

Put the long run into a small script file (scratchpad), not a one-liner: the terminal rejects multi-line commands and some characters, and a script is reused for every re-run. Run it with `bash <script>` (an edit with `sed -i` can drop the executable bit).

```bash
#!/usr/bin/env bash
# What it checks, in one line.
LOG=<scratchpad>/run.log
cd <project> || exit 1

CHANGED=$(git diff --name-only origin/main...HEAD; git diff --name-only; git ls-files -o --exclude-standard)

echo "[1/4] quick: lint + format of the changed files"            # fail fast: seconds, before anything slow
<lint/prettier on $CHANGED> > "$LOG.lint" 2>&1 || { echo "  lint FAILED"; grep -m20 -E "error|warning" "$LOG.lint"; exit 1; }

echo "[2/4] quick: typecheck of the changed package"
<tsc --noEmit -p <changed package>> > "$LOG.tsc" 2>&1 || { echo "  typecheck FAILED: $(grep -c error "$LOG.tsc") errors"; exit 1; }

echo "[3/4] build"
<build command> 2>&1 | tee "$LOG.build" | grep --line-buffered -E "<lines that mark progress or errors>"
[ ${PIPESTATUS[0]} -eq 0 ] || { echo "  build FAILED"; exit 1; }

echo "[4/4] tests"
<test command> 2>&1 | tee "$LOG.test" | awk '
  {n++} n % 500 == 0 {print "  ... " n " lines"; fflush()}     # heartbeat: the output keeps growing
  /<summary pattern: passing|failing|pending|Tests:|PASS|FAIL>/ {print; fflush()}'
exit ${PIPESTATUS[0]}                                            # the tests' code, not the filter's: the waiter reports it
```

Started from the tab as `rm -f <scratchpad>/run.log.exit; bash <script>; echo $? > <scratchpad>/run.log.exit`, with the waiter of rule 7 on `<scratchpad>/run.log`.

- **Steps `[k/N]`** for a multi-stage check (quick lint/typecheck of the changed files → compile → generate → build → tests, stopping at the first failure): the user sees which stage runs.
- **Line-count heartbeat** (`awk` with `n % K == 0` and `fflush()`) for a runner that prints a line per test or file: it shows that the run is moving, and after the first full run you know the total, so the count reads as a percentage ("4500 of about 8000 lines"). Pick `K` so a mark appears every 10–30 s.
- **Pattern lines** next to the heartbeat: the summary (`passing` / `failing`, `Tests:`), and the names of the tests the task is about, so their result is visible without opening the log.
- **Short quiet steps** (seconds): redirect to their own log and print only the exit code and an error count.
- **A tool that prints nothing until the end:** a background timer next to it, `( while sleep 10; do echo "  ... $((SECONDS))s"; done ) & T=$!; <tool> ...; kill $T`.
- **The exit code is the end marker:** the script exits with the code of the step that decides the result, and the tab line writes it to `<log>.exit`, which the waiter waits for. The waiter's hang check looks at `$LOG` and every `$LOG.*`, so per-step logs (`$LOG.build`, `$LOG.test`) count.
- Afterwards read the logs with `grep` for the failure details (`grep -nA6 "^  [0-9]+) " "$LOG.test"`); never paste a log whole into the chat.
- A narrow run first (only the changed specs), the full run once that is green. The script's file lists are edited per task, the structure stays.

### Variant 2: a release (install → build → version → publish), possibly over several repositories

One script runs every step of every repository in order, prints `[k/N, xx%] <repo>: <step>` before each, stops at the first failing step (so a failed build never reaches publish), and keeps a heartbeat for the quiet steps. The steps are plain command strings, so the same loop serves any release flow.

```bash
#!/bin/bash
set -o pipefail
# Release <repos> from clean checkouts on origin/main.
C=<folder with the checkouts>; LOG=$C/release.log; : > "$LOG"
( s=0; while :; do sleep 10; s=$((s+10)); echo "[heartbeat ${s}s]"; done ) & HB=$!
F='added|lerna (success|ERR|WARN)|Changes:|=>|published|Successfully|ERR!|error'   # progress and error lines
REPOS="repo-a repo-b"
STEPS=("git fetch -q origin" "git checkout -q -B main origin/main" "git status --short" "npm ci" "npm run build" "npm run obfuscate" "npm run lerna:version -- --yes" "npm run lerna:publish")
N=$(( $(echo $REPOS | wc -w) * ${#STEPS[@]} )); k=0
for r in $REPOS; do
  cd "$C/$r" || exit 1
  for s in "${STEPS[@]}"; do
    k=$((k+1)); echo "== [$k/$N, $((k*100/N))%] $r: $s"
    sh -c "$s" 2>&1 | tee -a "$LOG" | { grep --line-buffered -E "$F"; true; }
    if [ $? -ne 0 ]; then echo "== FAILED: $r: $s"; kill $HB; exit 1; fi
  done
done
kill $HB; echo "== done, log: $LOG"
```

- **Order matters:** list the repositories in release order (a lower level first), so a dependent is built against what was just published.
- **The percentage** comes from the known number of steps; the visible lines (`Changes: a 1.0.0 => 1.1.0`, `published …`) show the versions without opening the log.
- **`git status --short`** before versioning shows any leftover change that would block `lerna version`.
- Each release still needs the user's explicit yes; the script only makes it visible and safe to stop.
