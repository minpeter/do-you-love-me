#!/bin/bash
set -euo pipefail

STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
CONFIG_FILE="${OPENCLAW_CONFIG_PATH:-$STATE_DIR/openclaw.json}"
MARKER="$STATE_DIR/.docker-initialized"
APPLIED_PRESET_THIS_START="false"

log() { echo "==> $1"; }
info() { echo "    $1"; }

run_memory_index() {
  local index_log
  index_log="$(mktemp)"

  if ! openclaw memory index >"$index_log" 2>&1; then
    cat "$index_log"
    rm -f "$index_log"
    return 1
  fi

  rm -f "$index_log"
}

ensure_openclaw_plugin() {
  local plugin="$1"
  local install_log
  install_log="$(mktemp)"

  if openclaw plugins install "$plugin" >"$install_log" 2>&1; then
    info "plugin ensured: $plugin"
    rm -f "$install_log"
    return 0
  fi

  if grep -qi 'plugin already exists:' "$install_log"; then
    rm -f "$install_log"
    return 0
  fi

  cat "$install_log"
  rm -f "$install_log"
  return 1
}

resolve_workspace_dir() {
  local configured_workspace

  configured_workspace="$(jq -r '.agents.defaults.workspace // empty' "$CONFIG_FILE" 2>/dev/null || true)"
  if [ -n "$configured_workspace" ]; then
    printf '%s\n' "$configured_workspace"
    return
  fi

  printf '%s\n' "$STATE_DIR/workspace"
}

ensure_workspace_file() {
  local filename="$1"
  local source="/build/src/presets/apex/$filename"
  local workspace_dir
  local destination

  if [ ! -f "$source" ]; then
    return
  fi

  workspace_dir="$(resolve_workspace_dir)"
  destination="$workspace_dir/$filename"

  mkdir -p "$workspace_dir"
  if [ ! -f "$destination" ]; then
    cp "$source" "$destination"
    info "workspace file restored: $filename"
  fi
}

ensure_workspace_memory_dir() {
  local workspace_dir

  workspace_dir="$(resolve_workspace_dir)"
  mkdir -p "$workspace_dir/memory"
}

apply_apex_preset() {
  local line

  OH_MY_OPENCLAW_SKIP_MEMORY_BOOTSTRAP=true oh-my-openclaw apply apex --no-backup | while IFS= read -r line; do
    case "$line" in
      *"Run 'openclaw gateway restart' to activate changes."*)
        continue
        ;;
      *)
        printf '%s\n' "$line"
        ;;
    esac
  done
}

run_doctor_quietly() {
  local doctor_log
  doctor_log="$(mktemp)"

  if ! openclaw doctor --fix --yes >"$doctor_log" 2>&1; then
    cat "$doctor_log"
    rm -f "$doctor_log"
    return 1
  fi

  rm -f "$doctor_log"
}

