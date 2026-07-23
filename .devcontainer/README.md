# Dev container

An isolated container for running Claude Code with `--dangerously-skip-permissions`
("YOLO mode"). Two services:

- **app** — Node 24 + Claude Code CLI + git/gh. Your shell lives here.
- **db** — Postgres 16, reachable inside the network as host `db`. Data persists
  in a named volume.

Isolation comes from the container itself: the agent operates on the mounted repo
and the throwaway Postgres, not your host. There is **no egress firewall** — the
container has full network access, so treat skip-permissions accordingly.

## Open it

- **VS Code:** install the Dev Containers extension → "Reopen in Container".
- **CLI:** `npm i -g @devcontainers/cli` then
  `devcontainer up --workspace-folder .` and
  `devcontainer exec --workspace-folder . bash`.

First start builds the image, brings up Postgres, and runs `npm install`.

## Run Claude without permission prompts

Inside the container:

```bash
claude --dangerously-skip-permissions
# or the alias baked into the image:
yolo
```

## Database

The app container sets `DATABASE_URL` to point at the `db` service
(`postgresql://postgres:postgres@db:5432/design_firm_ops`), overriding the
`localhost` value in `.env`. Initialize it once:

```bash
npm run prisma:migrate
npm run prisma:seed
```

## Notes

- Copy `.env.example` to `.env` and fill in secrets (Supabase, Resend, Anthropic,
  NextAuth) as usual — the repo is mounted, so `.env` is visible in the container.
- `ANTHROPIC_API_KEY` in `.env` is only used by the app's document-extraction
  feature; Claude Code itself authenticates separately (run `claude` and log in).
- Claude Code's login and conversation history persist in the `claude-code-config`
  named volume mounted at `~/.claude`. The image creates that dir owned by `node`,
  and `postStartCommand` runs `fix-claude-perms.sh` on every start to keep it
  `node`-owned — this is what prevents the EACCES "conversations won't be saved"
  error and login not sticking. If you hit it after an upgrade, **Rebuild
  Container** so the fix re-runs.
