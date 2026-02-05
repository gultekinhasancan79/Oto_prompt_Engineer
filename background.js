// Prompt Enhancer - Background Service Worker
// Pipeline: User Input → LLM → Cleaner → Validator → Retry → Normalize → User

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';
const MAX_RETRIES = 3;

// ==================== MODEL PROFILES ====================

const MODEL_PROFILES = {
  'llama-3.1-8b-instant': { strictness: 'high', temperature: 0.2 },
  'llama-3.3-70b-versatile': { strictness: 'high', temperature: 0.2 },
  'mixtral-8x7b-32768': { strictness: 'high', temperature: 0.2 },
  'gemma2-9b-it': { strictness: 'medium', temperature: 0.3 },
  'gpt-4': { strictness: 'low', temperature: 0.4 },
  'claude-3': { strictness: 'low', temperature: 0.4 }
};

// ==================== DYNAMIC SYSTEM PROMPT ====================

function buildSystemPrompt(model) {
  const profile = MODEL_PROFILES[model] || { strictness: 'high' };
  
  const base = `You are a Prompt Refiner.
Rewrite and expand the user's prompt.

RULES:
- Do NOT answer the prompt.
- Do NOT explain or describe the prompt.
- Output ONLY the rewritten prompt.
- CRITICAL: Write in the SAME language as the input. If input is Turkish, output MUST be Turkish. If input is English, output MUST be English.
- Preserve intent exactly.
- Control text such as TASK, MODE, STATE, LEVEL is NOT part of the prompt.
- Never include control text in the output.`;

  if (profile.strictness === 'high') {
    return base + `

ABSOLUTE:
- No meta text
- No descriptions
- No API or model mentions
- No intro sentences
- No "Here is..." or "This prompt..."`;
  }

  if (profile.strictness === 'medium') {
    return base + `

IMPORTANT:
- Avoid meta commentary
- Keep output clean`;
  }

  return base;
}

// Stricter prompt for retries
function buildStrictPrompt() {
  return `ONLY rewrite the prompt. Write NOTHING else. No explanations. No intro. Just the prompt.`;
}

// ==================== BANNED WORDS ====================

const BANNED_WORDS = [
  'bu prompt', 'this prompt', 'bu görev', 'this task',
  'işte', 'here is', 'here\'s', 'aşağıda', 'below',
  'api', 'llm', 'eklenti', 'extension', 'plugin',
  'geliştirdim', 'refined', 'improved version', 'geliştirilmiş versiyon',
  'rewritten prompt', 'enhanced prompt', 'yeniden yazılmış',
  'task:', 'mode:', 'state:', 'level:', 'prompt_refinement',
  'prompt_state', 'refinement_level'
];

// ==================== CONTROL BLOCK STRIPPER ====================

