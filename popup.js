document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup loaded');
  
  const toggle = document.getElementById('toggle');
  const statusDiv = document.getElementById('status');
  const buttonStatus = document.getElementById('buttonStatus');
  const clickCount = document.getElementById('clickCount');
  const lastAction = document.getElementById('lastAction');
  const timeUntilNext = document.getElementById('timeUntilNext');

  // Create settings controls
  createSettingsControls();

  // Load saved state
  chrome.storage.local.get(['autoClickEnabled', 'stats', 'settings'], (result) => {
    const isEnabled = result.autoClickEnabled || false;
    toggle.checked = isEnabled;
    updateStatus(isEnabled);
    
    if (result.stats) {
      clickCount.textContent = result.stats.clicksToday || 0;
      lastAction.textContent = result.stats.lastAction || 'None';
    }
    
    // Load settings
    if (result.settings) {
      document.getElementById('clickDelay').value = result.settings.clickDelay / 1000;
      document.getElementById('markComplete').checked = result.settings.markAsComplete !== false;
    }
    
    requestStatus();
  });

  // Update status display
  function updateStatus(isEnabled) {
    if (isEnabled) {
      statusDiv.textContent = '🟢 ACTIVE';
      statusDiv.className = 'status active';
    } else {
      statusDiv.textContent = '⚫ INACTIVE';
      statusDiv.className = 'status inactive';
    }
  }

  // Create settings controls
  function createSettingsControls() {
    const settingsHTML = `
      <div class="settings-section">
        <div class="setting-item">
          <label>Click Delay (seconds):</label>
          <input type="number" id="clickDelay" min="5" max="60" value="10" style="width: 60px; padding: 4px;">
        </div>
        <div class="setting-item">
          <label>
            <input type="checkbox" id="markComplete" checked>
            Click "Mark as Complete"
          </label>
        </div>
        <button id="saveSettings" style="margin-top: 10px; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;">
          💾 Save Settings
        </button>
      </div>
    `;
    
    const settingsDiv = document.createElement('div');
    settingsDiv.innerHTML = settingsHTML;
    document.querySelector('.content').insertBefore(settingsDiv, document.querySelector('.instructions'));
    
    // Add CSS for settings
    const style = document.createElement('style');
    style.textContent = `
      .settings-section {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        margin: 15px 0;
        border: 1px solid #e9ecef;
      }
      .setting-item {
        margin: 10px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .setting-item label {
        font-size: 14px;
        color: #333;
      }
    `;
    document.head.appendChild(style);
    
    // Save settings handler
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
  }

  // Save settings
  function saveSettings() {
    const clickDelay = parseInt(document.getElementById('clickDelay').value) * 1000;
    const markComplete = document.getElementById('markComplete').checked;
    
    const settings = {
      clickDelay: clickDelay,
      markAsComplete: markComplete
    };
    
    chrome.storage.local.set({ settings: settings }, () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'updateSettings',
            settings: settings
          }, (response) => {
            if (response && response.success) {
              buttonStatus.textContent = `Settings saved - ${clickDelay/1000}s delay`;
              showNotification('Settings saved successfully!');
            }
          });
        }
      });
    });
  }

  // Show notification
  function showNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #4CAF50;
      color: white;
      padding: 10px 15px;
      border-radius: 4px;
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 2000);
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // Request status
  function requestStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, 
          { action: 'getStatus' },
          (response) => {
            if (chrome.runtime.lastError) {
              buttonStatus.textContent = 'Content script not loaded';
            } else if (response) {
              let statusText = response.isEnabled ? '🟢 Active' : '⚫ Inactive';
              if (response.timeUntilNextClick > 0) {
                statusText += ` | Next click in ${response.timeUntilNextClick}s`;
              }
              buttonStatus.textContent = statusText;
              
              if (timeUntilNext) {
                timeUntilNext.textContent = response.timeUntilNextClick > 0 ? 
                  `${response.timeUntilNextClick}s` : 'Ready';
              }
            }
          }
        );
      }
    });
  }

  // Toggle handler
  toggle.addEventListener('change', () => {
    const isEnabled = toggle.checked;
    
    chrome.storage.local.set({ autoClickEnabled: isEnabled });
    updateStatus(isEnabled);
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'toggleAutoClick',
          enabled: isEnabled
        });
      }
    });
    
    buttonStatus.textContent = isEnabled ? 'Activating...' : 'Deactivated';
  });

  // Listen for messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'buttonStatusUpdate') {
      buttonStatus.textContent = message.status;
    }
    
    if (message.type === 'statsUpdate') {
      clickCount.textContent = message.stats.clicksToday || 0;
      lastAction.textContent = message.stats.lastAction || 'None';
    }
    
    return true;
  });

  // Add control buttons
  const controlsDiv = document.createElement('div');
  controlsDiv.style.cssText = `
    margin-top: 15px;
    display: flex;
    gap: 10px;
  `;
  
  const forceBtn = document.createElement('button');
  forceBtn.textContent = '⚡ Force Click Now';
  forceBtn.style.cssText = `
    flex: 1;
    padding: 10px;
    background: #FF9800;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: bold;
  `;
  forceBtn.onclick = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'forceClick' });
        buttonStatus.textContent = 'Forcing click now...';
      }
    });
  };
  
  controlsDiv.appendChild(forceBtn);
  document.querySelector('.content').appendChild(controlsDiv);

  // Auto-update
  setInterval(() => {
    chrome.storage.local.get(['stats'], (result) => {
      if (result.stats) {
        clickCount.textContent = result.stats.clicksToday || 0;
        lastAction.textContent = result.stats.lastAction || 'None';
      }
    });
    requestStatus();
  }, 1000);
});