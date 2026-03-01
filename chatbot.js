/**
 * chatbot.js — AI Fix Chatbot for AccessUI Auditor
 * Provides a conversational interface to Gemini AI for fixing accessibility violations.
 */

(function () {
  'use strict';

  let containerEl = null;
  let geminiApiKey = '';
  let scanResults = null;
  let conversationHistory = [];
  let systemContext = '';
  let chipsContainer = null;

  // ── Build system context from scan results ──
  function buildSystemContext(results) {
    const violationList = (results.violations || [])
      .map(v => `${v.id} (${v.impact || 'minor'})`)
      .join(', ');

    return `You are an expert web accessibility engineer and WCAG consultant embedded inside the AccessUI Auditor Chrome Extension.
The user has just scanned this page: ${results.url || 'Unknown URL'}
Accessibility score: ${results.score || 0}/100
Violations found: ${(results.violations || []).length} total — ${violationList || 'none'}

Your role is to help the developer fix these violations. When asked about a specific violation:
- Explain it clearly in 2-3 sentences
- Show the exact broken HTML (if available)
- Show the corrected HTML/CSS code fix
- Explain why this matters for users with disabilities

Always format code fixes inside triple backtick code blocks.
Be concise, practical, and friendly.`;
  }

  // ── Render a chat message bubble ──
  function renderMessage(role, text) {
    const wrapper = document.createElement('div');
    wrapper.className = role === 'user' ? 'chat-msg chat-msg-user' : 'chat-msg chat-msg-model';

    if (role === 'model') {
      const label = document.createElement('div');
      label.className = 'chat-msg-label';
      label.textContent = '✦ AI';
      wrapper.appendChild(label);
    }

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    // Parse code blocks from model responses
    if (role === 'model') {
      bubble.innerHTML = parseCodeBlocks(text);
    } else {
      bubble.textContent = text;
    }

    wrapper.appendChild(bubble);
    containerEl.appendChild(wrapper);

    // Attach copy-code button listeners
    if (role === 'model') {
      wrapper.querySelectorAll('.chat-copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const code = btn.closest('.chat-code-wrapper').querySelector('code').textContent;
          navigator.clipboard.writeText(code).then(() => {
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = 'Copy code'; }, 1500);
          });
        });
      });
    }

    scrollToBottom();
  }

  // ── Parse triple-backtick code blocks into styled HTML ──
  function parseCodeBlocks(text) {
    // Split on triple backtick blocks
    const parts = text.split(/(```[\s\S]*?```)/g);
    let html = '';

    for (const part of parts) {
      if (part.startsWith('```') && part.endsWith('```')) {
        // Remove opening ``` (with optional language tag) and closing ```
        const inner = part.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '');
        html += `<div class="chat-code-wrapper"><button class="chat-copy-btn">Copy code</button><pre class="chat-code-block"><code>${escapeHtml(inner)}</code></pre></div>`;
      } else {
        // Regular text — preserve newlines, escape HTML
        html += escapeHtml(part).replace(/\n/g, '<br>');
      }
    }

    return html;
  }

  // ── Escape HTML entities ──
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Show typing indicator ──
  function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'chat-msg chat-msg-model chat-typing-indicator';
    indicator.id = 'chatTyping';

    const label = document.createElement('div');
    label.className = 'chat-msg-label';
    label.textContent = '✦ AI';
    indicator.appendChild(label);

    const dots = document.createElement('div');
    dots.className = 'chat-bubble chat-typing-dots';
    dots.innerHTML = '<span></span><span></span><span></span>';
    indicator.appendChild(dots);

    containerEl.appendChild(indicator);
    scrollToBottom();
  }

  // ── Remove typing indicator ──
  function removeTypingIndicator() {
    const el = document.getElementById('chatTyping');
    if (el) el.remove();
  }

  // ── Scroll to bottom of chat ──
  function scrollToBottom() {
    if (containerEl) {
      containerEl.scrollTop = containerEl.scrollHeight;
    }
  }

  // ── Render quick-action chips ──
  function renderChips() {
    if (!chipsContainer) return;
    chipsContainer.innerHTML = '';

    const chips = [
      'Fix all critical violations',
      'Show me the most impactful fix',
      'How do I fix missing alt text?',
      'Explain colour contrast issues'
    ];

    chips.forEach(text => {
      const chip = document.createElement('button');
      chip.className = 'chat-chip';
      chip.textContent = text;
      chip.addEventListener('click', () => {
        const input = document.getElementById('chatInput');
        if (input) {
          input.value = text;
        }
        window.Chatbot.sendMessage(text);
      });
      chipsContainer.appendChild(chip);
    });
  }

  // ── Public API ──
  window.Chatbot = {

    /**
     * Initialize the chatbot with a container element, API key, and scan results.
     */
    init(container, apiKey, results) {
      containerEl = container;
      geminiApiKey = apiKey;
      scanResults = results;
      conversationHistory = [];
      systemContext = buildSystemContext(results);

      // Clear any previous messages
      containerEl.innerHTML = '';

      // Set up chips container reference
      chipsContainer = document.getElementById('chatChips');
      renderChips();

      // Show a welcome message
      renderMessage('model', 'Hello! I\'m your AI Fix Assistant. I can see the accessibility scan results for this page. Ask me about any violation and I\'ll provide specific code fixes.\n\nTry the quick actions below, or type your own question!');
    },

    /**
     * Send a user message, get an AI response.
     * @param {string} userMessage
     * @returns {Promise<string>} The model's response text
     */
    async sendMessage(userMessage) {
      if (!userMessage || !userMessage.trim()) return '';
      userMessage = userMessage.trim();

      // Render user bubble
      renderMessage('user', userMessage);

      // Append to history
      conversationHistory.push({ role: 'user', parts: [{ text: userMessage }] });

      // Show typing indicator
      showTypingIndicator();

      try {
        // Build contents array with system context priming
        const contents = [
          { role: 'user', parts: [{ text: systemContext }] },
          { role: 'model', parts: [{ text: 'Understood. I\'m ready to help fix the accessibility issues.' }] },
          ...conversationHistory
        ];

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 2048
              }
            })
          }
        );

        if (!response.ok) {
          const errorBody = await response.text();
          console.error('Chatbot API error:', response.status, errorBody);
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();
        const modelText = data.candidates[0].content.parts[0].text;

        // Append model response to history
        conversationHistory.push({ role: 'model', parts: [{ text: modelText }] });

        removeTypingIndicator();
        renderMessage('model', modelText);

        return modelText;

      } catch (error) {
        console.error('Chatbot error:', error);
        removeTypingIndicator();

        const errorMsg = 'Sorry, I encountered an error communicating with the AI. Please check your API key and try again.';
        renderMessage('model', errorMsg);
        return errorMsg;
      }
    },

    /**
     * Clear conversation history and messages.
     */
    clear() {
      conversationHistory = [];
      if (containerEl) {
        containerEl.innerHTML = '';
      }
      // Re-render welcome message
      if (scanResults) {
        renderMessage('model', 'Chat cleared. I still have the scan results — ask me anything about the violations!');
      }
      renderChips();
    }
  };

})();
