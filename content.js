(function() {
  'use strict';

  console.log('[Auto-Click] Content script initialized for softskills.oec.gov.pk');
  
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
    console.log('[Auto-Click] Loaded storage:', result);
    isEnabled = result.autoClickEnabled || false;
    
    if (result.stats) {
      clickCount = result.stats.clicksToday || 0;
    }
    
    if (result.settings) {
      Object.assign(CONFIG, result.settings);
    }
    
    if (isEnabled) {
      console.log('[Auto-Click] Auto-click was enabled, starting monitor');
      startMonitoring();
    }
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (changes.autoClickEnabled) {
      isEnabled = changes.autoClickEnabled.newValue;
      console.log('[Auto-Click] Storage changed, isEnabled:', isEnabled);
      
      if (isEnabled) {
        startMonitoring();
      } else {
        stopMonitoring();
      }
    }
    
    if (changes.settings) {
      Object.assign(CONFIG, changes.settings.newValue);
      console.log('[Auto-Click] Settings updated:', CONFIG);
    }
  });

  // Start monitoring
  function startMonitoring() {
    console.log(`[Auto-Click] Starting monitoring with ${CONFIG.clickDelay/1000}s delay`);
    
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
    
    sendStatusUpdate('Monitoring started - 10s delay');
  }

  // Stop monitoring
  function stopMonitoring() {
    console.log('[Auto-Click] Stopping monitoring');
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
      console.log(`[Auto-Click] Waiting ${remainingSeconds}s before next click`);
      sendStatusUpdate(`Waiting ${remainingSeconds}s...`);
      return;
    }
    
    console.log('[Auto-Click] === Scanning for buttons ===');
    
    // Priority 1: Look for "Mark as Complete" button if enabled
    if (CONFIG.markAsComplete) {
      const completeButton = findMarkAsCompleteButton();
      if (completeButton) {
        console.log('[Auto-Click] Found "Mark as Complete" button');
        if (clickButton(completeButton, 'Mark as Complete')) {
          return; // Successfully clicked
        }
      }
    }
    
    // Priority 2: Look for Next button
    const nextButton = findNextButton();
    if (nextButton) {
      console.log('[Auto-Click] Found Next button');
      if (clickButton(nextButton, 'Next')) {
        return; // Successfully clicked
      }
    }
    
    console.log('[Auto-Click] No actionable buttons found');
    sendStatusUpdate('No buttons found');
  }

  // Find "Mark as Complete" button
  function findMarkAsCompleteButton() {
    console.log('[Auto-Click] Searching for "Mark as Complete" button...');
    
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
        console.log('[Auto-Click] Potential "Mark as Complete" button found:', {
          text: getElementText(element),
          tag: element.tagName,
          id: element.id,
          classes: element.className
        });
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
          console.log('[Auto-Click] Found via selector:', selector, getElementText(element));
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
    console.log('[Auto-Click] Searching for Next button...');
    
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
        console.log('[Auto-Click] Potential Next button found:', {
          text: getElementText(element),
          tag: element.tagName,
          id: element.id,
          classes: element.className
        });
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
          console.log('[Auto-Click] Found via selector:', selector, getElementText(element));
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
      
      console.log(`[Auto-Click] Attempting to click ${buttonType} button: "${getElementText(element)}"`);
      
      // Check if button is clickable
      if (!isElementClickable(element)) {
        console.log(`[Auto-Click] ${buttonType} button not clickable, attempting to enable...`);
        const enabledElement = enableElement(element);
        if (!enabledElement) {
          console.log(`[Auto-Click] Could not enable ${buttonType} button`);
          return false;
        }
        element = enabledElement;
      }
      
      // Update last click time
      lastClickTime = Date.now();
      
      // Update stats
      updateStats(`${buttonType} button clicked`);
      sendStatusUpdate(`Clicked ${buttonType}`);
      
      // Visual feedback
      highlightElement(element, buttonType);
      
      // Prepare click events
      const events = [
        new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }),
        new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }),
        new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
      ];
      
      // Focus first
      element.focus();
      
      // Dispatch events
      events.forEach(event => {
        element.dispatchEvent(event);
      });
      
      // Native click
      element.click();
      
      console.log(`[Auto-Click] Successfully clicked ${buttonType} button!`);
      
      // Schedule next scan after delay
      setTimeout(() => {
        if (isEnabled) {
          scanAndClickButtons();
        }
      }, CONFIG.clickDelay + 1000); // Add 1 second buffer
      
      return true;
      
    } catch (error) {
      console.error(`[Auto-Click] Error clicking ${buttonType} button:`, error);
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
    console.log('[Auto-Click] Enabling element...');
    
    // Remove disabled attributes
    element.disabled = false;
    element.removeAttribute('disabled');
    element.removeAttribute('aria-disabled');
    
    // Remove disabled classes
    const disabledClasses = ['disabled', 'Mui-disabled', 'is-disabled', 'btn-disabled', 'ant-btn-disabled'];
    disabledClasses.forEach(className => {
      element.classList.remove(className);
    });
    
    // Add enabled classes
    element.classList.add('enabled', 'active', 'auto-click-enabled');
    
    // Fix styles
    element.style.pointerEvents = 'auto';
    element.style.cursor = 'pointer';
    element.style.opacity = '1';
    
    return element;
  }

  // Visual feedback for clicked element
  function highlightElement(element, buttonType) {
    const originalBackground = element.style.backgroundColor;
    const originalColor = element.style.color;
    const originalBorder = element.style.border;
    const originalTransform = element.style.transform;
    
    // Different colors for different button types
    let highlightColor;
    if (buttonType.includes('Complete')) {
      highlightColor = '#4CAF50'; // Green for Complete
    } else if (buttonType.includes('Next')) {
      highlightColor = '#2196F3'; // Blue for Next
    } else {
      highlightColor = '#FF9800'; // Orange for others
    }
    
    element.style.backgroundColor = highlightColor;
    element.style.color = 'white';
    element.style.border = `2px solid ${highlightColor}80`; // 80 = 50% opacity
    element.style.transform = 'scale(0.95)';
    element.style.transition = 'all 0.3s ease';
    element.style.zIndex = '1000';
    element.style.boxShadow = '0 0 15px rgba(0,0,0,0.3)';
    
    // Add text label
    const label = document.createElement('div');
    label.textContent = `✓ Auto-clicked (${buttonType})`;
    label.style.cssText = `
      position: absolute;
      background: ${highlightColor};
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
      z-index: 1001;
      pointer-events: none;
      transform: translateY(-30px);
      white-space: nowrap;
    `;
    
    const rect = element.getBoundingClientRect();
    label.style.left = `${rect.left + window.scrollX}px`;
    label.style.top = `${rect.top + window.scrollY}px`;
    document.body.appendChild(label);
    
    // Remove highlight after 2 seconds
    setTimeout(() => {
      element.style.backgroundColor = originalBackground;
      element.style.color = originalColor;
      element.style.border = originalBorder;
      element.style.transform = originalTransform;
      element.style.boxShadow = '';
      element.style.zIndex = '';
      
      if (label.parentNode) {
        label.parentNode.removeChild(label);
      }
    }, 2000);
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
    
    chrome.storage.local.set({ stats }, () => {
      console.log('[Auto-Click] Stats updated');
    });
    
    // Send update to popup
    try {
      chrome.runtime.sendMessage({
        type: 'statsUpdate',
        stats: stats
      });
    } catch (e) {
      console.log('[Auto-Click] Could not send stats update');
    }
  }

  // Send status update
  function sendStatusUpdate(status) {
    console.log('[Auto-Click] Status:', status);
    
    try {
      chrome.runtime.sendMessage({
        type: 'buttonStatusUpdate',
        status: status
      });
    } catch (e) {
      console.log('[Auto-Click] Could not send status update');
    }
  }

  // Listen for messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Auto-Click] Received message:', message);
    
    switch (message.action) {
      case 'toggleAutoClick':
        isEnabled = message.enabled;
        
        if (isEnabled) {
          startMonitoring();
          sendStatusUpdate('Active - 10s delay between clicks');
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

  console.log('[Auto-Click] Script fully loaded');
  sendStatusUpdate('Ready - 10s delay enabled');

})();