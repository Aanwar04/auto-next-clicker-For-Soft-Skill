(function () {
  'use strict';

  // Disable logging to avoid detection
  const console = { ...window.console };
  window.console = {
    log: () => { },
    error: () => { },
    warn: () => { },
    info: () => { },
    debug: () => { }
  };

  let isEnabled = false;
  let checkInterval = null;
  let clickCount = 0;
  let lastClickTime = 0;
  const CLICK_DELAY = 10000; // 10 seconds in milliseconds

  // Configuration
  const CONFIG = {
    clickDelay: CLICK_DELAY,
    autoClickEnabled: true,
    markAsComplete: true
  };

  // Load saved state
  chrome.storage.local.get(['autoClickEnabled', 'stats', 'settings'], (result) => {
    isEnabled = result.autoClickEnabled || false;

    if (result.stats) {
      clickCount = result.stats.clicksToday || 0;
    }

    if (result.settings) {
      Object.assign(CONFIG, result.settings);
    }

    if (isEnabled) {
      startMonitoring();
    }
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.autoClickEnabled) {
      isEnabled = changes.autoClickEnabled.newValue;

      if (isEnabled) {
        startMonitoring();
      } else {
        stopMonitoring();
      }
    }

    if (changes.settings) {
      Object.assign(CONFIG, changes.settings.newValue);
    }
  });

  // Start monitoring
  function startMonitoring() {
    if (checkInterval) {
      clearInterval(checkInterval);
    }

    // First check immediately
    setTimeout(scanAndClickButtons, 1000);

    // Then check every 5 seconds
    checkInterval = setInterval(() => {
      if (!isEnabled) return;
      scanAndClickButtons();
    }, 5000);

    sendStatusUpdate('Monitoring started');
  }

  // Stop monitoring
  function stopMonitoring() {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
    sendStatusUpdate('Monitoring stopped');
  }

  // Main scanning function
  function scanAndClickButtons() {
    if (!isEnabled) return;

    // Check if enough time has passed since last click
    const timeSinceLastClick = Date.now() - lastClickTime;
    if (timeSinceLastClick < CONFIG.clickDelay) {
      const remainingSeconds = Math.ceil((CONFIG.clickDelay - timeSinceLastClick) / 1000);
      sendStatusUpdate(`Waiting ${remainingSeconds}s...`);
      return;
    }

    // Priority 1: Look for "Mark as Complete" button if enabled
    if (CONFIG.markAsComplete) {
      const completeButton = findMarkAsCompleteButton();
      if (completeButton) {
        if (clickButton(completeButton, 'Mark as Complete')) {
          return; // Successfully clicked
        }
      }
    }

    // Priority 2: Look for Next button
    const nextButton = findNextButton();
    if (nextButton) {
      if (clickButton(nextButton, 'Next')) {
        return; // Successfully clicked
      }
    }

    sendStatusUpdate('No buttons found');
  }

  // Find "Mark as Complete" button
  function findMarkAsCompleteButton() {
    const allElements = document.querySelectorAll('button, input[type="button"], input[type="submit"], a, [role="button"]');

    for (const element of allElements) {
      const text = getElementText(element).toLowerCase().trim();
      const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
      const title = (element.getAttribute('title') || '').toLowerCase();

      // Check for "Mark as Complete" in various forms
      const isCompleteButton =
        text.includes('mark as complete') ||
        text.includes('mark complete') ||
        text.includes('complete') ||
        text.includes('finish') ||
        text.includes('done') ||
        text.includes('submit') ||
        ariaLabel.includes('complete') ||
        ariaLabel.includes('finish') ||
        ariaLabel.includes('submit') ||
        title.includes('complete') ||
        title.includes('finish');

      if (isCompleteButton) {
        return element;
      }
    }

    // Also check by specific classes/IDs that might indicate completion
    const specificSelectors = [
      '[id*="complete"]',
      '[id*="submit"]',
      '[id*="finish"]',
      '[class*="complete"]',
      '[class*="submit"]',
      '[class*="finish"]',
      '.btn-success',
      '.btn-primary',
      '.submit-btn'
    ];

    for (const selector of specificSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          return element;
        }
      } catch (e) {
        // Ignore selector errors
      }
    }

    return null;
  }

  // Find Next button
  function findNextButton() {
    const allElements = document.querySelectorAll('button, input[type="button"], input[type="submit"], a, [role="button"]');

    for (const element of allElements) {
      const text = getElementText(element).toLowerCase().trim();
      const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
      const title = (element.getAttribute('title') || '').toLowerCase();

      // Check for "Next" in various languages
      const isNextButton =
        text.includes('next') ||
        text.includes('التالي') || // Arabic
        text.includes('اگلا') ||   // Urdu
        text.includes('continue') ||
        text.includes('proceed') ||
        ariaLabel.includes('next') ||
        ariaLabel.includes('التالي') ||
        title.includes('next');

      if (isNextButton) {
        return element;
      }
    }

    // Also check by specific classes/IDs
    const specificSelectors = [
      '[id*="next"]',
      '[class*="next"]',
      '.btn-next',
      '.next-btn',
      '.navigation button:last-child',
      '.pagination-next'
    ];

    for (const selector of specificSelectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          return element;
        }
      } catch (e) {
        // Ignore selector errors
      }
    }

    return null;
  }

  // Get text from any element
  function getElementText(element) {
    if (!element) return '';

    if (element.tagName === 'INPUT') {
      return element.value || element.placeholder || element.title || '';
    }

    if (element.tagName === 'BUTTON' || element.tagName === 'A' || element.tagName === 'SPAN') {
      return element.textContent || element.innerText || element.title || element.getAttribute('aria-label') || '';
    }

    return element.textContent || element.innerText || '';
  }

  // Click a button
  function clickButton(element, buttonType = 'Button') {
    try {
      if (!element) return false;

      // Check if button is clickable
      if (!isElementClickable(element)) {
        const enabledElement = enableElement(element);
        if (!enabledElement) {
          return false;
        }
        element = enabledElement;
      }

      // Update last click time
      lastClickTime = Date.now();

      // Update stats
      updateStats(`${buttonType} button clicked`);
      sendStatusUpdate(`Clicked ${buttonType}`);

      // Focus first
      element.focus();

      // Native click - use only click event to avoid detection
      element.click();

      // Schedule next scan after delay with random variation
      const randomDelay = CONFIG.clickDelay + Math.floor(Math.random() * 3000); // Add 0-3 seconds randomness
      setTimeout(() => {
        if (isEnabled) {
          scanAndClickButtons();
        }
      }, randomDelay);

      return true;

    } catch (error) {
      sendStatusUpdate(`Error: ${error.message}`);
      return false;
    }
  }

  // Check if element is clickable
  function isElementClickable(element) {
    if (!element) return false;

    // Check disabled state
    if (element.disabled) return false;
    if (element.hasAttribute('disabled')) return false;
    if (element.getAttribute('aria-disabled') === 'true') return false;

    // Check disabled classes
    const disabledClasses = ['disabled', 'Mui-disabled', 'is-disabled', 'btn-disabled', 'ant-btn-disabled'];
    for (const className of disabledClasses) {
      if (element.classList.contains(className)) return false;
    }

    // Check styles
    const style = getComputedStyle(element);
    if (style.pointerEvents === 'none') return false;
    if (style.opacity === '0.5' || parseFloat(style.opacity) < 1) return false;
    if (style.cursor === 'not-allowed') return false;
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;

    // Check if visible
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    if (rect.top < 0 || rect.left < 0) return false;

    return true;
  }

  // Enable a disabled element
  function enableElement(element) {
    // Remove disabled attributes
    element.disabled = false;
    element.removeAttribute('disabled');
    element.removeAttribute('aria-disabled');

    // Remove disabled classes
    const disabledClasses = ['disabled', 'Mui-disabled', 'is-disabled', 'btn-disabled', 'ant-btn-disabled'];
    disabledClasses.forEach(className => {
      element.classList.remove(className);
    });

    // Fix styles
    element.style.pointerEvents = 'auto';
    element.style.cursor = 'pointer';
    element.style.opacity = '1';

    return element;
  }

  // Update statistics
  function updateStats(action) {
    clickCount++;
    const stats = {
      clicksToday: clickCount,
      lastAction: action,
      lastActionTime: new Date().toLocaleTimeString(),
      lastClickTimestamp: Date.now()
    };

    chrome.storage.local.set({ stats }, () => { });

    // Send update to popup
    try {
      chrome.runtime.sendMessage({
        type: 'statsUpdate',
        stats: stats
      });
    } catch (e) {
      // Ignore errors
    }
  }

  // Send status update
  function sendStatusUpdate(status) {
    try {
      chrome.runtime.sendMessage({
        type: 'buttonStatusUpdate',
        status: status
      });
    } catch (e) {
      // Ignore errors
    }
  }

  // Listen for messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'toggleAutoClick':
        isEnabled = message.enabled;

        if (isEnabled) {
          startMonitoring();
          sendStatusUpdate('Active');
        } else {
          stopMonitoring();
          sendStatusUpdate('Paused');
        }

        sendResponse({ success: true });
        break;

      case 'getStatus':
        const timeUntilNextClick = Math.max(0, CONFIG.clickDelay - (Date.now() - lastClickTime));
        const secondsUntilNextClick = Math.ceil(timeUntilNextClick / 1000);

        sendResponse({
          isEnabled: isEnabled,
          timeUntilNextClick: secondsUntilNextClick,
          settings: CONFIG,
          lastClick: lastClickTime ? new Date(lastClickTime).toLocaleTimeString() : 'Never'
        });
        break;

      case 'updateSettings':
        if (message.settings) {
          Object.assign(CONFIG, message.settings);
          chrome.storage.local.set({ settings: CONFIG });
          sendResponse({ success: true, settings: CONFIG });
        }
        break;

      case 'forceClick':
        scanAndClickButtons();
        sendResponse({ success: true });
        break;
    }

    return true;
  });

  sendStatusUpdate('Ready');
})();