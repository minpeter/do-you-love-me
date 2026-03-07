---
name: tmux-opencode
description: "Control OpenCode sessions via tmux for background and parallel coding tasks."
metadata:
  openclaw:
    emoji: "🖥️"
---

# tmux-opencode

tmux로 OpenCode 세션을 제어해서 코드 작업을 시킨다.

## 언제 쓰나

- 코드 작업 (구현, 리팩토링, 버그 픽스)
- 멀티스텝 태스크
- 병렬 작업 (여러 세션 동시 실행)
- 백그라운드 작업 (채팅 블록 안 함)

## Quick Start

```bash
# 소켓 경로
SOCKET="${TMPDIR:-/tmp}/openclaw-tmux-sockets/openclaw.sock"

# 세션 생성 + OpenCode 실행
tmux -S "$SOCKET" new -d -s "opencode-myproject" -c ~/myproject
tmux -S "$SOCKET" resize-window -t "opencode-myproject" -x 300 -y 80
tmux -S "$SOCKET" send-keys -t "opencode-myproject" 'opencode' Enter

# 3초 대기 후 프롬프트 전송
sleep 3
tmux -S "$SOCKET" send-keys -t "opencode-myproject" -l 'ulw Fix bug in auth module. Commit and push when done.'
tmux -S "$SOCKET" send-keys -t "opencode-myproject" Enter
```

## 프롬프트 규칙

- **영어로 작성** (OpenCode 최적화)
- **`-l` 플래그 필수** (특수문자 처리)
- **`ulw` 로 시작** (복잡한 작업)
- **끝에 "Commit and push when done"**

## 워크플로우

### 1. 세션 생성

```bash
tmux -S "$SOCKET" new -d -s "$SESSION" -c "$PROJECT_DIR"
tmux -S "$SOCKET" resize-window -t "$SESSION" -x 300 -y 80
tmux -S "$SOCKET" send-keys -t "$SESSION" 'opencode' Enter
```

### 2. 프롬프트 전송

```bash
tmux -S "$SOCKET" send-keys -t "$SESSION" -l 'ulw Your task here. Commit and push when done.'
tmux -S "$SOCKET" send-keys -t "$SESSION" Enter
```

### 3. 상태 확인

```bash
tmux -S "$SOCKET" capture-pane -p -J -t "$SESSION":0.0 -S -100
```

**상태 판단:**

| 상태 | 신호 |
|------|------|
| thinking | 프로그레스바 움직임, tool 실행 중 |
| ready | 셸 프롬프트 (`❯`), 체크리스트 완료 |
| error | 에러 메시지, rate limit |
| stuck | 15분 이상 변화 없음 |

### 4. 완료 확인

- 셸 프롬프트 복귀 (`❯` 또는 `➜`)
- "Committed and pushed" 메시지
- 체크리스트 전부 `[✓]`

## 모델 변경

```bash
# Ctrl+X M으로 모델 피커 열기
tmux -S "$SOCKET" send-keys -t "$SESSION" C-x m
sleep 0.5
tmux -S "$SOCKET" send-keys -t "$SESSION" -l 'opus'
tmux -S "$SOCKET" send-keys -t "$SESSION" Enter
```

## 에이전트 선택

**Tab 키로 순환** (@ 멘션 안 됨):

- Sisyphus → Hephaestus → Prometheus → Atlas → ...

| 에이전트 | 용도 |
|----------|------|
| Sisyphus | 탐색적 작업 |
| Hephaestus | 명확한 구현 작업 |
| Oracle | 아키텍처, 디버깅, 리뷰 |
| Librarian | 문서 검색 |

## Rate Limit 복구

```bash
# ESC로 재시도 취소
tmux -S "$SOCKET" send-keys -t "$SESSION" Escape
tmux -S "$SOCKET" send-keys -t "$SESSION" Escape
sleep 1

# 계속 진행
tmux -S "$SOCKET" send-keys -t "$SESSION" -l 'continue'
tmux -S "$SOCKET" send-keys -t "$SESSION" Enter
```

## Idle 세션 채찍질

```bash
# ESC + continue
tmux -S "$SOCKET" send-keys -t "$SESSION" Escape
tmux -S "$SOCKET" send-keys -t "$SESSION" -l 'continue'
tmux -S "$SOCKET" send-keys -t "$SESSION" Enter
```

## 병렬 이슈 작업

```bash
# 이슈별 worktree
git worktree add ../project-issue-1 -b feature/issue-1
git worktree add ../project-issue-2 -b feature/issue-2

# 세션별 작업
tmux -S "$SOCKET" new -d -s "issue-1" -c ~/project-issue-1
tmux -S "$SOCKET" new -d -s "issue-2" -c ~/project-issue-2
```

## 세션 추적

`memory/tmux-sessions.json`:

```json
{
  "sessions": {
    "opencode-myproject": {
      "project": "~/myproject",
      "task": "Fix auth bug",
      "status": "running"
    }
  }
}
```

**status:** `running` | `completed` | `failed` | `stuck`

## 자동 완료 알림

`watch-session.sh` 로 세션 완료 시 Discord 알림:

```bash
# 백그라운드 감시
~/clawd/scripts/watch-session.sh "opencode-myproject" > /tmp/watch.log 2>&1 &

# 30초마다 체크, 완료되면 #internal에 알림
# 완료 신호: ❯, ➜, "Committed and pushed"
```

## 세션 종료

```bash
tmux -S "$SOCKET" kill-session -t "$SESSION"
```
