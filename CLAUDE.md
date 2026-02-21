# CC-Amphetamine: Claude Code Session Indicator

A Node.js/Electron app that shows a clawd icon in the macOS menu bar while Claude Code sessions are active. Pairs with [Amphetamine](https://apps.apple.com/app/amphetamine/id937984704) for sleep prevention.

Hard fork of [cc-caffeine](https://github.com/samber/cc-caffeine).

## Architecture

### Core Modules

1. **amphetamine.js** - Main entry point that orchestrates all modules and handles command routing
2. **src/commands.js** - Handles command-line interface functionality and process management
3. **src/session.js** - Manages session persistence with file locking and timeout handling
4. **src/server.js** - Handles server process management and Electron integration
5. **src/system-tray.js** - Manages system tray icon (clawd) and session monitoring
6. **src/electron.js** - Wraps Electron-specific functionality
7. **src/config.js** - Reads user configuration from `~/.claude/plugins/cc-amphetamine/config.json`

### User Commands

1. **caffeinate command** - Adds session to JSON file and ensures server is running
2. **uncaffeinate command** - Removes session from JSON file
3. **server command** - Starts Electron system tray application that polls JSON file for active sessions
4. **version command** - Shows version information
5. **status command** - Shows active sessions and server status

## Key Behavior

- Server starts when a session is added and no server is running
- Server **exits when no active sessions remain** (after timeout)
- Amphetamine detects process exit and allows Mac to sleep
- Clawd icon uses macOS template image (auto light/dark mode)

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

## Technical Stack

- **Node.js 14+** - Runtime environment
- **Electron** - System tray icon only (no sleep prevention)
- **proper-lockfile** - File locking for concurrent access
- **Electron Tray** - Menu bar icon
- **JSON file** - Session storage and communication
- **Amphetamine** - macOS app for sleep prevention via app trigger

## Module Import Structure

- `amphetamine.js` imports from `src/commands.js` and `src/server.js`
- `src/commands.js` imports from `src/session.js`, `src/config.js`, and `src/server.js`
- `src/server.js` imports from `src/session.js`, `src/system-tray.js`, and `src/electron.js`
- `src/system-tray.js` imports from `src/session.js`, `src/electron.js`, and `src/pid.js`
- `src/session.js` imports from `src/config.js`
- `src/config.js` reads `~/.claude/plugins/cc-amphetamine/config.json`
- `src/electron.js` provides Electron functionality on-demand

## File Structure

```
amphetamine.js       - Main entry point and command routing
src/
  commands.js        - Command-line interface and process management
  session.js         - Session persistence and file locking
  server.js          - Server process management and Electron integration
  system-tray.js     - System tray icon and session monitoring
  electron.js        - Electron-specific functionality wrapper
  config.js          - User configuration reader
  pid.js             - PID file management
assets/
  clawd.svg          - Clawd icon (SVG source)
  clawd.png          - Clawd icon (PNG for tray)
~/.claude/plugins/cc-amphetamine/
  sessions.json      - JSON file with session data
  config.json        - User configuration (optional)
  server.pid         - Server PID file
```
