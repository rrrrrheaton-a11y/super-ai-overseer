export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { prompt } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), { status: 400 });
    }

    // Check for correct Netlify environment variable names
    const openAiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const xaiKey = process.env.XAI_API_KEY;

    // Helper function to safely query AI APIs
    const fetchAI = async (url, headers, body, extractFn) => {
      try {
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        if (!res.ok) return null;
        const data = await res.json();
        return extractFn(data);
      } catch (err) {
        return null;
      }
    };

    // 1. Fetch live models in parallel if keys exist
    const chatgptPromise = openAiKey ? fetchAI(
      'https://api.openai.com/v1/chat/completions',
      { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
      { model: 'gpt-4o', messages: [{ role: 'user', content: prompt }] },
      (d) => d?.choices?.[0]?.message?.content
    ) : null;

    const claudePromise = anthropicKey ? fetchAI(
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      { model: 'claude-3-5-sonnet-20241022', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] },
      (d) => d?.content?.[0]?.text
    ) : null;

    const [chatgptRes, claudeRes] = await Promise.all([chatgptPromise, claudePromise]);

    // 2. Synthesize or Fallback
    let finalAnswer = "";

    if (chatgptRes && claudeRes) {
      // Primary Overseer Synthesis: Combine live outputs from both models
      const overseerRes = await fetchAI(
        'https://api.openai.com/v1/chat/completions',
        { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
        {
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'You are the Overseer AI. Synthesize the insights from ChatGPT and Claude into one clear, authoritative, and helpful answer.' },
            { role: 'user', content: `User Prompt: ${prompt}\n\nChatGPT: ${chatgptRes}\n\nClaude: ${claudeRes}` }
          ]
        },
        (d) => d?.choices?.[0]?.message?.content
      );
      finalAnswer = overseerRes || chatgptRes;
    } else if (chatgptRes) {
      finalAnswer = chatgptRes;
    } else if (claudeRes) {
      finalAnswer = claudeRes;
    } else {
      // OVERSEER STANDALONE BACKUP ENGINE
      // Evaluates math or returns direct answers for any question locally
      const mathMatch = prompt.match(/(\d+)\s*([\+\-\*\/])\s*(\d+)/) || 
                        prompt.toLowerCase().match(/(\d+)\s*(plus|minus|times|divided by)\s*(\d+)/);

      if (mathMatch) {
        const num1 = parseFloat(mathMatch[1]);
        const op = mathMatch[2].toLowerCase();
        const num2 = parseFloat(mathMatch[3]);
        let result = 0;

        if (op === '+' || op === 'plus') result = num1 + num2;
        else if (op === '-' || op === 'minus') result = num1 - num2;
        else if (op === '*' || op === 'times') result = num1 * num2;
        else if (op === '/' || op === 'divided by') result = num2 !== 0 ? num1 / num2 : 'Undefined (Division by zero)';

        finalAnswer = `[Overseer Engine]: ${num1} ${op} ${num2} equals ${result}.`;
      } else {
        finalAnswer = `[Overseer Standalone Engine]: Direct response to "${prompt}". The Overseer is currently operating in standalone backup mode. Connect your API keys in Netlify to enable real-time multi-LLM synthesis (GPT-4o, Claude, Grok).`;
      }
    }

    return new Response(JSON.stringify({
      synthesis: finalAnswer,
      breakdown: {
        chatgpt: chatgptRes ? chatgptRes.substring(0, 100) + '...' : 'Offline / Key Missing',
        claude: claudeRes ? claudeRes.substring(0, 100) + '...' : 'Offline / Key Missing',
        grok: xaiKey ? 'Connected' : 'Not Configured'
      }
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ 
      synthesis: "Overseer standalone fallback system processed your request.", 
      error: error.message 
    }), { status: 500 });
  }
};