function stripControlBlocks(text) {
  return text.replace(
    /^(TASK|MODE|PROMPT_STATE|REFINEMENT_LEVEL|PROMPT:|INPUT_LANGUAGE|OUTPUT_LANGUAGE).*$/gim,
    ""
  ).replace(/^"""\s*$/gm, "").trim();
}

// ==================== STEP 3: META-TEXT CLEANER ====================

function metaTextCleaner(text) {
  if (!text) return { cleaned: text, wasModified: false };
  
  let cleaned = text.trim();
  let wasModified = false;
  
  // Strip control blocks first
  const beforeStrip = cleaned;
  cleaned = stripControlBlocks(cleaned);
  if (cleaned !== beforeStrip) wasModified = true;
  
  // Remove content before ":" if it's an intro
  const introColonMatch = cleaned.match(/^[^.!?\n]{0,100}[:：]\s*\n+(.+)/s);
  if (introColonMatch && introColonMatch[1]) {
    cleaned = introColonMatch[1].trim();
    wasModified = true;
  }
  
  // Remove leading/trailing quotes
  const beforeQuotes = cleaned;
  cleaned = cleaned.replace(/^["'""„]+|["'""]+$/g, '');
  if (cleaned !== beforeQuotes) wasModified = true;
  
  // Remove common intro phrases
  const introPatterns = [
    /^(işte|here is|here's|aşağıda|below is)[^.:\n]*[.:]\s*/i,
    /^(prompt|the prompt|refined prompt)[.:]\s*/i,
    /^(rewritten|improved|enhanced)[^.:\n]*[.:]\s*/i,
    /^(yeniden yazılmış|geliştirilmiş)[^.:\n]*[.:]\s*/i,
  ];
  
  for (const pattern of introPatterns) {
    const before = cleaned;
    cleaned = cleaned.replace(pattern, '');
    if (cleaned !== before) wasModified = true;
  }
  
  // Remove banned word lines
  const lines = cleaned.split('\n');
  const filteredLines = lines.filter(line => {
    const lower = line.toLowerCase();
    return !BANNED_WORDS.some(word => lower.includes(word));
  });
  
  if (filteredLines.length !== lines.length) wasModified = true;
  cleaned = filteredLines.join('\n').trim();
  
  // Trim empty lines at start/end
  cleaned = cleaned.replace(/^\s*\n+|\n+\s*$/g, '');
  
  return { 
    cleaned: cleaned || text.trim(), 
    wasModified 
  };
}

// ==================== STEP 4: VALIDATOR ====================

function validateOutput(text, originalInput) {
  const errors = [];
  const lower = text.toLowerCase();
  
  // Check for banned words
  for (const word of BANNED_WORDS) {
    if (lower.includes(word)) {
      errors.push(`BANNED_WORD: "${word}"`);
    }
  }
  
  // Check if output is too similar to a direct answer (starts with yes/no patterns)
  if (/^(evet|hayır|yes|no|tabii|of course)[,.\s]/i.test(text)) {
    errors.push('ANSWER_DETECTED');
  }
  
  // Check for question marks (AI asking questions instead of refining)
  const questionCount = (text.match(/\?/g) || []).length;
  if (questionCount >= 3) {
    errors.push('TOO_MANY_QUESTIONS');
  }
  
  // Check if output preserved user intent (basic check - contains key words from input)
  const inputWords = originalInput.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  const outputLower = text.toLowerCase();
  const preservedWords = inputWords.filter(w => outputLower.includes(w));
  if (inputWords.length > 3 && preservedWords.length < inputWords.length * 0.3) {
    errors.push('INTENT_LOST');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// ==================== STEP 6: NORMALIZE ====================

function normalizeOutput(text) {
  let normalized = text;
  
  // Normalize whitespace
  normalized = normalized.replace(/\r\n/g, '\n');
  normalized = normalized.replace(/\n{3,}/g, '\n\n');
  normalized = normalized.replace(/[ \t]+$/gm, ''); // trailing spaces
  normalized = normalized.trim();
  
  return normalized;
}

// ==================== LANGUAGE DETECTION ====================

function detectLanguage(text) {
  // Turkish specific characters
  const turkishChars = /[çğıöşüÇĞİÖŞÜ]/;
  // Turkish common words
  const turkishWords = /\b(bir|ve|bu|için|ile|de|da|mi|mı|ne|var|yok|olan|gibi|daha|çok|nasıl|neden|hangi|kadar|olarak|bana|benim|senin|onun)\b/i;
  
  if (turkishChars.test(text) || turkishWords.test(text)) {
    return 'TURKISH';
  }
  
  return 'ENGLISH';
}

// ==================== STEP 2: LLM CALL ====================

async function callLLM(userText, apiKey, temperature = 0.2, refinementLevel = 0) {
  const systemPrompt = buildSystemPrompt(MODEL);
  const profile = MODEL_PROFILES[MODEL] || { temperature: 0.2 };
  
  // Detect language (simple heuristic)
  const detectedLang = detectLanguage(userText);
  
  const promptState = refinementLevel === 0 ? 'RAW' : 'REFINED';
  const formattedUserPrompt = `TASK: PROMPT_REFINEMENT

PROMPT_STATE: ${promptState}
REFINEMENT_LEVEL: ${refinementLevel}
INPUT_LANGUAGE: ${detectedLang}
OUTPUT_LANGUAGE: ${detectedLang}

PROMPT:
"""
${userText}
"""`;

  const maxTokens = 8192; // No limit - use model max

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: formattedUserPrompt }
      ],
      temperature: temperature || profile.temperature,
      top_p: 0.9,
      max_tokens: maxTokens,
      presence_penalty: 0,
      frequency_penalty: 0
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    if (response.status === 401) {
      throw { code: 'INVALID_API_KEY', message: 'Geçersiz API Key' };
    }
    
    if (response.status === 429) {
      throw { code: 'RATE_LIMIT', message: 'Rate limit aşıldı, bekle' };
    }

    throw { code: 'API_ERROR', message: `Hata (${response.status}): ${errorData.error?.message || 'Bilinmeyen'}` };
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}

// Stricter LLM call for retries
async function callLLMStrict(userText, apiKey, refinementLevel = 0) {
  const systemPrompt = buildStrictPrompt();
  const detectedLang = detectLanguage(userText);
  
  const promptState = refinementLevel === 0 ? 'RAW' : 'REFINED';
  const formattedUserPrompt = `TASK: PROMPT_REFINEMENT

PROMPT_STATE: ${promptState}
REFINEMENT_LEVEL: ${refinementLevel}
INPUT_LANGUAGE: ${detectedLang}
OUTPUT_LANGUAGE: ${detectedLang}

PROMPT:
"""
${userText}
"""`;
  
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: formattedUserPrompt }
      ],
      temperature: 0.1,
      top_p: 0.8,
      max_tokens: 8192,
      presence_penalty: 0,
      frequency_penalty: 0
    })
  });

  if (!response.ok) {
    throw { code: 'API_ERROR', message: 'Retry failed' };
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}

// ==================== KEYBOARD SHORTCUT ====================

if (chrome.commands && chrome.commands.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    if (command === 'enhance-prompt') {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'triggerEnhance' });
        }
      });
    }
  });
}

// ==================== MESSAGE LISTENER ====================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'enhancePrompt') {
    const refinementLevel = request.refinementLevel || 0;
    processPipeline(request.text, refinementLevel)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ 
          success: false, 
          error: error.code || 'ERROR',
          message: error.message || 'Hata oluştu'
        });
      });
    return true;
  }
});

// ==================== MAIN PIPELINE ====================
// User Input → LLM → Cleaner → Validator → Retry → Normalize → User

async function processPipeline(userInput, refinementLevel = 0) {
  // Get config
  const result = await chrome.storage.local.get(['geminiApiKey', 'outputLanguage']);
  const apiKey = result.geminiApiKey;

  if (!apiKey) {
    return {
      success: false,
      error: 'API_KEY_MISSING',
      message: 'Eklenti ikonuna tıklayıp API Key gir'
    };
  }

  const profile = MODEL_PROFILES[MODEL] || { temperature: 0.2 };
  let retryCount = 0;
  let lastError = null;
  let temperature = profile.temperature;

  while (retryCount < MAX_RETRIES) {
    try {
      console.log(`[Pipeline] Attempt ${retryCount + 1}/${MAX_RETRIES}, temp=${temperature}`);
      
      // STEP 2: LLM Call
      let rawOutput;
      if (retryCount === 0) {
        rawOutput = await callLLM(userInput, apiKey, temperature, refinementLevel);
      } else {
        // Use stricter prompt on retries
        rawOutput = await callLLMStrict(userInput, apiKey, refinementLevel);
      }
      
      if (!rawOutput) {
        throw { code: 'EMPTY_RESPONSE', message: 'API yanıt vermedi' };
      }
      
      console.log(`[Pipeline] Raw output length: ${rawOutput.length}`);
      
      // STEP 3: Meta-Text Cleaner
      const { cleaned, wasModified } = metaTextCleaner(rawOutput);
      console.log(`[Pipeline] Cleaned, modified: ${wasModified}`);
      
      // STEP 4: Validator
      const validation = validateOutput(cleaned, userInput);
      
      if (!validation.isValid) {
        console.log(`[Pipeline] Validation failed: ${validation.errors.join(', ')}`);
        lastError = validation.errors.join(', ');
        
        // Retry with lower temperature
        retryCount++;
        temperature = Math.max(0.1, temperature - 0.05);
        continue;
      }
      
      // STEP 6: Normalize
      const finalOutput = normalizeOutput(cleaned);
      
      console.log(`[Pipeline] Success after ${retryCount + 1} attempts`);
      
      return {
        success: true,
        enhancedText: finalOutput,
        retries: retryCount
      };
      
    } catch (error) {
      console.error(`[Pipeline] Error:`, error);
      
      // Don't retry on API key or rate limit errors
      if (error.code === 'INVALID_API_KEY' || error.code === 'RATE_LIMIT') {
        return {
          success: false,
          error: error.code,
          message: error.message
        };
      }
      
      lastError = error.message;
      retryCount++;
      temperature = Math.max(0.1, temperature - 0.05);
    }
  }

  // All retries exhausted
  console.log(`[Pipeline] All ${MAX_RETRIES} retries failed`);
  return {
    success: false,
    error: 'MAX_RETRIES_EXCEEDED',
    message: `${MAX_RETRIES} deneme başarısız: ${lastError}`
  };
}
