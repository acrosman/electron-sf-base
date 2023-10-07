const jsforce = require('jsforce');

// A collection of active Salesforce connections, keyed by Org Id
const sfConnections = {};

// A collection of windows for call outs by name (when needed)
const windows = {};

const logMessages = [];

/**
 * Attaches a window to this library. Generally only 'main' is needed, but
 * other windows can be added as needed.
 * @param {*} windowName
 * @param {*} window
 */
const setWindow = (windowName, window) => {
  windows[windowName] = window;
};

/**
 * Send a log message to the console window.
 * @param {String} title  Message title or sender
 * @param {String} channel  Message category
 * @param {String} message  Message
 * @returns True (always).
 */
const logMessage = (title, channel, message) => {
  logMessages.unshift({
    timestamp: Date.now(),
    title,
    channel,
    message,
  });
  return true;
};

const handlers = {
  // Send a list of log messages to the main window.
  get_log_messages: (event, args) => {
    const { offset, count } = args;
    windows.main.webContents.send('log_messages', {
      messages: logMessages.slice(offset, offset + count),
      totalCount: logMessages.length,
    });
  },
  // Login to an org using password authentication.
  sf_login: (event, args) => {
    const conn = new jsforce.Connection({
      // you can change loginUrl to connect to sandbox or prerelease env.
      loginUrl: args.url,
    });

    let { password } = args;
    if (args.token !== '') {
      password = `${password}${args.token}`;
    }

    conn.login(args.username, password, (err, userInfo) => {
      // Since we send the args back to the interface, it's a good idea
      // to remove the security information.
      args.password = '';
      args.token = '';

      if (err) {
        logMessage(
          event.sender.getTitle(),
          'Error',
          `Login Failed ${err}`,
        );

        windows.main.webContents.send('response_generic', {
          status: false,
          message: 'Login Failed',
          response: err,
          limitInfo: conn.limitInfo,
          request: args,
        });
        return true;
      }
      // Now you can get the access token and instance URL information.
      // Save them to establish connection next time.
      logMessage(
        event.sender.getTitle(),
        'Info',
        `Connection Org ${userInfo.organizationId} for User ${userInfo.id}`,
      );

      // Save the next connection in the global storage.
      sfConnections[userInfo.organizationId] = {
        instanceUrl: conn.instanceUrl,
        accessToken: conn.accessToken,
      };

      windows.main.webContents.send('response_login', {
        status: true,
        message: 'Login Successful',
        response: userInfo,
        limitInfo: conn.limitInfo,
        request: args,
      });
      return true;
    });
  },
  // Logout of a specific Salesforce org.
  sf_logout: (event, args) => {
    const conn = new jsforce.Connection(sfConnections[args.org]);
    conn.logout((err) => {
      if (err) {
        windows.main.webContents.send('response_logout', {
          status: false,
          message: 'Logout Failed',
          response: `${err}`,
          limitInfo: conn.limitInfo,
          request: args,
        });
        logMessage(
          event.sender.getTitle(),
          'Error',
          `Logout Failed ${err}`,
        );
        return true;
      }
      // now the session has been expired.
      windows.main.webContents.send('response_logout', {
        status: true,
        message: 'Logout Successful',
        response: {},
        limitInfo: conn.limitInfo,
        request: args,
      });
      sfConnections[args.org] = null;
      return true;
    });
  },
  send_log: (event, args) => {
    logMessage(
      event.sender.getTitle(),
      args.channel,
      args.message,
    );
    return true;
  },
};

exports.handlers = handlers;
exports.setWindow = setWindow;
