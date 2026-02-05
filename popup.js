document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveBtn = document.getElementById('saveBtn');
  const changeBtn = document.getElementById('changeBtn');
  const message = document.getElementById('message');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const toggleVisibility = document.getElementById('toggleVisibility');
  const langTR = document.getElementById('langTR');
  const langEN = document.getElementById('langEN');

  // Load existing settings on popup open
  chrome.storage.local.get(['geminiApiKey', 'outputLanguage'], (result) => {
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
      updateStatus(true);
      lockInput();
    } else {
      updateStatus(false);
      unlockInput();
    }
    
    // Load language preference
    const lang = result.outputLanguage || 'tr';
    setActiveLanguage(lang);
  });

  // Language selection
  langTR.addEventListener('click', () => {
    setActiveLanguage('tr');
    chrome.storage.local.set({ outputLanguage: 'tr' }, () => {
      showMessage('🇹🇷 Türkçe seçildi', 'success');
    });
  });

  langEN.addEventListener('click', () => {
    setActiveLanguage('en');
    chrome.storage.local.set({ outputLanguage: 'en' }, () => {
      showMessage('🇬🇧 English selected', 'success');
    });
  });

  function setActiveLanguage(lang) {
    langTR.classList.remove('active');
    langEN.classList.remove('active');
    if (lang === 'tr') {
      langTR.classList.add('active');
    } else {
      langEN.classList.add('active');
    }
  }

  // Toggle password visibility
  toggleVisibility.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleVisibility.textContent = '🙈';
    } else {
      apiKeyInput.type = 'password';
      toggleVisibility.textContent = '👁';
    }
  });

  // Save API key
  saveBtn.addEventListener('click', () => {
    if (saveBtn.classList.contains('locked')) {
      return; // Already locked, do nothing
    }

    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      showMessage('API key girin', 'error');
      return;
    }

    // Basic validation - Groq API keys start with 'gsk_'
    if (!apiKey.startsWith('gsk_')) {
      showMessage('Geçersiz key formatı (gsk_ ile başlamalı)', 'error');
      return;
    }

    chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
      showMessage('✓ API Key kaydedildi!', 'success');
      updateStatus(true);
      lockInput();
    });
  });

  // Change API key button
  changeBtn.addEventListener('click', () => {
    unlockInput();
    apiKeyInput.value = '';
    apiKeyInput.focus();
    showMessage('Yeni API key girin', 'info');
  });

  // Handle Enter key
  apiKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !saveBtn.classList.contains('locked')) {
      saveBtn.click();
    }
  });

  function lockInput() {
    apiKeyInput.disabled = true;
    saveBtn.classList.add('locked');
    saveBtn.textContent = '🔒 Kaydedildi';
    changeBtn.classList.add('show');
  }

  function unlockInput() {
    apiKeyInput.disabled = false;
    saveBtn.classList.remove('locked');
    saveBtn.textContent = 'Kaydet';
    changeBtn.classList.remove('show');
  }

  function showMessage(text, type) {
    message.textContent = text;
    message.className = `message ${type} show`;
    
    setTimeout(() => {
      message.classList.remove('show');
    }, 3000);
  }

  function updateStatus(isConfigured) {
    if (isConfigured) {
      statusDot.classList.add('active');
      statusText.textContent = 'API Key aktif';
    } else {
      statusDot.classList.remove('active');
      statusText.textContent = 'API Key girilmedi';
    }
  }
});
