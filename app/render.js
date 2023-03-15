/* global $ */
// Initial interface setup using jQuery (since it's around from bootstrap anyway).
$.when($.ready).then(() => {
  // Hide the places for handling responses until we have some.
  $('#org-status').hide();
  $('#results-table-wrapper').hide();
  $('#results-message-wrapper').hide();
  $('#results-object-viewer-wrapper').hide();
  // Get the current application preferences.
  window.api.send('get_preferences');

  // Setup Find button.
  $('#btn-find-in-page').on('click', (event) => {
    event.preventDefault();
    let searchDir;
    // Get the search
    const searchText = $('#find-in-page-text').val().trim();

    // Trigger the search if text was provided.
    if (searchText) {
      // Set direction.
      searchDir = 'forward';
      if ($('#chk-find-direction').prop('checked')) {
        searchDir = 'back';
      }

      window.api.send('find_text', {
        text: searchText,
        direction: searchDir,
      });
    }
  });

  // Setup event listener for when the console modal opens,
  // pull in the most recent 50 messages.
  $('#consoleModal').on('show.bs.modal', () => {
    // Clear existing messages.
    const messageTable = document.querySelector('#consoleMessageTable');
    while (messageTable.rows.length > 1) {
      messageTable.removeChild(messageTable.lastChild);
    }
    document.getElementById('log-console-load-more').dataset.count = 0;

    // Load first 50
    window.api.send('get_log_messages', { offset: 0, count: 50 });
  });

  // Setup load more action handler for log messages. Unlike the listeners above,
  // that all call Salesforce, this is just trying to pull more log messages.
  $('#log-console-load-more').on('click', (event) => {
    event.preventDefault();
    window.api.send('get_log_messages', { offset: event.target.dataset.count, count: 50 });
  });
});

// ============= Helpers ==============
// Simple find and replace of text based on selector.
const replaceText = (selector, text) => {
  const element = document.getElementById(selector);
  if (element) element.innerText = text;
};

// Escapes HTML tags that may be headed to the log messages.
const escapeHTML = (html) => {
  const escape = document.createElement('textarea');
  escape.textContent = html;
  return escape.innerHTML;
};

/**
 * Displays an object as JSON in the raw response section of the interface.
 * @param {Object} responseObject The JSForce response object.
 */
const displayRawResponse = (responseObject) => {
  $('#raw-response').jsonViewer(responseObject, {
    collapsed: true,
    rootCollapsable: false,
    withQuotes: true,
    withLinks: true,
  });
};

/**
 * Log a message to the console.
 * @param {Date} timestamp The part of the system that generated the message.
 * @param {String} channel One of 'Error', 'Info', 'Success', 'Warn', and 'Debug'.
 * @param {String} title Log message title.
 * @param {String} message The message to display.
 */
function showLogMessage(timestamp, channel, title, message) {
  // Create elements for display.
  const logTable = document.getElementById('consoleMessageTable');
  const row = logTable.insertRow();
  const mesImportance = document.createElement('td');
  const mesTime = document.createElement('td');
  const mesTitle = document.createElement('td');
  const mesText = document.createElement('td');

  // Add Classes.
  mesText.setAttribute('class', 'console-message');

  // Set the row highlights as needed.
  switch (channel.toLowerCase()) {
    case 'error':
      row.className += 'table-danger';
      break;
    case 'debug':
    case 'warning':
    case 'warn':
      row.className += 'table-warning';
      break;
    case 'success':
      row.className += 'table-success';
      break;
    default: // This will handle info and any junk sent.
      break;
  }

  // Add Text
  mesTime.innerHTML = new Date(timestamp).toLocaleString();
  mesImportance.innerHTML = channel;
  mesTitle.innerHTML = escapeHTML(title);
  mesText.innerHTML = escapeHTML(message);

  // Attach Elements
  row.appendChild(mesImportance);
  row.appendChild(mesTime);
  row.appendChild(mesTitle);
  row.appendChild(mesText);
}

/**
 * Display a list of messages pulled from the main thread.
 * @param {Array} messageList
 */
function displayMessages(messageList) {
  messageList.forEach((message) => {
    showLogMessage(message.timestamp, message.channel, message.message);
  });

  let currentCount = parseInt(document.getElementById('log-console-load-more').dataset.count, 10);
  currentCount += messageList.length;
  document.getElementById('log-console-load-more').dataset.count = currentCount;
}

// Convert a simple object with name/value pairs, and sub-objects into an Unordered list
const object2ul = (data) => {
  const ul = document.createElement('ul');
  const keys = Object.keys(data);
  let li;
  let i;

  for (i = 0; i < keys.length; i += 1) {
    li = document.createElement('li');
    // if it's sub-object recurse.
    if (typeof data[keys[i]] === 'object' && data[keys[i]] !== null) {
      li.appendChild(object2ul(data[keys[i]]));
    } else {
      // append the text to the li.
      li.appendChild(document.createTextNode(data[keys[i]]));
    }
    ul.appendChild(li); // append the list item to the ul
  }

  return ul;
};

/**
 * Attaches the DOM element for a table header element attached an existing table.
 * @param {Object} headerRow The DOM element to attach the new header to.
 * @param {String} labelText The text for the element.
 * @param {String} scope The scope attribute to use for the element, defaults to col.
 */
