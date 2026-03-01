# agent-browser

Browser automation CLI for AI agents by Vercel Labs. Rust-based headless browser with sub-millisecond parsing.

## When to Use
- X(Twitter) account management (posting, reading timeline, interactions)
- Web automation tasks requiring login/session state
- Scraping pages that block simple fetch
- Any browser interaction needing clicks, fills, navigation

## Setup
```bash
npm install -g agent-browser
agent-browser install  # Download Chromium (first time only)
```

## Quick Reference

### Navigation & Core
```bash
agent-browser open <url>          # Open URL
agent-browser snapshot            # Accessibility tree with refs (best for AI)
agent-browser screenshot [path]   # Take screenshot
agent-browser close               # Close browser
```

### Interaction (use @ref from snapshot)
```bash
agent-browser click <sel>         # Click element
agent-browser fill <sel> <text>   # Clear and fill input
agent-browser type <sel> <text>   # Type into element
agent-browser press <key>         # Press key (Enter, Tab, etc)
agent-browser hover <sel>         # Hover element
agent-browser select <sel> <val>  # Select dropdown option
agent-browser scroll <dir> [px]   # Scroll up/down/left/right
```

### Data Extraction
```bash
agent-browser get text <sel>      # Get text content
agent-browser get html <sel>      # Get innerHTML
agent-browser get value <sel>     # Get input value
agent-browser get title           # Page title
agent-browser get url             # Current URL
```

### Semantic Finding
```bash
agent-browser find role <role> <action> --name "Name"
agent-browser find text "Sign In" click
agent-browser find label "Email" fill "value"
```

## Workflow: X Account Management

### Post a Tweet
```bash
agent-browser open https://x.com/compose/post
agent-browser snapshot
# Find the compose box and fill it
agent-browser fill "[data-testid='tweetTextarea_0']" "Tweet content here"
agent-browser find role button click --name "Post"
```

### Read Timeline
```bash
agent-browser open https://x.com/home
agent-browser snapshot
# Parse the accessibility tree for tweet content
```

### Check Notifications
```bash
agent-browser open https://x.com/notifications
agent-browser snapshot
```

## Tips
- Always use `snapshot` to get the accessibility tree with refs before interacting
- Use `@ref` notation (e.g., `@e2`) from snapshot output for precise targeting
- For X login, you may need to handle 2FA - coordinate with user
- Keep browser session alive between operations to maintain login state
- Use `screenshot --annotate` for visual debugging with numbered labels

## Security
- Never store X credentials in memory or logs
- Always close browser sessions when done
- Coordinate with user before posting or taking actions on their behalf
