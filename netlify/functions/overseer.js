export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { prompt } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), { status: 400 });
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const xaiKey = process.env.XAI_API_KEY;

    // Helper function to safely fetch from APIs with error handling / fallback
    const fetchAI = async (url, headers, body, extractFn, fallbackLabel) => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        return extractFn(data);
      } catch (err) {
        console.error(`${fallbackLabel} failed:`, err);
        return `[${fallbackLabel} was unavailable. Overseer backup activated.]`;
      }
    };

    // 1. ChatGPT (OpenAI) Call
    const chatgptPromise = openAiKey ? fetchAI(
      'https://api.openai.com/v1/chat/completions',
      { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
      { model: 'gpt-4o', messages: [{ role: 'user', content: prompt }] },
      (data) => data?.choices?.[0]?.message?.content,
      'ChatGPT'
    ) : Promise.resolve('[ChatGPT Key Missing]');

    // 2. Claude (Anthropic) Call
    const claudePromise = anthropicKey ? fetchAI(
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      { model: 'claude-3-5-sonnet-20241022', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] },
      (data) => data?.content?.[0]?.text,
      'Claude'
    ) : Promise.resolve('[Claude Key Missing]');

    // 3. Grok (xAI) Call
    const grokPromise = xaiKey ? fetchAI(
      'https://api.x.ai/v1/chat/completions',
      { 'Authorization': `Bearer ${xaiKey}`, 'Content-Type': 'application/json' },
      { model: 'grok-beta', messages: [{ role: 'user', content: prompt }] },
      (data) => data?.choices?.[0]?.message?.content,
      'Grok'
    ) : Promise.resolve('[Grok Key Missing]');

    // Execute all queries in parallel
    const [chatgptRes, claudeRes, grokRes] = await Promise.all([chatgptPromise, claudePromise, grokPromise]);

    // 4. Overseer Backup Synthesis
    // If OpenAI is active, use gpt-4o as Overseer. If OpenAI fails, deliver combined backup results directly.
    let finalSynthesis = "";
    
    if (openAiKey && !chatgptRes.includes("unavailable")) {
      const overseerRes = await fetchAI(
        'https://api.openai.com/v1/chat/completions',
        { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
        {
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'You are the Overseer AI. Review outputs from multiple AI models, extract the best information, discard contradictions, and present one clear, authoritative answer to the user.' },
            { role: 'user', content: `User Prompt: ${prompt}\n\nModel Insights:\n1. ChatGPT: ${chatgptRes}\n2. Claude: ${claudeRes}\n3. Grok: ${grokRes}` }
          ]
        },
        (data) => data?.choices?.[0]?.message?.content,
        'Overseer Primary Engine'
      );
      finalSynthesis = overseerRes;
    } else {
      // Direct Backup Mode if primary engine is down
      finalSynthesis = `[Overseer Backup Mode Active]\n\n${claudeRes !== '[Claude Key Missing]' ? claudeRes : grokRes}`;
    }

    return new Response(JSON.stringify({
      synthesis: finalSynthesis,
      breakdown: {
        chatgpt: chatgptRes.substring(0, 100) + '...',
        claude: claudeRes.substring(0, 100) + '...',
        grok: grokRes.substring(0, 100) + '...'
      }
    }), { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ 
      synthesis: "The Overseer emergency backup system processed your request. Please check API settings.",
      error: error.message 
    }), { status: 500 });
  }
};
