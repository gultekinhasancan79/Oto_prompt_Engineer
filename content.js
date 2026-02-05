// Prompt Enhancer - Content Script
// Works with ChatGPT, Gemini, Claude and other AI chat interfaces

(function() {
  'use strict';

  console.log('🚀 Prompt Enhancer loaded!');

  // Selectors for different AI chat platforms
  const SELECTORS = {
    // ChatGPT
    chatgpt: {
      input: '#prompt-textarea, div[id="prompt-textarea"], textarea[data-id="root"]',
      container: 'form'
    },
    // Gemini
    gemini: {
      input: '.ql-editor, div[contenteditable="true"][aria-label], rich-textarea .textarea',
      container: '.input-area, .text-input-field'
    },
    // Claude
    claude: {
      input: 'div[contenteditable="true"].ProseMirror, fieldset textarea',
      container: 'fieldset, .composer'
    },
    // Grok (grok.com and x.com)
    grok: {
      input: 'textarea[data-testid], textarea[placeholder*="Grok"], textarea[placeholder*="Ask"], div[contenteditable="true"][data-testid], div[role="textbox"], textarea.composer-input, div[class*="composer"] textarea, div[class*="input"] textarea, div[class*="chat"] textarea',
      container: null
    },
    // Generic - covers most cases
    generic: {
      input: 'textarea, div[contenteditable="true"], [role="textbox"]',
      container: null
    }
  };

  let enhanceButton = null;
  let undoButton = null;
  let currentInput = null;
  let refinementHistory = []; // Store all versions for step-by-step undo
  let refinementLevel = 0; // Track how many times prompt was refined
  let lastRefinedText = null; // Track last refined text to detect changes

  // Create the floating enhance button
  function createFloatingButton() {
    if (enhanceButton) return enhanceButton;

    enhanceButton = document.createElement('button');
    enhanceButton.id = 'prompt-enhancer-floating-btn';
    enhanceButton.innerHTML = '✨';
    enhanceButton.title = 'Prompt\'u Geliştir (AI)';
    enhanceButton.type = 'button';

    // Styles
    Object.assign(enhanceButton.style, {
      position: 'fixed',
      zIndex: '2147483647',
      width: '44px',
      height: '44px',
      borderRadius: '50%',
      border: 'none',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      fontSize: '20px',
      cursor: 'pointer',
      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.5)',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'transform 0.2s, box-shadow 0.2s',
      fontFamily: 'Arial, sans-serif'
    });

    enhanceButton.addEventListener('mouseenter', () => {
      enhanceButton.style.transform = 'scale(1.1)';
      enhanceButton.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.7)';
    });

    enhanceButton.addEventListener('mouseleave', () => {
      enhanceButton.style.transform = 'scale(1)';
      enhanceButton.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.5)';
    });

    enhanceButton.addEventListener('click', handleEnhance);

    document.body.appendChild(enhanceButton);
    return enhanceButton;
  }

  // Create the undo button
  function createUndoButton() {
    if (undoButton) return undoButton;

    undoButton = document.createElement('button');
    undoButton.id = 'prompt-enhancer-undo-btn';
    undoButton.innerHTML = '↩️';
    undoButton.title = 'Geri Al (Orijinal metni getir)';
    undoButton.type = 'button';

    Object.assign(undoButton.style, {
      position: 'fixed',
      zIndex: '2147483647',
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      border: 'none',
      background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%)',
      color: 'white',
      fontSize: '18px',
      cursor: 'pointer',
      boxShadow: '0 4px 15px rgba(255, 107, 107, 0.5)',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'transform 0.2s, box-shadow 0.2s',
      fontFamily: 'Arial, sans-serif'
    });

    undoButton.addEventListener('mouseenter', () => {
      undoButton.style.transform = 'scale(1.1)';
    });

    undoButton.addEventListener('mouseleave', () => {
      undoButton.style.transform = 'scale(1)';
    });

    undoButton.addEventListener('click', handleUndo);

    document.body.appendChild(undoButton);
    return undoButton;
  }

  // Handle undo
  function handleUndo(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!currentInput || refinementHistory.length === 0) {
      showNotification('Geri alınacak metin yok', 'warning');
      return;
    }

    // Pop the last version and go back one step
    refinementHistory.pop(); // Remove current version
    
    if (refinementHistory.length > 0) {
      // Go to previous version
      const previousVersion = refinementHistory[refinementHistory.length - 1];
      setInputText(currentInput, previousVersion);
      lastRefinedText = previousVersion;
      refinementLevel = refinementHistory.length - 1;
      showNotification(`↩️ Seviye ${refinementLevel}'e geri dönüldü`, 'info');
      updateButtonLevel();
    } else {
      // No more history, we're back to original
      showNotification('↩️ Orijinal metin geri yüklendi', 'info');
      hideUndoButton();
      refinementLevel = 0;
      lastRefinedText = null;
      updateButtonLevel();
    }
  }

  // Position undo button
  function positionUndoButton(inputElement) {
    if (!undoButton || !inputElement) return;
    
    // Get fresh rect
    const rect = inputElement.getBoundingClientRect();
    
    // Skip if element is not visible
    if (rect.width === 0 || rect.height === 0) return;
    
    // Position: next to enhance button (50px left of it)
    const top = rect.bottom - 46;
    const left = rect.right - 100;
    
    undoButton.style.top = `${top}px`;
    undoButton.style.left = `${left}px`;
    undoButton.style.display = 'flex';
  }

  // Hide undo button
  function hideUndoButton() {
    if (undoButton) {
      undoButton.style.display = 'none';
    }
  }

  // Get text from input element
  function getInputText(element) {
    if (!element) return '';
    
    // For textarea
    if (element.tagName === 'TEXTAREA') {
      return element.value || '';
    }
    
    // For contenteditable
    if (element.getAttribute('contenteditable') === 'true' || element.isContentEditable) {
      return element.innerText || element.textContent || '';
    }
    
    // For elements with value
    if (element.value !== undefined) {
      return element.value || '';
    }
    
    return element.innerText || element.textContent || '';
  }

  // Set text to input element
  function setInputText(element, text) {
    if (!element) return;
    
    // For textarea
    if (element.tagName === 'TEXTAREA') {
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    
    // For contenteditable (ChatGPT, Gemini, Claude)
    if (element.getAttribute('contenteditable') === 'true' || element.isContentEditable) {
      // Clear and set new content
      element.innerHTML = '';
      
      // Create paragraph for each line
      const lines = text.split('\n');
      lines.forEach((line, index) => {
        const p = document.createElement('p');
        p.textContent = line || '\u200B'; // Zero-width space for empty lines
        element.appendChild(p);
      });
      
      // Trigger input events
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
      
      // Focus at end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(element);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      
      return;
    }
    
    // Fallback
    if (element.value !== undefined) {
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // Position the button near the input
  function positionButton(inputElement) {
    if (!enhanceButton || !inputElement) return;
    
    // Get fresh rect each time
    const rect = inputElement.getBoundingClientRect();
    
    // Skip if element is not visible
    if (rect.width === 0 || rect.height === 0) return;
    
    // Position: 10px from right edge, 10px from bottom edge of input
    const top = rect.bottom - 48;
    const left = rect.right - 52;
    
    enhanceButton.style.top = `${top}px`;
    enhanceButton.style.left = `${left}px`;
    enhanceButton.style.display = 'flex';
  }

  // Hide the button
  function hideButton() {
    if (enhanceButton) {
      enhanceButton.style.display = 'none';
    }
    // Also hide undo button when main button is hidden
    hideUndoButton();
  }

  // Handle enhance button click
  async function handleEnhance(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!currentInput) {
      showNotification('Metin kutusu bulunamadı', 'error');
      return;
    }

    const text = getInputText(currentInput).trim();

    if (!text) {
      showNotification('Lütfen geliştirmek için metin girin', 'warning');
      return;
    }

    if (text.length < 5) {
      showNotification('Metin çok kısa', 'warning');
      return;
    }

    // Check if text changed from last refined text - reset level if so
    if (lastRefinedText && text !== lastRefinedText) {
      refinementLevel = 0;
      refinementHistory = [];
    }

    // Loading state - show current level
    enhanceButton.innerHTML = '⏳';
    enhanceButton.style.pointerEvents = 'none';

    try {
      // Check if extension context is still valid
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        showNotification('⚠️ Sayfayı yenileyin (F5)', 'error');
        return;
      }

      const response = await chrome.runtime.sendMessage({
        action: 'enhancePrompt',
        text: text,
        refinementLevel: refinementLevel
      });

      if (response && response.success) {
        // Store current text in history before replacing
        if (refinementHistory.length === 0) {
          // First time - save original
          refinementHistory.push(text);
        }
        
        // Add the new refined version to history
        refinementHistory.push(response.enhancedText);
        
        // Increment refinement level
        refinementLevel++;
        lastRefinedText = response.enhancedText;
        
        setInputText(currentInput, response.enhancedText);
        
        // Show level in notification
        showNotification(`✨ Prompt geliştirildi! (Seviye ${refinementLevel}) ↩️`, 'success');
        
        // Update button to show level
        updateButtonLevel();
        
        // Show undo button
        createUndoButton();
        positionUndoButton(currentInput);
      } else if (response) {
        if (response.error === 'API_KEY_MISSING') {
          showNotification('Eklenti ikonuna tıklayıp API Key girin', 'error');
        } else if (response.error === 'INVALID_API_KEY') {
          showNotification('Geçersiz API Key', 'error');
        } else {
          showNotification(response.message || 'Hata oluştu', 'error');
        }
      } else {
        showNotification('Bağlantı hatası', 'error');
      }
    } catch (error) {
      console.error('Prompt Enhancer Error:', error);
      // Check for extension context invalidated error
      if (error.message && error.message.includes('Extension context invalidated')) {
        showNotification('⚠️ Sayfayı yenileyin (F5)', 'error');
      } else if (error.message && error.message.includes('sendMessage')) {
        showNotification('⚠️ Sayfayı yenileyin (F5)', 'error');
      } else {
        showNotification('Hata: ' + error.message, 'error');
      }
    } finally {
      updateButtonLevel();
      enhanceButton.style.pointerEvents = 'auto';
      // Make sure buttons stay visible after DOM updates
      if (currentInput) {
        // Small delay to let DOM update after text change
        setTimeout(() => {
          positionButton(currentInput);
          if (undoButton?.style.display !== 'none') {
            positionUndoButton(currentInput);
          }
        }, 100);
      }
    }
  }

  // Update button to show refinement level
  function updateButtonLevel() {
    if (!enhanceButton) return;
    
    if (refinementLevel > 0) {
      // Show level badge next to emoji (don't change position!)
      enhanceButton.innerHTML = `✨<sup style="font-size:10px;font-weight:bold;color:#fff;margin-left:-2px;">${refinementLevel}</sup>`;
    } else {
      enhanceButton.innerHTML = '✨';
    }
  }

  // Notification system
  function showNotification(message, type = 'info') {
    const existing = document.getElementById('prompt-enhancer-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.id = 'prompt-enhancer-notification';
    
    const colors = {
      success: { bg: 'rgba(46, 213, 115, 0.95)', color: 'white' },
      error: { bg: 'rgba(255, 107, 107, 0.95)', color: 'white' },
      warning: { bg: 'rgba(254, 202, 87, 0.95)', color: '#1a1a2e' },
      info: { bg: 'rgba(72, 219, 251, 0.95)', color: 'white' }
    };

    const style = colors[type] || colors.info;

    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '14px 24px',
      borderRadius: '12px',
      background: style.bg,
      color: style.color,
      fontFamily: 'Arial, sans-serif',
      fontSize: '14px',
      fontWeight: 'bold',
      zIndex: '2147483647',
      boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
      transform: 'translateX(120%)',
      transition: 'transform 0.3s ease'
    });

    notification.textContent = message;
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 10);

    // Auto remove
    setTimeout(() => {
      notification.style.transform = 'translateX(120%)';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  // Find input elements
  function findInputElements() {
    const inputs = [];
    
    // Try all selector groups
    Object.values(SELECTORS).forEach(({ input }) => {
      try {
        document.querySelectorAll(input).forEach(el => {
          if (!inputs.includes(el)) {
            inputs.push(el);
          }
        });
      } catch (e) {}
    });
    
    return inputs;
  }

  // Setup event listeners on input
  function setupInput(input) {
    if (input.dataset.promptEnhancerSetup) return;
    input.dataset.promptEnhancerSetup = 'true';

    // Show button on focus
    input.addEventListener('focus', () => {
      currentInput = input;
      createFloatingButton();
      positionButton(input);
    });

    // Hide button on blur (with delay for button click)
    input.addEventListener('blur', (e) => {
      setTimeout(() => {
        if (!enhanceButton?.matches(':hover')) {
          hideButton();
        }
      }, 300);
    });

    // Show on click
    input.addEventListener('click', () => {
      currentInput = input;
      createFloatingButton();
      positionButton(input);
    });

    // Keep button visible on paste
    input.addEventListener('paste', () => {
      currentInput = input;
      createFloatingButton();
      setTimeout(() => positionButton(input), 50);
    });

    // Keep button visible on input/typing and reset refinement level if text changed
    input.addEventListener('input', () => {
      if (currentInput === input && enhanceButton) {
        positionButton(input);
        
        // Check if user is typing new content (not from our setInputText)
        const currentText = getInputText(input).trim();
        if (lastRefinedText && currentText !== lastRefinedText) {
          // User modified the text, reset refinement level and history
          refinementLevel = 0;
          lastRefinedText = null;
          refinementHistory = [];
          updateButtonLevel();
          hideUndoButton();
        }
      }
    });

    // Keep button visible on keydown
    input.addEventListener('keydown', () => {
      if (currentInput === input && enhanceButton) {
        createFloatingButton();
        positionButton(input);
      }
    });

    console.log('✅ Prompt Enhancer: Input found and setup', input);
  }

  // Main initialization
  function init() {
    const inputs = findInputElements();
    inputs.forEach(setupInput);

    if (inputs.length > 0) {
      console.log(`✅ Prompt Enhancer: ${inputs.length} input(s) found`, inputs);
    } else {
      // Debug: show what textareas/inputs exist on page
      const allTextareas = document.querySelectorAll('textarea');
      const allContentEditable = document.querySelectorAll('[contenteditable="true"]');
      const allTextbox = document.querySelectorAll('[role="textbox"]');
      console.log('🔍 Prompt Enhancer Debug:', {
        textareas: allTextareas.length,
        contentEditable: allContentEditable.length,
        textbox: allTextbox.length,
        url: window.location.href
      });
    }
  }

  // Initial setup with delay (wait for page to fully load)
  setTimeout(init, 500);
  setTimeout(init, 1000);
  setTimeout(init, 2000);
  setTimeout(init, 3000);
  setTimeout(init, 5000); // Extra delay for slow-loading sites like Grok

  // Watch for dynamic content
  const observer = new MutationObserver(() => {
    init();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Reposition on scroll/resize
  window.addEventListener('scroll', () => {
    if (currentInput && enhanceButton?.style.display !== 'none') {
      positionButton(currentInput);
      if (undoButton?.style.display !== 'none') {
        positionUndoButton(currentInput);
      }
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (currentInput && enhanceButton?.style.display !== 'none') {
      positionButton(currentInput);
      if (undoButton?.style.display !== 'none') {
        positionUndoButton(currentInput);
      }
    }
  }, { passive: true });

  // Continuous repositioning while buttons are visible (handles dynamic content/animations)
  setInterval(() => {
    if (currentInput && enhanceButton?.style.display !== 'none') {
      positionButton(currentInput);
      if (undoButton?.style.display !== 'none') {
        positionUndoButton(currentInput);
      }
    }
  }, 200);

  // Listen for keyboard shortcut from background.js
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'triggerEnhance') {
      // Find focused input or last used input
      const activeElement = document.activeElement;
      
      if (activeElement && (
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.isContentEditable ||
        activeElement.getAttribute('contenteditable') === 'true' ||
        activeElement.getAttribute('role') === 'textbox'
      )) {
        currentInput = activeElement;
        createFloatingButton();
        positionButton(currentInput);
        // Trigger the enhance
        handleEnhance(new Event('click'));
      } else if (currentInput) {
        // Use last known input
        handleEnhance(new Event('click'));
      } else {
        showNotification('Metin kutusuna tıklayın', 'warning');
      }
    }
  });

  // Also listen for Ctrl+Shift+E directly in content script as backup
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'TEXTAREA' || 
        activeElement.isContentEditable ||
        activeElement.getAttribute('contenteditable') === 'true'
      )) {
        currentInput = activeElement;
        createFloatingButton();
        positionButton(currentInput);
        handleEnhance(new Event('click'));
      } else if (currentInput) {
        handleEnhance(new Event('click'));
      } else {
        showNotification('Önce metin kutusuna tıklayın', 'warning');
      }
    }
  });

})();
