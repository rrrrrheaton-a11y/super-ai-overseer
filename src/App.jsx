import React, { useState, useEffect } from 'react';
import { Send, Sparkles, User, Shield, Zap, RefreshCw } from 'lucide-react';

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [dailyQuota, setDailyQuota] = useState(1);
  const [user, setUser] = useState({ name: 'Guest User', email: 'guest@superai.com', isPremium: false });
  const [authModal, setAuthModal] = useState(false);

  useEffect(() => {
    const lastReset = localStorage.getItem('last_reset');
    const today = new Date().toDateString();
    if (lastReset !== today) {
      localStorage.setItem('last_reset', today);
      localStorage.setItem('queries_used', '0');
      setDailyQuota(1);
    } else {
      const used = parseInt(localStorage.getItem('queries_used') || '0');
      setDailyQuota(1 - used);
    }
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    if (dailyQuota <= 0 && !user.isPremium) {
      alert("You have reached your 1 free daily query limit! Upgrade to Pro for unlimited access.");
      setAuthModal(true);
      return;
    }

    const userMsg = prompt;
    setPrompt('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const response = await fetch('/.netlify/functions/overseer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMsg })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.synthesis, 
          breakdown: data.breakdown 
        }]);
        
        if (!user.isPremium) {
          localStorage.setItem('queries_used', '1');
          setDailyQuota(0);
        }
      } else {
        throw new Error(data.error || 'Failed to fetch synthesis.');
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#131314] text-[#e3e3e3] font-sans">
      <div className="w-64 bg-[#1e1f20] p-4 flex flex-col justify-between hidden md:flex border-r border-[#2f3033]">
        <div>
          <div className="flex items-center gap-2 px-2 py-3 mb-4">
            <Sparkles className="text-blue-400 w-6 h-6" />
            <span className="font-bold text-lg tracking-wide text-white">SuperAI Nexus</span>
          </div>
          <button onClick={() => setMessages([])} className="w-full bg-[#282a2c] hover:bg-[#333538] text-sm text-left px-4 py-3 rounded-full mb-4 transition flex items-center gap-2 cursor-pointer">
            <RefreshCw className="w-4 h-4" /> New Session
          </button>
        </div>

        <div className="bg-[#282a2c] p-3 rounded-xl border border-[#3c4043]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Free Tier Account</span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-sm font-medium text-white mb-1">{dailyQuota} query remaining today</p>
          <button onClick={() => alert("Subscription options coming soon!")} className="w-full mt-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:opacity-90 text-white text-xs font-bold py-2 rounded-lg transition cursor-pointer">
            Upgrade to Pro ($19/mo)
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#131314]">
        <header className="h-14 border-b border-[#2f3033] flex items-center justify-between px-6 bg-[#131314]">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <span className="text-sm font-medium text-gray-300">Overseer Multi-LLM Engine active</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-[#282a2c] px-3 py-1.5 rounded-full text-gray-300 border border-[#3c4043]">
              {user.name}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-4xl mx-auto w-full">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center shadow-lg">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                What problem should the Overseer solve today?
              </h1>
              <p className="text-gray-400 max-w-md text-sm">
                Your prompt is processed across leading AI models. The Overseer merges their insights into one optimized response.
              </p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 mt-1">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className={`max-w-2xl rounded-2xl p-4 text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-[#282a2c] text-white rounded-br-none' 
                    : 'bg-[#1e1f20] border border-[#2f3033] text-gray-200 rounded-bl-none shadow-md'
                }`}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  
                  {msg.breakdown && (
                    <div className="mt-4 pt-3 border-t border-[#3c4043] text-xs text-gray-400 grid grid-cols-3 gap-2">
                      <div className="bg-[#131314] p-2 rounded border border-[#2f3033]">
                        <span className="font-bold text-blue-400 block mb-1">ChatGPT Insight</span>
                        <p className="truncate">{msg.breakdown.chatgpt}</p>
                      </div>
                      <div className="bg-[#131314] p-2 rounded border border-[#2f3033]">
                        <span className="font-bold text-purple-400 block mb-1">Claude Insight</span>
                        <p className="truncate">{msg.breakdown.claude}</p>
                      </div>
                      <div className="bg-[#131314] p-2 rounded border border-[#2f3033]">
                        <span className="font-bold text-amber-400 block mb-1">Grok Insight</span>
                        <p className="truncate">{msg.breakdown.grok}</p>
                      </div>
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0 mt-1">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            ))
          )}
          {loading && (
            <div className="flex gap-4 items-center">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center animate-pulse">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="text-sm text-gray-400 italic">Overseer is consulting ChatGPT, Claude, and Grok...</div>
            </div>
          )}
        </div>

        <div className="p-4 bg-[#131314] max-w-4xl mx-auto w-full">
          <form onSubmit={handleSend} className="relative bg-[#1e1f20] border border-[#3c4043] rounded-2xl flex items-center px-4 py-2 focus-within:border-blue-500 transition">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask the Super AI anything..."
              className="w-full bg-transparent border-none outline-none text-white placeholder-gray-500 text-sm py-2 pr-10"
            />
            <button type="submit" disabled={loading || !prompt.trim()} className="absolute right-3 p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl transition cursor-pointer">
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="text-center mt-2 text-[11px] text-gray-500">
            Super AI enforces a 1-query daily limit for free accounts.
          </div>
        </div>
      </div>
    </div>
  );
}
