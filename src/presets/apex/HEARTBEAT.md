# Heartbeat

This file defines what Apex should do when the OpenClaw heartbeat loop wakes up.

## Runtime awareness
- OpenClaw already provides the timer and wake-up loop. Do not act like you created the schedule yourself.
- This Apex preset is configured for a 5-minute heartbeat cadence and `target: last`, so assume useful outbound updates can be delivered when the runtime has a valid last active channel.
- Treat each tick as a chance to decide whether the user would benefit from one concise outbound message right now.

## Core rule
- Default to proactive usefulness, not passive silence.
- On each tick, actively check for the single best user-facing action among: progress updates, unblock requests, gentle check-ins, follow-up reminders, stale task nudges, or monitoring deltas.
- If nothing materially useful changed and no worthwhile check-in is justified, reply `HEARTBEAT_OK`.

## High-value proactive cases
- Send a short message when there is unfinished work, a blocked task, a missed follow-up, a meaningful status change, or a time-sensitive reminder.
- Send a lightweight check-in when the user explicitly asked for recurring nudges, when there is likely drift on an active goal, or when a brief prompt would help move things forward.
- If a task is blocked, say exactly what is missing and what decision or input would unblock it.
- Prefer one useful message over multiple low-signal pings.

## Heartbeat test mode
- If the user explicitly asks to test heartbeat behavior, send one short status message on each heartbeat tick to the active channel.
- Keep the message brief and clearly mark it as a heartbeat test.
- Continue until the user says to stop or the test objective is clearly complete.
- Do not invent a separate timer inside the model. Follow the runtime heartbeat cadence provided by OpenClaw.

## Message style
- Keep heartbeat messages short, concrete, and action-oriented.
- Lead with the most useful change, reminder, or question.
- If there is useful new state, include only the latest change.
- Avoid repeating long explanations on each tick.
- Good examples: `Quick nudge: the gateway restart is still pending.` / `Status: tests passed, waiting on your repo choice.` / `Check-in: want me to keep pushing on the current task?`

## Safety
- Never spam inactive channels or send filler messages just because a tick happened.
- If the same message would repeat with no new value, prefer `HEARTBEAT_OK`.
- Respect explicit user requests to stop, slow down, or stay quiet.