const generateTableHeader = (headerRow, labelText, scope = 'col') => {
  const newHeader = document.createElement('th');
  newHeader.setAttribute('scope', scope);
  const textNode = document.createTextNode(labelText);
  newHeader.appendChild(textNode);
  headerRow.appendChild(newHeader);
};

/**
 * Attaches a new table cell to an existing row.
 * @param {Object} tableRow The DOM element to attach the new element to.
 * @param {String} content The text to put in the cell.
 */
const generateTableCell = (tableRow, content) => {
  const contentNode = document.createTextNode(content);
  const cellNode = document.createElement('td');
  cellNode.appendChild(contentNode);
  tableRow.appendChild(cellNode);
};

/**
 * Generates a data table from a list of sObjects returned from a query, and displays it
 * in the results-table-wrapper area of the interface.
 * @param {Object} sObjectData A JSForce query response with SF SObject data.
 */
const refreshResponseTable = (sObjectData) => {
  document.getElementById('results-table-wrapper').style.display = 'block';
  document.getElementById('results-message-wrapper').style.display = 'none';
  document.getElementById('results-object-viewer-wrapper').style.display = 'none';
  document.getElementById(
    'results-summary-count',
  ).innerText = `Fetched ${sObjectData.records.length} of ${sObjectData.totalSize} records`;

  // Get the table.
  const resultsTable = document.querySelector('#results-table');

  // Clear existing table.
  while (resultsTable.firstChild) {
    resultsTable.removeChild(resultsTable.firstChild);
  }

  // Extract the header.
  const keys = Object.keys(sObjectData.records[0]).filter(
    (value) => value !== 'attributes',
  );

  // Create the header row for the table.
  const tHead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.setAttribute('class', 'table-primary');

  // Add the type column.
  generateTableHeader(headRow, 'Type');

  // Add the other columns from the result set.
  for (let i = 0; i < keys.length; i += 1) {
    generateTableHeader(headRow, keys[i]);
  }
  tHead.appendChild(headRow);
  resultsTable.appendChild(tHead);

  // Add the data.
  let dataRow;
  const tBody = document.createElement('tbody');
  for (let i = 0; i < sObjectData.records.length; i += 1) {
    dataRow = document.createElement('tr');
    // Put the object type as a row level header.
    generateTableHeader(dataRow, sObjectData.records[i].attributes.type, 'row');

    // Add the result details.
    for (let j = 0; j < keys.length; j += 1) {
      generateTableCell(dataRow, sObjectData.records[i][keys[j]]);
    }
    tBody.appendChild(dataRow);
  }
  resultsTable.appendChild(tBody);
};

/**
 * Displays an object in the results-object-viewer section of the interface using JSONViewer.
 *
 * @param {Object} data The object to display, object must contain message and response attributes.
 */
const refreshObjectDisplay = (data) => {
  $('#results-object-viewer-wrapper .results-summary h3').text(data.message);

  // When this is displaying a describe add a little helpful summary.
  if (Object.prototype.hasOwnProperty.call(data, 'response.fields')) {
    $('#results-object-viewer-wrapper .results-summary p').text(
      `Found ${data.response.fields.length} fields and ${data.response.recordTypeInfos.length} record types.`,
    );
  } else {
    $('#results-object-viewer-wrapper .results-summary p').text('');
  }

  $('#results-object-viewer').jsonViewer(data.response, {
    collapsed: true,
    rootCollapsable: false,
    withQuotes: true,
    withLinks: true,
  });
};

// ========= Messages to the main process ===============
// Login
document.getElementById('login-trigger').addEventListener('click', () => {
  window.api.send('sf_login', {
    username: document.getElementById('login-username').value,
    password: document.getElementById('login-password').value,
    token: document.getElementById('login-token').value,
    url: document.getElementById('login-url').value,
  });
});

// Logout
document.getElementById('logout-trigger').addEventListener('click', () => {
  window.api.send('sf_logout', {
    org: document.getElementById('active-org').value,
  });
  document.getElementById('org-status').style.display = 'none';
  // @TODO: Remove org from list of active orgs.
  // @TODO: Update/hide status area if no orgs remain.
});

// ===== Response handlers from IPC Messages to render context ======
// Process a log message.
window.api.receive('log_messages', (data) => {
  displayMessages(data.messages);
});

// Login response.
window.api.receive('response_login', (data) => {
  if (data.status) {
    // Add the new connection to the list of options.
    const opt = document.createElement('option');
    opt.value = data.response.organizationId;
    opt.innerHTML = data.request.username;
    opt.id = `sforg-${opt.value}`;
    document.getElementById('active-org').appendChild(opt);

    // Shuffle what's shown.
    document.getElementById('org-status').style.display = 'block';
    replaceText('active-org-id', data.response.organizationId);
    replaceText('login-response-message', data.message);
    displayRawResponse(data.response);
  }
});

// Logout Response.
window.api.receive('response_logout', (data) => {
  displayRawResponse(data);
  // TODO: Remove connection information.
});

// Generic Response.
window.api.receive('response_generic', (data) => {
  displayRawResponse(data);
});

// Get Preference Updates
window.api.receive('current_preferences', (data) => {
  // Update the theme:
  const cssPath = `../node_modules/bootswatch/dist/${data.theme.toLowerCase()}/bootstrap.min.css`;
  document.getElementById('css-theme-link').href = cssPath;
});

// Start the find process by activating the controls and scrolling there.
window.api.receive('start_find', () => {
  const findbox = document.getElementById('find-in-page-text');
  findbox.scrollIntoView();
  findbox.focus();
});
