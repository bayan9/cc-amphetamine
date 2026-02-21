/**
 * System Tray module - Handles system tray icon display
 *
 * Shows clawd icon when Claude Code sessions are active.
 * Exits when no sessions remain (Amphetamine detects process exit).
 */

const path = require('path');

const { getActiveSessionsWithLock, cleanupExpiredSessionsWithLock } = require('./session');
const { getElectron } = require('./electron');
const { removePidFileWithLock } = require('./pid');
const package = require('../package.json');

let trayState = null;

/**
 * Create clawd icon for system tray (monochrome template image)
 */
const createIcon = () => {
  const iconPath = path.join(__dirname, '../assets/clawd.png');
  const { nativeImage } = getElectron();
  const image = nativeImage.createFromPath(iconPath);
  if (process.platform === 'darwin') {
    image.setTemplateImage(true);
  }
  return image;
};

/**
 * Create system tray
 */
const createSystemTray = () => {
  const { Tray, Menu } = getElectron();

  if (!Tray) {
    throw new Error('Electron Tray is not available');
  }

  try {
    const tray = new Tray(createIcon());
    tray.setToolTip('CC-Amphetamine: Active');

    trayState = {
      tray,
      pollInterval: null
    };

    if (!Menu) {
      throw new Error('Electron Menu is not available');
    }

    const contextMenu = Menu.buildFromTemplate([
      {
        label: `Version: ${package.version}`,
        enabled: false
      },
      {
        label: 'Github',
        click: () => {
          getElectron().shell.openExternal('https://github.com/rogeriochaves/cc-amphetamine')
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Exit',
        click: async () => {
          await shutdownServer(trayState);
          process.exit(0);
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
    return trayState;
  } catch (error) {
    console.error('Error creating Electron system tray:', error);
    throw error;
  }
};

/**
 * Get current system tray state
 */
const getSystemTrayState = () => {
  return trayState;
};

/**
 * Get system tray instance
 */
const getSystemTray = () => {
  if (!trayState) {
    return createSystemTray();
  }
  return trayState;
};

/**
 * Update status based on active sessions.
 * Exits when no sessions remain — Amphetamine detects process exit.
 */
const updateStatus = async state => {
  if (!state) {
    return;
  }

  try {
    await cleanupExpiredSessionsWithLock();
    const activeSessions = await getActiveSessionsWithLock();

    if (activeSessions.length === 0) {
      console.error('No active sessions, shutting down...');
      await shutdownServer(state);
      process.exit(0);
    }
  } catch (error) {
    console.error('Error updating status:', error);
  }
};

/**
 * Start polling for session changes
 */
const startPolling = (state, interval = 10000) => {
  // Initial check
  updateStatus(state);

  // Set up periodic polling
  state.pollInterval = setInterval(() => {
    updateStatus(state);
  }, interval);
};

/**
 * Stop polling
 */
const stopPolling = state => {
  if (state && state.pollInterval) {
    try {
      clearInterval(state.pollInterval);
      state.pollInterval = null;
    } catch (error) {
      console.error('Error clearing interval:', error.message);
    }
  }
};

/**
 * Shutdown server and clean up resources
 */
const shutdownServer = async state => {
  console.error('Shutting down amphetamine server...');

  if (!state) {
    console.error('No state provided, exiting...');
    return;
  }

  // Stop polling
  stopPolling(state);

  // Clean up Electron system tray
  try {
    if (state.tray) {
      state.tray.destroy();
      state.tray = null;
    }
  } catch (error) {
    console.error('Error destroying Electron system tray:', error.message);
  }

  // Remove PID file
  try {
    await removePidFileWithLock();
  } catch (error) {
    console.error('Error removing PID file:', error.message);
  }

  // Reset global state
  trayState = null;
};

module.exports = {
  createIcon,
  createSystemTray,
  getSystemTray,
  getSystemTrayState,
  updateStatus,
  startPolling,
  stopPolling,
  shutdownServer
};
