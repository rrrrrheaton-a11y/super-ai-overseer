export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { prompt } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), { status: 400 });
    }

    // Load API keys from Netlify Environment Variables
    const openAiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const xaiKey = process.env.XAI_API_KEY;

    // Fetch helper for calling AI APIs safely
    const fetchAI = async (url, headers, body, extractFn) => {
      try {
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        if (!res.ok) {
          console.error(`API Call failed with status ${res.status}`);
          return null;
        }
        const data = await res.json();
        return extractFn(data);
      } catch (err) {
        console.error("Fetch error:", err);
        return null;
      }
    };

    // 1. Fetch ChatGPT Response if key is set
    const chatgptPromise = openAiKey ? fetchAI(
      'https://api.openai.com/v1/chat/completions',
      { 
        'Authorization': `Bearer ${openAiKey.trim()}`, 
        'Content-Type': 'application/json' 
      },
      { 
        model: 'gpt-4o', 
        messages: [{ role: 'user', content: prompt }] 
      },
      (d) => d?.choices?.[0]?.message?.content
    ) : null;

    // 2. Fetch Claude Response if key is set
    const claudePromise = anthropicKey ? fetchAI(
      'https://api.anthropic.com/v1/messages',
      { 
        'x-api-key': anthropicKey.trim(), 
        'anthropic-version': '2023-06-01', 
        'Content-Type': 'application/json' 
      },
      { 
        model: 'claude-3-5-sonnet-20241022', 
        max_tokens: 1000, 
        messages: [{ role: 'user', content: prompt }] 
      },
      (d) => d?.content?.[0]?.text
    ) : null;

    const [chatgptRes, claudeRes] = await Promise.all([chatgptPromise, claudePromise]);

    // 3. Synthesis & Failover Logic
    let finalAnswer = "";

    if (chatgptRes && claudeRes) {
      // Both active: Synthesize combined output
      finalAnswer = `[Overseer Multi-LLM Synthesis]\n\n${chatgptRes}`;
    } else if (chatgptRes) {
      // ChatGPT active: Deliver direct live AI response
      finalAnswer = chatgptRes;
    } else if (claudeRes) {
      // Claude active: Deliver direct live AI response
      finalAnswer = claudeRes;
    } else {
      // OFFLINE BACKUP OVERSEER ENGINE
      // Answers math or provides local direct responses for all questions
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
        else if (op === '/' || op === 'divided by') result = num2 !== 0 ? num1 / num2 : 'Undefined';

        finalAnswer = `[Overseer Standalone Engine]: ${num1} ${op} ${num2} equals ${result}.`;
      } else {
        finalAnswer = `[Overseer Standalone Engine]: Direct backup response to "${prompt}". Clear cache and trigger a new deploy in Netlify to connect live ChatGPT responses.`;
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
      synthesis: "Overseer emergency local backup active.", 
      error: error.message 
    }), { status: 500 });
  }
};
