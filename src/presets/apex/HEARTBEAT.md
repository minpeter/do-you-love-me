# Heartbeat

This file defines what Apex should do when the OpenClaw heartbeat loop wakes up.

## Core rule
- Do nothing unless there is unfinished work or an explicit ongoing monitoring/test request from the user.

## Heartbeat test mode
- If the user explicitly asks to test heartbeat behavior, send one short status message on each heartbeat tick to the active channel.
- Keep the message brief and clearly mark it as a heartbeat test.
- Continue until the user says to stop or the test objective is clearly complete.
- Do not invent a separate timer inside the model. Follow the runtime heartbeat cadence provided by OpenClaw.

## Message style
- Prefer a compact confirmation such as: `heartbeat test: still running`.
- If there is useful new state, include only the latest change.
- Avoid repeating long explanations on each tick.

## Safety
- Never use heartbeat ticks to spam inactive channels.
- Never send proactive heartbeat messages unless the user explicitly requested a heartbeat-based test or there is pending work that must resume.
