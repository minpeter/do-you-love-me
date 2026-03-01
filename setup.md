# Openclaw Setup Prompt

Set up Openclaw so it is immediately ready to use.

## Step 1 — Gather all required information upfront

Before doing anything else, use the `AskUserQuestion` tool to collect everything needed in one shot.
Ask all questions simultaneously in a single tool call:

- **Messenger**: Which messenger do you use?
  - Options: Telegram / Discord / WhatsApp / None
- **Bot token**: Do you already have a bot token for that messenger? (Paste it here, or say "none")
- **AI provider**: Which AI provider would you like to use?
  - Options: Anthropic (Claude) / OpenAI / Google Gemini / Free option (OpenRouter, Ollama, etc.)
- **API key**: Paste your API key, or type `env` if it is already set as an environment variable

Do not proceed until the user has answered all questions.

---

## Step 2 — Install Openclaw

`openclaw` is published to npm. Install it globally — no git clone or build required:

```bash
npm install -g openclaw
```

Verify:

```bash
openclaw --help
```

---

## Step 3 — Apply the apex preset

The built-in preset is `apex` (not `developer`). Use the `install` shortcut:

```bash
./dist/oh-my-openclaw install
```

Then fix any config migration warnings automatically:

```bash
openclaw doctor --fix
```

---

## Step 4 — Register the messenger channel

Use the info collected in Step 1.

### Telegram
```bash
openclaw plugins enable telegram
openclaw channels add --channel telegram --token "<token>"
```

### Discord
```bash
openclaw plugins enable discord
openclaw channels add --channel discord --token "<token>"
```

### WhatsApp
```bash
openclaw channels login --channel whatsapp
# Follow the QR code prompt
```

### No messenger
Skip this step. The user can add a channel later with `openclaw channels add`.

---

## Step 5 — Configure the AI provider

Use the info collected in Step 1.

| Provider | Config command |
|----------|---------------|
| Anthropic | `openclaw config set agents.defaults.model.primary anthropic/claude-sonnet-4-5` — reads `ANTHROPIC_API_KEY` from env automatically |
| OpenAI | `openclaw config set agents.defaults.model.primary openai/gpt-4o` — reads `OPENAI_API_KEY` from env |
| Gemini | `openclaw config set agents.defaults.model.primary google/gemini-2.0-flash` — reads `GEMINI_API_KEY` from env |

If the user said `env`, no further action is needed — openclaw reads the standard env vars automatically.
If the user provided an API key directly, set it with:

```bash
openclaw config set agents.list[0].auth.anthropic.apiKey "<key>"
```

(Replace `anthropic` and the path with the correct provider.)

---

## Step 6 — Set gateway mode and start

```bash
openclaw config set gateway.mode local
openclaw gateway run &
```

Wait for this log line before proceeding:

```
[telegram] [default] starting provider (@<botname>)
```

Then confirm the gateway is healthy:

```bash
openclaw health
```

---

## Step 7 — Handle the pairing code automatically

When the user sends a message to the bot for the first time they will receive a pairing code like:

```
Pairing code: K5MKBJLH
Ask the bot owner to approve with:
  openclaw pairing approve telegram K5MKBJLH
```

Watch for it and approve immediately without waiting for the user to ask:

```bash
openclaw pairing approve telegram <CODE>
```

---

## Step 8 — Error recovery

If any command fails:
1. Diagnose the cause (read the error, check `openclaw doctor`).
2. Apply the minimal fix.
3. Retry.
4. Report exactly what was changed.

Common issues:
- `Unknown channel: telegram` → run `openclaw plugins enable telegram` first
- `Preset not found` → use `./dist/oh-my-openclaw install` (not `apply developer`)
- `Invalid config` migration warnings → run `openclaw doctor --fix`
- `gateway.mode is unset` → run `openclaw config set gateway.mode local`
