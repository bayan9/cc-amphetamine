# cc-amphetamine

Shows a **clawd** (Claude mascot) icon in your macOS menu bar while Claude Code sessions are active. Pairs with [Amphetamine](https://apps.apple.com/app/amphetamine/id937984704) to prevent your Mac from sleeping.

Hard fork of [cc-caffeine](https://github.com/samber/cc-caffeine) by Samuel Berthe.

## How it works

1. Claude Code hooks call `cc-amphetamine caffeinate` when a session is active
2. An Electron process starts showing the **clawd icon** in the menu bar
3. [Amphetamine](https://apps.apple.com/app/amphetamine/id937984704) detects the running app and keeps your Mac awake
4. When all sessions expire, the process exits and the icon disappears
5. Amphetamine detects the app is gone and allows sleep again

The clawd icon auto-adapts to light/dark mode:

![](./assets/clawd.png) - Claude Code is active

## Installation

```bash
/install rogeriochaves/cc-amphetamine
```

## Amphetamine Setup

1. Install [Amphetamine](https://apps.apple.com/app/amphetamine/id937984704) from the Mac App Store
2. Open Amphetamine > Preferences > Triggers
3. Add a new trigger > **Application**
4. Select the Electron app (find it at `node_modules/electron/dist/Electron.app` inside the plugin directory)
5. Done! Amphetamine will keep your Mac awake whenever the clawd icon is visible

## Configuration

Optional config at `~/.claude/plugins/cc-amphetamine/config.json`:

```json
{
  "session_timeout_minutes": 5
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `session_timeout_minutes` | `15` | Minutes of inactivity before a session expires |

## Commands

```bash
# Check status
cc-amphetamine status

# Manual usage (normally handled by hooks automatically)
echo '{"session_id": "test"}' | cc-amphetamine caffeinate
echo '{"session_id": "test"}' | cc-amphetamine uncaffeinate

# Start server manually (normally auto-started)
cc-amphetamine server
```

## How it differs from cc-caffeine

- **No built-in sleep prevention** — delegates to Amphetamine which handles lid-close properly
- **macOS only** — Amphetamine is a macOS app
- **Clawd icon** instead of coffee cup
- **Process exits when idle** — no sessions means the app dies, Amphetamine stops preventing sleep

## License

MIT
