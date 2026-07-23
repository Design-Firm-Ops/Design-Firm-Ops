FROM node:24-bookworm

ARG TZ
ENV TZ="$TZ"
ENV DEVCONTAINER=true

# Base tooling: git, gh, jq, and the Postgres client for `psql`/migrations.
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
  && apt-get install -y --no-install-recommends \
    less \
    git \
    procps \
    sudo \
    jq \
    ca-certificates \
    curl \
    wget \
    gnupg \
    postgresql-client \
  && rm -rf /var/lib/apt/lists/*

# GitHub CLI from the official apt repo.
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends gh \
  && rm -rf /var/lib/apt/lists/*

# Persist bash history across rebuilds (mounted volume, see devcontainer.json).
RUN mkdir -p /commandhistory \
  && echo "export PROMPT_COMMAND='history -a' && export HISTFILE=/commandhistory/.bash_history" \
    >> /home/node/.bashrc \
  && chown -R node:node /commandhistory

# npm global dir owned by node so `npm i -g` needs no sudo.
ENV NPM_CONFIG_PREFIX=/usr/local/share/npm-global
ENV PATH=$PATH:/usr/local/share/npm-global/bin
RUN mkdir -p /usr/local/share/npm-global && chown -R node:node /usr/local/share/npm-global

# Claude Code's config/credentials/history live in ~/.claude, which is a named
# volume (see docker-compose.yml). Create it owned by node so a FRESH volume
# inherits node ownership. Docker only copies image ownership into an *empty*
# volume, so we also ship a self-heal script that fixes an already-root-owned
# volume on every start (postStartCommand in devcontainer.json).
RUN mkdir -p /home/node/.claude && chown -R node:node /home/node/.claude
RUN printf '#!/bin/sh\nchown -R node:node /home/node/.claude\n' \
    > /usr/local/bin/fix-claude-perms.sh \
  && chmod +x /usr/local/bin/fix-claude-perms.sh \
  && echo "node ALL=(root) NOPASSWD: /usr/local/bin/fix-claude-perms.sh" \
    > /etc/sudoers.d/node-claude-perms \
  && chmod 0440 /etc/sudoers.d/node-claude-perms

USER node

# Claude Code CLI. Convenience alias for the skip-permissions run.
RUN npm install -g @anthropic-ai/claude-code \
  && echo "alias yolo='claude --dangerously-skip-permissions'" >> /home/node/.bashrc

WORKDIR /workspace
