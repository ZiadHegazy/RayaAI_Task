import React, { useState, useEffect, useRef } from 'react';
import "./App.css"
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = (endpoint, { headers, ...rest } = {}) => fetch(endpoint, {
  headers: { 'Content-Type': 'application/json', ...headers },
  ...rest
}).then(res => res.json());

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login'); 

  useEffect(() => {
    if (user) {
      setView(user.role === 'admin' ? 'admin' : 'chat');
    }
  }, [user]);

  if (!user) return <Login setUser={setUser} />;
  
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col selection:bg-indigo-200">
      <nav className="bg-white/70 backdrop-blur-md border-b border-slate-200 shadow-sm sticky top-0 z-50 p-4 flex justify-between items-center transition-all">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 shadow-md flex items-center justify-center text-white font-bold text-lg">T</div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">Telecom AI Support</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('chat')} className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'chat' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}>Chat</button>
          {user.role === 'admin' && <button onClick={() => setView('admin')} className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'admin' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}>Admin</button>}
          {user.role === 'admin' && <button onClick={() => setView('logs')} className={`px-4 py-2 rounded-lg font-medium transition-all ${view === 'logs' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}>Logs</button>}
          <button onClick={() => { setUser(null); setView('login'); }} className="px-4 py-2 rounded-lg font-medium text-rose-600 hover:bg-rose-50 transition-all ml-2">Logout</button>
        </div>
      </nav>
      
      <div className="flex-1 p-6 flex justify-center items-start">
        {view === 'chat' && <ChatView customerId={user.customer_id} token={user.token} />}
        {view === 'admin' && <AdminView token={user.token} />}
        {view === 'logs' && <LogsView token={user.token} />}
      </div>
    </div>
  );
}

function Login({ setUser }) {
  const [username, setUsername] = useState('user1');
  const [password, setPassword] = useState('password');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await api('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      if (res.token) setUser({ token: res.token, role: res.role, customer_id: res.customer_id });
      else alert('Login failed: Invalid credentials');
    } catch (e) {
      alert('Login failed: Server error');
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900 via-slate-900 to-black p-4">
      <div className="bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl shadow-indigo-500/20 w-full max-w-sm transition-all hover:border-white/30">
        <div className="mb-8 text-center">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-500 to-violet-500 rounded-2xl shadow-lg flex items-center justify-center mb-4">
            <span className="text-3xl text-white">✨</span>
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Welcome Back</h2>
          <p className="text-indigo-200 mt-2 text-sm">Sign in to your telecom dashboard</p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-indigo-200 uppercase tracking-wider mb-2">Username</label>
            <input className="w-full bg-black/20 border border-white/10 text-white placeholder-white/40 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="Enter username" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-indigo-200 uppercase tracking-wider mb-2">Password</label>
            <input className="w-full bg-black/20 border border-white/10 text-white placeholder-white/40 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          <button onClick={handleLogin} disabled={loading} className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-600/30 transform transition-all active:scale-95 disabled:opacity-70 flex justify-center items-center">
            {loading ? <span className="animate-pulse">Authenticating...</span> : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatView({ customerId, token }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    api('/api/history', { headers: { 'Authorization': `Bearer ${token}` } }).then(history => {
      if (history.length) setMessages(history);
    });
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const newMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api('/api/chat', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: input, history: messages, customer_id: customerId, pending_action: pendingAction })

      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.response }]);
      setPendingAction(res.pending_action ?? null);

    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, a network error occurred. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-3xl bg-white border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/50 h-[85vh] flex flex-col overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold shadow-sm">AI</div>
          <div>
            <h3 className="font-bold text-slate-800">Support Assistant</h3>
            <p className="text-xs text-slate-500">Always online to help you</p>
          </div>
        </div>
        <button onClick={async () => {
          if (confirm('Clear chat history?')) {
            await api('/api/history', { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            setMessages([]);
            setPendingAction(null);

          }
        }} className="text-xs font-semibold text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200 transition-all">Clear Chat</button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-2xl shadow-sm">👋</div>
            <p>Send a message to start chatting</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`px-5 py-3.5 rounded-2xl max-w-[80%] text-[15px] leading-relaxed shadow-sm transition-all ${msg.role === 'user' ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 px-5 py-4 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-5 bg-white border-t border-slate-100">
        <div className="flex items-center gap-3">
          <input className="flex-1 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-slate-700 px-5 py-3.5 rounded-xl transition-all outline-none" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Ask about your package, data, or policies..." />
          <button onClick={sendMessage} disabled={!input.trim() || loading} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white p-3.5 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminView({ token }) {
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState('pdf');
  const [sourceName, setSourceName] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const loadData = () => {
    api('/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } }).then(setUsers); 
    api('/api/admin/tickets', { headers: { 'Authorization': `Bearer ${token}` } }).then(setTickets);
  };

  useEffect(() => { loadData(); }, []);

  const handleUpload = async () => {
    if (!selectedFile || !sourceName.trim()) {
      alert('Please select a file and provide a source name.');
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('source', sourceName.trim());
    try {
      await fetch('/api/admin/upload-doc', { method: 'POST', body: formData, headers: { 'Authorization': `Bearer ${token}` } });
      alert('Document processed and added to Knowledge Base!');
      setSourceName('');
      setSelectedFile(null);
    } catch (err) {
      alert('Failed to upload document');
    }
    setUploading(false);
  };

  const handleAddText = async () => {
    if (!textContent.trim() || !sourceName.trim()) {
      alert('Please provide both a source name and text content.');
      return;
    }
    setUploading(true);
    try {
      await fetch('/api/admin/add-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ source: sourceName.trim(), content: textContent })
      });
      alert('Text processed and added to Knowledge Base!');
      setSourceName('');
      setTextContent('');
    } catch (err) {
      alert('Failed to add text');
    }
    setUploading(false);
  };

  return (
    <div className="w-full max-w-5xl space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800">Admin Dashboard</h2>
        <button onClick={loadData} className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-semibold transition-all shadow-sm">
          Refresh Data
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="md:col-span-1 bg-white border border-slate-200 p-8 rounded-3xl shadow-lg shadow-slate-200/50 relative overflow-hidden group hover:shadow-xl transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
          <div className="flex justify-between items-start mb-2 relative z-10">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Knowledge Base</h2>
              <p className="text-slate-500 text-sm mt-1">Add documents to train the AI assistant.</p>
            </div>
            <button onClick={async () => {
              if (confirm('Are you sure you want to clear the entire knowledge base? This action cannot be undone.')) {
                try {
                  await api('/api/admin/knowledge-base', { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                  alert('Knowledge base cleared successfully.');
                } catch (e) {
                  alert('Failed to clear knowledge base.');
                }
              }
            }} className="text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200 transition-all">
              Clear KB
            </button>
          </div>
          
          <div className="flex gap-2 mb-4 mt-4 relative z-10">
            <button onClick={() => setTab('pdf')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${tab === 'pdf' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>PDF</button>
            <button onClick={() => setTab('text')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${tab === 'text' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}>Text</button>
          </div>

          <div className="space-y-4 relative z-10">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Source Name</label>
              <input className="w-full bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm" placeholder="e.g. 2024 Refund Policy" value={sourceName} onChange={e => setSourceName(e.target.value)} />
            </div>

            {tab === 'pdf' ? (
              <div className="space-y-3">
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-indigo-200 border-dashed rounded-2xl cursor-pointer bg-indigo-50/50 hover:bg-indigo-50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-8 h-8 mb-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                    <p className="mb-1 text-sm text-indigo-600 font-semibold">{selectedFile ? selectedFile.name : 'Click to select PDF'}</p>
                  </div>
                  <input type="file" accept=".pdf" onChange={e => setSelectedFile(e.target.files[0])} className="hidden" disabled={uploading} />
                </label>
                <button onClick={handleUpload} disabled={uploading || !selectedFile || !sourceName.trim()} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold py-2 rounded-xl shadow-md transition-all text-sm">
                  {uploading ? 'Uploading...' : 'Upload PDF Document'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea className="w-full h-32 bg-slate-50 border border-slate-200 text-slate-700 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm resize-none" placeholder="Paste policy text here..." value={textContent} onChange={e => setTextContent(e.target.value)} />
                <button onClick={handleAddText} disabled={uploading || !textContent.trim() || !sourceName.trim()} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold py-2 rounded-xl shadow-md transition-all text-sm">
                  {uploading ? 'Saving...' : 'Add Text Document'}
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="md:col-span-2 bg-white border border-slate-200 p-8 rounded-3xl shadow-lg shadow-slate-200/50 hover:shadow-xl transition-all">
          <div className="flex justify-between items-end mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Customer Database</h2>
              <p className="text-slate-500 text-sm mt-1">Overview of all active subscribers</p>
            </div>
            <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold tracking-wide">
              {users.length} Total
            </div>
          </div>
          
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Username</th>
                  <th className="px-6 py-4">Package</th>
                  <th className="px-6 py-4 text-right">Data Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">@{u.username}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium border border-slate-200">{u.package}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-semibold ${u.balance < 5 ? 'text-rose-500' : 'text-emerald-600'}`}>{u.balance} GB</span>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="3" className="px-6 py-8 text-center text-slate-500">No users found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Support Tickets Section */}
      <div className="bg-white border border-slate-200 p-8 rounded-3xl shadow-lg shadow-slate-200/50 hover:shadow-xl transition-all">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Support Tickets</h2>
            <p className="text-slate-500 text-sm mt-1">Manage customer issues</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={async () => {
              if (confirm('Are you sure you want to delete all tickets?')) {
                await api('/api/admin/tickets', { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                loadData();
              }
            }} className="text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200 transition-all">
              Clear All Tickets
            </button>
            <div className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-xs font-bold tracking-wide">
              {tickets.length} Total
            </div>
          </div>
        </div>
        
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Ticket ID</th>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Issue Description</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((t, i) => (
                <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-bold text-indigo-600">{t.ticket_id}</td>
                  <td className="px-6 py-4 font-medium text-slate-800">@{t.username}</td>
                  <td className="px-6 py-4 text-slate-600 truncate max-w-xs">{t.issue_description}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${t.status === 'Open' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>{t.status}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{new Date(t.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500">No support tickets found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Event badge colours ──────────────────────────────────────────────────────
const EVENT_STYLE = {
  REQUEST_START: 'bg-slate-700 text-slate-200',
  REQUEST_END:   'bg-emerald-900 text-emerald-300',
  ENTER:         'bg-indigo-900 text-indigo-300',
  LLM_RESPONSE:  'bg-blue-900 text-blue-300',
  ROUTE:         'bg-cyan-900 text-cyan-300',
  TOOL_CALL:     'bg-violet-900 text-violet-300',
  TOOL_RESULT:   'bg-yellow-900 text-yellow-300',
  TOOL_ERROR:    'bg-red-900 text-red-300',
  CONFIRM_STATE: 'bg-orange-900 text-orange-300',
  CONFIRM_GUARD: 'bg-red-900 text-red-300',
  RAG_QUERY:     'bg-purple-900 text-purple-300',
  RAG_SCORES:    'bg-purple-900 text-purple-200',
  RAG_RESULT:    'bg-pink-900 text-pink-300',
  RAG_ERROR:     'bg-red-900 text-red-300',
  LOOP_CAP:      'bg-red-900 text-red-400',
};

function LogsView({ token }) {
  const [traces, setTraces] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadLogs = async () => {
    try {
      const data = await api('/api/admin/logs', { headers: { 'Authorization': `Bearer ${token}` } });
      if (Array.isArray(data)) setTraces(data);
    } catch (e) { console.error('Failed to load logs', e); }
  };

  const clearLogs = async () => {
    if (!confirm('Clear all log traces?')) return;
    await api('/api/admin/logs', { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    setTraces([]);
  };

  useEffect(() => { loadLogs(); }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(loadLogs, 5000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const toggle = (rid) => setExpanded(prev => ({ ...prev, [rid]: !prev[rid] }));

  return (
    <div className="w-full max-w-5xl space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center bg-slate-900 p-4 rounded-2xl border border-slate-700">
        <div>
          <h2 className="text-lg font-bold text-white">Orchestration Logs</h2>
          <p className="text-slate-400 text-xs mt-0.5">Last 50 completed request traces · complements Langfuse LLM tracing</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(p => !p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              autoRefresh ? 'bg-emerald-900 border-emerald-700 text-emerald-300' : 'bg-slate-800 border-slate-600 text-slate-400'
            }`}
          >
            {autoRefresh ? '⏱ Auto-refresh ON' : '⏸ Auto-refresh OFF'}
          </button>
          <button onClick={loadLogs} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 transition-all">
            ↻ Refresh
          </button>
          <button onClick={clearLogs} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-950 border border-red-800 text-red-400 hover:bg-red-900 transition-all">
            Clear
          </button>
        </div>
      </div>

      {/* Event Legend */}
      <details className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden group">
        <summary className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-slate-800 transition-colors list-none">
          <span className="text-slate-300 text-sm font-semibold">Event Legend</span>
          <span className="text-slate-500 text-xs group-open:hidden">▼ show</span>
          <span className="text-slate-500 text-xs hidden group-open:inline">▲ hide</span>
        </summary>
        <div className="border-t border-slate-800 px-5 py-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
            {[
              { event: 'REQUEST_START', desc: 'Chat request received by API' },
              { event: 'REQUEST_END',   desc: 'Request complete — shows total duration & step count' },
              { event: 'ENTER',         desc: 'Agent node entered — LLM is about to be called' },
              { event: 'LLM_RESPONSE',  desc: 'LLM replied — tool calls decided or final answer ready' },
              { event: 'ROUTE',         desc: 'Router decided: go to tools, or end the graph' },
              { event: 'TOOL_CALL',     desc: 'A tool was invoked with these arguments' },
              { event: 'TOOL_RESULT',   desc: 'Tool returned this observation to the agent' },
              { event: 'TOOL_ERROR',    desc: 'Tool threw an exception' },
              { event: 'CONFIRM_STATE', desc: 'pending_action state before → after this tool call' },
              { event: 'CONFIRM_GUARD', desc: 'confirmed=True rejected — no matching pending_action' },
              { event: 'RAG_QUERY',     desc: 'Knowledge base search query' },
              { event: 'RAG_SCORES',    desc: 'Cosine distances for each candidate doc (lower = better)' },
              { event: 'RAG_RESULT',    desc: 'Docs that passed the 0.5 threshold and were returned' },
              { event: 'RAG_ERROR',     desc: 'Vector store connection error' },
              { event: 'LOOP_CAP',      desc: 'Step count exceeded 6 — fallback message returned' },
            ].map(({ event, desc }) => {
              const badge = EVENT_STYLE[event] || 'bg-slate-800 text-slate-300';
              return (
                <div key={event} className="flex items-start gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${badge}`}>{event}</span>
                  <span className="text-slate-400 leading-tight">{desc}</span>
                </div>
              );
            })}
          </div>
        </div>
      </details>

      {traces.length === 0 && (
        <div className="bg-slate-900 rounded-2xl border border-slate-700 p-12 text-center text-slate-500">
          No traces yet — send a chat message to generate one.
        </div>
      )}

      {traces.map((trace) => {
        const isOpen = expanded[trace.request_id];
        const endStep = trace.steps.find(s => s.event === 'REQUEST_END');
        const startStep = trace.steps.find(s => s.event === 'REQUEST_START');
        const durationMs = endStep?.data?.duration_ms;
        const steps = endStep?.data?.steps;
        const message = startStep?.data?.message || '';
        const toolsUsed = [...new Set(trace.steps.filter(s => s.event === 'TOOL_CALL').map(s => s.data?.tool))];
        const hasError = trace.steps.some(s => ['TOOL_ERROR','LOOP_CAP','RAG_ERROR','CONFIRM_GUARD'].includes(s.event));

        return (
          <div key={trace.request_id} className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
            {/* Trace header — always visible */}
            <button
              onClick={() => toggle(trace.request_id)}
              className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-slate-800 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${hasError ? 'bg-red-400' : 'bg-emerald-400'}`} />
                <span className="font-mono text-xs text-slate-500 flex-shrink-0">{trace.request_id}</span>
                <span className="text-slate-300 text-sm truncate">{message}</span>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                {toolsUsed.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {toolsUsed.map(t => (
                      <span key={t} className="text-[10px] px-2 py-0.5 bg-violet-900 text-violet-300 rounded-full">{t}</span>
                    ))}
                  </div>
                )}
                {durationMs != null && <span className="text-xs text-slate-400">{durationMs}ms</span>}
                {steps != null && <span className="text-xs text-slate-500">{steps} steps</span>}
                <span className="text-slate-500 ml-1">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {/* Trace steps — collapsible */}
            {isOpen && (
              <div className="border-t border-slate-800 p-4 space-y-1.5 font-mono text-xs overflow-x-auto">
                {trace.steps.map((step, i) => {
                  const badge = EVENT_STYLE[step.event] || 'bg-slate-800 text-slate-300';
                  const time = step.ts ? new Date(step.ts).toLocaleTimeString() : '';
                  return (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="text-slate-600 w-20 flex-shrink-0">{time}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 w-36 text-center ${badge}`}>{step.event}</span>
                      <span className="text-slate-500 w-24 flex-shrink-0">[{step.component}]</span>
                      <span className="text-slate-300 break-all">{JSON.stringify(step.data)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}