normalize_installed_plugin_package_names() {
  local extensions_dir="$STATE_DIR/extensions"

  if [ ! -d "$extensions_dir" ]; then
    return
  fi

  shopt -s nullglob

  local manifest_path plugin_dir package_json plugin_id package_name tmp
  for manifest_path in "$extensions_dir"/*/openclaw.plugin.json; do
    plugin_dir="$(dirname "$manifest_path")"
    package_json="$plugin_dir/package.json"

    if [ ! -f "$package_json" ]; then
      continue
    fi

    plugin_id="$(jq -r '.id // empty' "$manifest_path")"
    package_name="$(jq -r '.name // empty' "$package_json")"

    if [ -z "$plugin_id" ] || [ "$package_name" = "$plugin_id" ]; then
      continue
    fi

    tmp="$(mktemp)"
    jq --arg normalized_name "$plugin_id" '.name = $normalized_name' "$package_json" > "$tmp"
    mv "$tmp" "$package_json"
    info "normalized plugin package name: $package_name -> $plugin_id"
  done

  shopt -u nullglob
}

# ────────────────────────────────────────────
# 1. Apply apex preset (first run or forced)
# ────────────────────────────────────────────
if [ ! -f "$MARKER" ] || [ "${FORCE_SETUP:-}" = "true" ]; then
  log "Applying apex preset..."
  apply_apex_preset
  APPLIED_PRESET_THIS_START="true"

  touch "$MARKER"
else
  log "Preset already applied (set FORCE_SETUP=true to re-apply)"
fi

log "Normalizing installed plugin metadata..."
normalize_installed_plugin_package_names

# Ensure config file exists
if [ ! -f "$CONFIG_FILE" ]; then
  mkdir -p "$(dirname "$CONFIG_FILE")"
  echo '{}' > "$CONFIG_FILE"
fi

log "Running doctor preflight..."
run_doctor_quietly || info "doctor preflight reported warnings; continuing bootstrap"

log "Ensuring memory auto-recall plugin..."
ensure_openclaw_plugin "openclaw-memory-auto-recall"
normalize_installed_plugin_package_names

BIND="${OPENCLAW_GATEWAY_BIND:-loopback}"
PORT="${OPENCLAW_GATEWAY_PORT:-18789}"
BASE_URL="${OPENAI_BASE_URL:-https://api.openai.com/v1}"
MODEL="${MODEL_NAME:-openai/gpt-5.4}"
MEMORY_PROVIDER_RAW="${MEMORY_SEARCH_PROVIDER:-}"
MEMORY_MODEL_RAW="${MEMORY_SEARCH_MODEL:-}"
MEMORY_BASE_URL_RAW="${MEMORY_SEARCH_API_BASE_URL:-}"
MEMORY_API_KEY_RAW="${MEMORY_SEARCH_API_KEY:-}"
MEMORY_PROVIDER="${MEMORY_PROVIDER_RAW:-openai}"
MEMORY_MODEL="${MEMORY_MODEL_RAW:-text-embedding-3-small}"
MEMORY_BASE_URL="$MEMORY_BASE_URL_RAW"
MEMORY_API_KEY="$MEMORY_API_KEY_RAW"
HEARTBEAT_EVERY="${OPENCLAW_HEARTBEAT_EVERY:-}"
HEARTBEAT_TARGET="${OPENCLAW_HEARTBEAT_TARGET:-}"
MEMORY_OVERRIDE_ACTIVE="false"

if [ -n "$MEMORY_PROVIDER_RAW$MEMORY_MODEL_RAW$MEMORY_BASE_URL_RAW$MEMORY_API_KEY_RAW" ]; then
  MEMORY_OVERRIDE_ACTIVE="true"
fi

# Generate gateway auth token if not provided
GW_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-$(openssl rand -hex 24)}"

log "Configuring OpenClaw..."

tmp=$(mktemp)
jq \
  --arg bind "$BIND" \
  --argjson port "$PORT" \
  --arg api_key "${OPENAI_API_KEY:-}" \
  --arg base_url "$BASE_URL" \
  --arg model "$MODEL" \
  --arg memory_provider "$MEMORY_PROVIDER" \
  --arg memory_model "$MEMORY_MODEL" \
  --arg memory_base_url "$MEMORY_BASE_URL" \
  --arg memory_api_key "$MEMORY_API_KEY" \
  --arg memory_override_active "$MEMORY_OVERRIDE_ACTIVE" \
  --arg heartbeat_every "$HEARTBEAT_EVERY" \
  --arg heartbeat_target "$HEARTBEAT_TARGET" \
  --arg tg_token "${TELEGRAM_BOT_TOKEN:-}" \
  --arg gw_token "$GW_TOKEN" \
  '
  # ── Gateway ──
  .gateway = (.gateway // {}) |
  .gateway.mode = "local" |
  .gateway.bind = $bind |
  .gateway.port = $port |
  .gateway.controlUi = (.gateway.controlUi // {}) |
  .gateway.controlUi.allowedOrigins = [
    "http://localhost:\($port)",
    "http://127.0.0.1:\($port)"
  ] |

  # ── Gateway auth (pre-set so doctor does not auto-generate) ──
  .gateway.auth = (.gateway.auth // {}) |
  .gateway.auth.mode = "token" |
  .gateway.auth.token = $gw_token |

  # ── Remove legacy keys (doctor would strip these) ──
  if .agents.defaults then .agents.defaults |= del(.tools) else . end |
  del(.routing) |

  # ── AI provider (if key given) ──
  if $api_key != "" then
    .models = (.models // {}) |
    .models.providers = (.models.providers // {}) |
    .models.providers.openai = (.models.providers.openai // {}) |
    .models.providers.openai.apiKey = $api_key |
    .models.providers.openai.baseUrl = $base_url |
    .models.providers.openai.models = [{ id: ($model | split("/") | last), name: ($model | split("/") | last), api: "openai-completions" }] |
    .agents = (.agents // {}) |
    .agents.defaults = (.agents.defaults // {}) |
    .agents.defaults.model = (.agents.defaults.model // {}) |
    .agents.defaults.model.primary = $model
  else . end |

  # ── Memory search embeddings override (optional) ──
  if $memory_override_active == "true" then
    .agents = (.agents // {}) |
    .agents.defaults = (.agents.defaults // {}) |
    .agents.defaults.memorySearch = (.agents.defaults.memorySearch // {}) |
    .agents.defaults.memorySearch.provider = $memory_provider |
    .agents.defaults.memorySearch.model = $memory_model |
    if $memory_api_key != "" or $memory_base_url != "" then
      .agents.defaults.memorySearch.remote = (.agents.defaults.memorySearch.remote // {}) |
      .agents.defaults.memorySearch.remote.apiKey = $memory_api_key |
      .agents.defaults.memorySearch.remote.baseUrl = $memory_base_url
    else . end
  else . end |

  # ── Memory auto-recall plugin defaults ──
  .plugins = (.plugins // {}) |
  .plugins.allow = (((.plugins.allow // []) + ["memory-core", "memory-auto-recall"]) | unique) |
  .plugins.entries = (.plugins.entries // {}) |
  .plugins.entries["memory-auto-recall"] = (.plugins.entries["memory-auto-recall"] // {}) |
  .plugins.entries["memory-auto-recall"].enabled = true |
  .plugins.entries["memory-auto-recall"].config = (.plugins.entries["memory-auto-recall"].config // {}) |
  if (.plugins.entries["memory-auto-recall"].config.maxResults // null) == null then
    .plugins.entries["memory-auto-recall"].config.maxResults = 3
  else . end |
  if (.plugins.entries["memory-auto-recall"].config.minScore // null) == null then
    .plugins.entries["memory-auto-recall"].config.minScore = 0.3
  else . end |
  if (.plugins.entries["memory-auto-recall"].config.minPromptLength // null) == null then
    .plugins.entries["memory-auto-recall"].config.minPromptLength = 10
  else . end |

  # ── Preserve existing tool policy while ensuring memory tools remain available ──
  if (.tools.allow? | type) == "array" then
    .tools.allow = (.tools.allow + ["memory_search", "memory_get"] | unique)
  else . end |

  # ── Dedicated memory transport (optional) ──
  if $memory_api_key != "" or $memory_base_url != "" then
    .agents.defaults.memorySearch.remote = (.agents.defaults.memorySearch.remote // {}) |
    .agents.defaults.memorySearch.remote.apiKey = $memory_api_key |
    .agents.defaults.memorySearch.remote.baseUrl = $memory_base_url
  else . end |

  # ── Heartbeat defaults / overrides ──
  .agents = (.agents // {}) |
  .agents.defaults = (.agents.defaults // {}) |
  .agents.defaults.heartbeat = (.agents.defaults.heartbeat // {}) |
  if $heartbeat_every != "" then
    .agents.defaults.heartbeat.every = $heartbeat_every
  elif ((.agents.defaults.heartbeat.every // "") | tostring) == "" then
    .agents.defaults.heartbeat.every = "5m"
  else . end |
  if $heartbeat_target != "" then
    .agents.defaults.heartbeat.target = $heartbeat_target
  elif ((.agents.defaults.heartbeat.target // "") | tostring) == "" then
    .agents.defaults.heartbeat.target = "last"
  else . end |

  # ── Telegram (if token given) ──
  if $tg_token != "" then
    .plugins = (.plugins // {}) |
    .plugins.entries = (.plugins.entries // {}) |
    .plugins.entries.telegram = { enabled: true } |
    .channels = (.channels // {}) |
    .channels.telegram = (.channels.telegram // {}) |
    .channels.telegram.botToken = $tg_token |
    .channels.telegram.groupPolicy = "open" |
    .channels.telegram.enabled = true |
    .channels.telegram.streaming = "partial"
  else . end |

  # ── Disable Discord (prevent doctor auto-enable) ──
  .channels = (.channels // {}) |
  if .channels.discord then
    .channels.discord.enabled = false
  else . end
  ' "$CONFIG_FILE" > "$tmp" && mv "$tmp" "$CONFIG_FILE"

ensure_workspace_file "HEARTBEAT.md"
ensure_workspace_file "MEMORY.md"
ensure_workspace_memory_dir

if [ "$MEMORY_OVERRIDE_ACTIVE" = "true" ]; then
  log "Refreshing memory index for memory search override..."
  run_memory_index
elif [ "$APPLIED_PRESET_THIS_START" = "false" ]; then
  log "Refreshing memory index for existing workspace..."
  run_memory_index
fi

info "gateway: bind=$BIND port=$PORT"
[ -n "${OPENAI_API_KEY:-}" ] && info "provider: openai base=$BASE_URL model=$MODEL"
[ "$MEMORY_OVERRIDE_ACTIVE" = "true" ] && info "memory embeddings: provider=$MEMORY_PROVIDER base=${MEMORY_BASE_URL:-<provider-default>} model=$MEMORY_MODEL"
[ -n "$HEARTBEAT_EVERY" ] && info "heartbeat override: every=$HEARTBEAT_EVERY target=${HEARTBEAT_TARGET:-<existing-or-default>}"
[ -n "${TELEGRAM_BOT_TOKEN:-}" ] && info "telegram: enabled"

log "Setting up state directories..."
mkdir -p "$STATE_DIR/agents/main/sessions"
mkdir -p "$STATE_DIR/credentials"
mkdir -p "$STATE_DIR/canvas"
chmod 700 "$STATE_DIR"
chmod 600 "$CONFIG_FILE"

log "Running doctor check..."
run_doctor_quietly || info "doctor reported warnings; continuing startup"

log "Starting OpenClaw gateway..."
exec openclaw gateway run --force
