let currentSearchText;
let searchEnabled = false;

const enableSearch = (pageContent) => {
  pageContent.on('found-in-page', (event, result) => {
    pageContent.send('log_message', {
      sender: 'Find',
      channel: 'Info',
      message: `Found ${result.matches} for ${currentSearchText}`,
    });
  });
  searchEnabled = true;
};

/**
 * executeSearch: Searches provided content for requested text.
 * @param {*} pageContent: The content of the window to Search.
 * @param {String} searchText: The text to search for.
 * @param {String} searchDirection: The direction to search the text in.
 */
const executeSearch = (pageContent, searchText, searchDirection) => {
  if (!searchEnabled) {
    enableSearch(pageContent);
  }

  // If there is no active search, or this is new text, start a search.
  if (currentSearchText !== searchText) {
    currentSearchText = searchText;
    pageContent.send('log_message', {
      sender: 'Find',
      channel: 'Info',
      message: `Starting search for ${currentSearchText}`,
    });
    pageContent.findInPage(currentSearchText, {
      forward: searchDirection === 'forward',
      findNext: false,
      matchCase: true,
    });
  } else {
    pageContent.findInPage(currentSearchText, {
      forward: searchDirection === 'forward',
      findNext: true,
      matchCase: true,
    });
  }
};

/**
 * jumpToFind: Moves the window with search to be the active window, and instructs it to active
 *  find controls.
 * @param {*} findWindow: The window with application find controls
 */
const jumpToFind = (item, focusedWindow) => {
  focusedWindow.webContents.send('start_find');
};

exports.executeSearch = executeSearch;
exports.jumpToFind = jumpToFind;
