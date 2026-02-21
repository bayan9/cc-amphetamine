/**
 * Server module - Handles server process management and startup
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const { initSessionsFile } = require('./session');
const { getSystemTray, startPolling, shutdownServer } = require('./system-tray');
const {
  isRunningInElectron,
  preventWindowCreation,
  setupAppEventHandlers,
  whenReady,
  quit
} = require('./electron');
const { isServerRunning, writePidFile, withPidLock, isServerRunningWithLock } = require('./pid');

const CHECK_INTERVAL = 5 * 1000; // 5 seconds
const CONFIG_DIR = path.join(os.homedir(), '.claude', 'plugins', 'cc-amphetamine');
const STARTUP_LOCK = path.join(CONFIG_DIR, '.starting');

/**
 * Ensure server is running, start if needed
 */
const runServerProcessIfNotStarted = async () => {
  // Use a startup lock file to prevent concurrent spawns.
  // The lock stays until the server boots and removes it (~3-5s).
  // After 30s it's considered stale.
  try {
    const stat = fs.statSync(STARTUP_LOCK);
    const age = Date.now() - stat.mtimeMs;
    if (age < 30000) {
      return; // startup in progress
    }
    fs.unlinkSync(STARTUP_LOCK);
  } catch (error) {
    // File doesn't exist, continue
  }

  const isRunning = await isServerRunningWithLock();
  if (isRunning) {
    return;
  }

  try {
    // Atomic exclusive create — only one process wins
    fs.writeFileSync(STARTUP_LOCK, process.pid.toString(), { flag: 'wx' });
  } catch (error) {
    return; // another process won the race
  }

  try {
    console.error('Server not running, starting...');
    await startServerProcess();
  } catch (error) {
    try { fs.unlinkSync(STARTUP_LOCK); } catch (e) {}
  }
};

/**
 * Start server process using pnpm
 */
const startServerProcess = async () => {
  console.error('Starting amphetamine server...');

  const cwd = path.join(__dirname, '..');

  const serverProcess = spawn('pnpm', ['run', 'server'], {
    detached: true,
    stdio: 'ignore',
    cwd
  });

  serverProcess.unref();

  return true;
};

/**
 * Handle server command - start Electron server or delegate with atomic file locking
 */
const handleServer = async () => {
  let mustStartServer = false;
  let mustStartElectron = false;

  await withPidLock(async () => {
    try {
      // Inside the lock, check if server is already running
      const alreadyRunning = await isServerRunning();
      if (alreadyRunning) {
        console.error('Amphetamine server is already running');
        return;
      }

      if (isRunningInElectron()) {
        mustStartServer = true;
        console.error('Already running inside Electron, starting server...');
        await writePidFile(process.pid);
      } else {
        mustStartElectron = true;
        console.error('Not running inside Electron, spawning Electron process...');
      }
    } catch (error) {
      if (error.code === 'ELOCKED' || error.code === 'EEXIST') {
        // Another process has the lock, server is likely starting up
        console.error('Server startup is in progress by another process');
      } else {
        console.error('Failed to acquire server startup lock:', error);
        throw error;
      }
    }
  });

  if (mustStartElectron) {
    await spawnElectronProcess();
  } else if (mustStartServer) {
    await startServer();
  } else if (isRunningInElectron()) {
    await shutdownServer();
    process.exit(0);
  }
};

/**
 * Start server when already inside Electron
 */
const startServer = async () => {
  console.error('Loading Electron...');

  // Prevent any window from being created
  preventWindowCreation();

  // Setup event handlers with shutdown callback
  setupAppEventHandlers(() => {
    // We'll handle shutdown in the main process
    process.exit(0);
  });

  // Wait for app to be ready before starting system tray
  await whenReady();

  // Start the actual server
  try {
    // Remove startup lock now that server is running
    try { fs.unlinkSync(STARTUP_LOCK); } catch (e) {}

    await initSessionsFile();
    const state = getSystemTray();
    startPolling(state, CHECK_INTERVAL);
    console.error('Amphetamine server started successfully with system tray');

    // Only setup signal handlers if server actually started
    if (state) {
      // Handle process termination for Electron process
      process.on('SIGINT', async () => {
        console.error('Received SIGINT, shutting down server...');
        await shutdownServer(state);
        quit();
      });

      process.on('SIGTERM', async () => {
        console.error('Received SIGTERM, shutting down server...');
        await shutdownServer(state);
        quit();
      });
    }

    return state;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

/**
 * Spawn new Electron process for server
 */
const spawnElectronProcess = () => {
  const cwd = path.join(__dirname, '..');

  const electronProcess = spawn('npx', ['electron', 'clawd.js', 'server'], {
    stdio: 'inherit',
    shell: true,
    detached: false,
    cwd
  });

  electronProcess.on('exit', code => {
    process.exit(code || 0);
  });

  electronProcess.on('error', error => {
    console.error('Failed to spawn Electron process:', error);
    process.exit(1);
  });

  electronProcess.on('close', code => {
    process.exit(code || 0);
  });

  return electronProcess.pid;
};

module.exports = {
  handleServer,
  runServerProcessIfNotStarted
};
