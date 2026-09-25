
import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Trash2, Sparkles, StopCircle, Loader2, Terminal, Zap } from 'lucide-react';
import { AnalyzedHost, MalpediaActor, CveEntry } from '../../types';
import { createThreatChat } from '../../services/aiConverter';
import { Chat } from "@google/genai";

interface ChatViewProps {
    results: AnalyzedHost[];
    actors: MalpediaActor[];
    cveData: CveEntry[];
}

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: Date;
}

// Fixed "Cannot find namespace 'React'" error by adding React to imports
export const ChatView: React.FC<ChatViewProps> = ({ results, actors, cveData }) => {
    const [chatSession, setChatSession] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const initChat = () => {
            const criticalHosts = results.filter(r => r.riskLevel === 'CRITICAL');
            const topThreats = Array.from(new Set(results.flatMap(r => r.signatures.map(s => s.name)))).slice(0, 10).join(', ');
            
            const context = `
            SYSTEM STATUS REPORT:
            - Total Analyzed Hosts: ${results.length}
            - Critical Threats: ${criticalHosts.length}
            - Active Signatures Detected: ${topThreats || 'None'}
            KNOWLEDGE BASE:
            - Loaded Threat Actors: ${actors.length}
            - Loaded CVEs: ${cveData.length}
            `;

            const chat = createThreatChat(context);
            setChatSession(chat);
            setMessages([{
                id: 'init',
                role: 'model',
                text: `**Xyberah AI Online.**\n\nI have analyzed ${results.length} hosts and identified ${criticalHosts.length} critical threats.\n\nHow can I assist with your investigation?`,
                timestamp: new Date()
            }]);
        };

        initChat();
    }, [results, actors, cveData]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingText]);

    const handleSend = async () => {
        if (!input.trim() || !chatSession || isGenerating) return;

        const userMsg = input.trim();
        setInput('');
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', text: userMsg, timestamp: new Date() }]);
        setIsGenerating(true);
        setStreamingText('');

        try {
            const result = await chatSession.sendMessageStream({ message: userMsg });
            
            let fullText = '';
            for await (const chunk of result) {
                const text = chunk.text;
                if (text) {
                    fullText += text;
                    setStreamingText(fullText);
                }
            }

            setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: fullText, timestamp: new Date() }]);
        } catch (error) {
            console.error("Chat Error", error);
            setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'model', text: "Error generating response. System may be overloaded.", timestamp: new Date() }]);
        } finally {
            setIsGenerating(false);
            setStreamingText('');
        }
    };

    // Fixed "Cannot find namespace 'React'" error by adding React to imports
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatMessage = (text: string) => {
        const parts = text.split(/(```[\s\S]*?```|`[^`]+`|\*\*[^*]+\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('```')) {
                const content = part.replace(/^```\w*\n?|```$/g, '');
                return (
                    <div key={i} className="bg-black/50 border border-gray-700 rounded p-3 my-2 font-mono text-xs text-green-400 overflow-x-auto whitespace-pre">
                        {content}
                    </div>
                );
            } else if (part.startsWith('`')) {
                return <span key={i} className="bg-black/50 border border-gray-700 px-1.5 py-0.5 rounded font-mono text-xs text-yellow-400 mx-1">{part.replace(/`/g, '')}</span>;
            } else if (part.startsWith('**')) {
                return <strong key={i} className="text-white">{part.replace(/\*\*/g, '')}</strong>;
            }
            return <span key={i} className="whitespace-pre-wrap">{part}</span>;
        });
    };

    return (
        <div className="h-[calc(100vh-70px)] flex flex-col bg-cyber-grid relative">
            <div className="bg-black/40 border-b border-gray-800 p-4 flex items-center justify-between shrink-0 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-900/20 rounded-lg border border-purple-500/30 text-purple-400">
                        <Bot size={20}/>
                    </div>
                    <div>
                        <h2 className="text-white font-cyber font-bold text-lg leading-none flex items-center gap-2">
                            XYBERAH <span className="text-purple-400">AI ASSISTANT</span>
                        </h2>
                        <span className="text-[10px] text-gray-500 font-mono flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                            MODEL: GEMINI-3-FLASH
                        </span>
                    </div>
                </div>
                <button onClick={() => setMessages([])} className="p-2 text-gray-500 hover:text-red-400 transition-colors">
                    <Trash2 size={18}/>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-6">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'model' && (
                            <div className="w-8 h-8 rounded-full bg-purple-900/20 border border-purple-500/30 flex items-center justify-center shrink-0 mt-1">
                                <Bot size={16} className="text-purple-400"/>
                            </div>
                        )}
                        <div className={`max-w-[85%] md:max-w-[75%] rounded-lg p-4 text-sm leading-relaxed shadow-lg ${
                            msg.role === 'user' 
                                ? 'bg-cyber-cyan/10 border border-cyber-cyan/30 text-cyber-cyan rounded-tr-none' 
                                : 'bg-gray-900/80 border border-gray-800 text-gray-300 rounded-tl-none'
                        }`}>
                            {msg.role === 'user' ? (
                                <div className="whitespace-pre-wrap font-mono">{msg.text}</div>
                            ) : (
                                <div>{formatMessage(msg.text)}</div>
                            )}
                            <div className={`text-[9px] mt-2 opacity-50 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                                {msg.timestamp.toLocaleTimeString()}
                            </div>
                        </div>
                        {msg.role === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-cyber-cyan/20 border border-cyber-cyan/30 flex items-center justify-center shrink-0 mt-1">
                                <User size={16} className="text-cyber-cyan"/>
                            </div>
                        )}
                    </div>
                ))}
                {isGenerating && (
                    <div className="flex gap-4 justify-start">
                        <div className="w-8 h-8 rounded-full bg-purple-900/20 border border-purple-500/30 flex items-center justify-center shrink-0 mt-1 animate-pulse">
                            <Bot size={16} className="text-purple-400"/>
                        </div>
                        <div className="max-w-[85%] md:max-w-[75%] rounded-lg rounded-tl-none p-4 bg-gray-900/80 border border-gray-800 text-gray-300 text-sm leading-relaxed shadow-lg">
                            {streamingText ? (
                                <div>
                                    {formatMessage(streamingText)}
                                    <span className="inline-block w-2 h-4 bg-purple-500 ml-1 animate-pulse align-middle"></span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-xs text-purple-400 font-mono">
                                    <Loader2 size={14} className="animate-spin"/> Thinking...
                                </div>
                            )}
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="bg-black/60 border-t border-gray-800 p-4 backdrop-blur-md">
                <div className="max-w-4xl mx-auto relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask Xyberah AI about threats, IPs, or signatures..."
                        className="w-full bg-gray-900/50 border border-gray-700 rounded-xl pl-4 pr-14 py-3 text-sm text-gray-200 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 transition-all resize-none h-14 custom-scrollbar font-mono shadow-inner"
                    />
                    <button 
                        onClick={handleSend} 
                        disabled={isGenerating || !input.trim()}
                        className={`absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center rounded-lg transition-all ${
                            input.trim() && !isGenerating 
                                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20' 
                                : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        }`}
                    >
                        {isGenerating ? <StopCircle size={18}/> : <Send size={18}/>}
                    </button>
                </div>
                <div className="text-center mt-2">
                    <p className="text-[10px] text-gray-600 font-mono flex items-center justify-center gap-2">
                        <Sparkles size={10} className="text-purple-500"/>
                        AI responses are grounded in real-time threat intelligence.
                    </p>
                </div>
            </div>
        </div>
    );
};
