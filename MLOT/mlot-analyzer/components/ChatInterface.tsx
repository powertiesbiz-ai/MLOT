import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, User, Bot } from 'lucide-react';
import { startDiagnosticChat, sendMessageStream, generateAnalysisReport } from '../services/geminiService';
import { Message, AnalysisResult, TranscriptItem } from '../types';
import { INITIAL_GREETING } from '../constants';
import { Content } from '@google/genai';

interface ChatInterfaceProps {
  onAnalysisComplete: (data: AnalysisResult) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onAnalysisComplete }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // To store raw history for the report generation
  const historyRef = useRef<Content[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGeneratingReport]);

  // Initialize Chat
  useEffect(() => {
    const initChat = async () => {
      try {
        setIsLoading(true);
        await startDiagnosticChat();
        
        const initialMsg: Message = {
          id: 'init',
          role: 'model',
          content: INITIAL_GREETING
        };
        setMessages([initialMsg]);
        
        // Track history manually for the final report to ensure we have the exact structure needed
        historyRef.current.push({
          role: 'model',
          parts: [{ text: INITIAL_GREETING }]
        });
      } catch (error) {
        console.error("Failed to start chat", error);
      } finally {
        setIsLoading(false);
      }
    };

    initChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading || isGeneratingReport) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input
    };

    setMessages(prev => [...prev, userMsg]);
    historyRef.current.push({ role: 'user', parts: [{ text: input }] });
    setInput('');
    setIsLoading(true);

    const botMsgId = (Date.now() + 1).toString();

    try {
      // Add placeholder bot message
      setMessages(prev => [...prev, { id: botMsgId, role: 'model', content: '' }]);

      const stream = await sendMessageStream(input);
      
      let fullResponse = '';
      
      for await (const chunk of stream) {
        const text = chunk.text || '';
        fullResponse += text;
        
        setMessages(prev => prev.map(msg => 
          msg.id === botMsgId ? { ...msg, content: fullResponse } : msg
        ));
      }

      historyRef.current.push({ role: 'model', parts: [{ text: fullResponse }] });

      // Check for completion token
      if (fullResponse.includes('[[ANALYSIS_COMPLETE]]')) {
        // Clean response for UI
        const cleanResponse = fullResponse.replace('[[ANALYSIS_COMPLETE]]', '').trim();
         setMessages(prev => prev.map(msg => 
          msg.id === botMsgId ? { ...msg, content: cleanResponse || "Analysis Complete. Generating Report..." } : msg
        ));

        setIsGeneratingReport(true);
        const report = await generateAnalysisReport(historyRef.current);
        
        // Generate transcript
        const transcript: TranscriptItem[] = [];
        const history = historyRef.current;
        
        for (let i = 0; i < history.length; i++) {
          const item = history[i];
          // We pair a model question with the subsequent user answer
          if (item.role === 'model' && i + 1 < history.length && history[i+1].role === 'user') {
             let questionText = item.parts[0].text as string;
             const answerText = history[i+1].parts[0].text as string;
             
             // Clean up any system tokens from question text if present (though usually at end)
             questionText = questionText.replace('[[ANALYSIS_COMPLETE]]', '').trim();

             if (questionText && answerText) {
               transcript.push({
                 question: questionText,
                 answer: answerText
               });
             }
          }
        }
        report.transcript = transcript;

        onAnalysisComplete(report);
      }

    } catch (error: any) {
      console.error("Error sending message", error);
      
      let isQuotaError = false;
      
      const checkQuota = (err: any) => {
        if (!err) return false;
        
        // Check recursively for nested error object (common in Google APIs response bodies: {"error": {...}})
        if (err.error) {
            return checkQuota(err.error);
        }
        
        // Check direct status/code
        if (err.status === 429 || err.code === 429) return true;
        if (err.status === 'RESOURCE_EXHAUSTED') return true;

        // Check message string
        const msg = err.message;
        if (typeof msg === 'string' && (
            msg.includes('429') || 
            msg.toLowerCase().includes('quota') || 
            msg.includes('RESOURCE_EXHAUSTED')
        )) return true;

        return false;
      };

      isQuotaError = checkQuota(error);

      const errorMessage = isQuotaError 
        ? "⚠️ **System Alert:** I have reached my conversation limit (Quota Exceeded). Please wait a few minutes or check your plan and billing details."
        : "⚠️ **Connection Error:** I encountered an issue connecting to the server. Please check your internet connection and try again.";

      setMessages(prev => prev.map(msg => 
        msg.id === botMsgId ? { ...msg, content: errorMessage } : msg
      ));
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-900">
      {/* Chat Area */}
      <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[85%] sm:max-w-[75%] gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
                {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-white" />}
              </div>
              
              <div className={`p-4 rounded-2xl text-sm sm:text-base leading-relaxed shadow-md ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
              }`}>
                {msg.content.replace('[[ANALYSIS_COMPLETE]]', '').split('\n').map((line, i) => (
                  <p key={i} className="min-h-[1rem]">{line}</p>
                ))}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && !isGeneratingReport && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
          <div className="flex justify-start">
             <div className="flex max-w-[75%] gap-3">
               <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
                 <Bot className="w-5 h-5 text-white" />
               </div>
               <div className="bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-700 flex items-center gap-2">
                 <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                 <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                 <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
               </div>
             </div>
          </div>
        )}

        {isGeneratingReport && (
           <div className="flex flex-col items-center justify-center py-10 animate-pulse space-y-4">
             <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
             <p className="text-emerald-400 font-medium">Crunching the numbers and generating your Financial Leakage Report...</p>
           </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-slate-900 border-t border-slate-800 p-4">
        <div className="max-w-4xl mx-auto relative">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLoading || isGeneratingReport ? "Please wait..." : "Type your answer here..."}
            disabled={isLoading || isGeneratingReport}
            className="w-full bg-slate-800 text-white placeholder-slate-400 border border-slate-700 rounded-xl pl-4 pr-14 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading || isGeneratingReport}
            className="absolute right-2 top-2 bottom-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 flex items-center justify-center transition-colors disabled:bg-slate-700 disabled:text-slate-500"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};