import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, RefreshCw, Loader2, User, Bot } from 'lucide-react';
import {
  startDiagnosticChat,
  sendMessageStream,
  generateAnalysisReport,
  chatErrorMessage,
} from '../services/geminiService';
import { Message, AnalysisResult, TranscriptItem } from '../types';
import { INITIAL_GREETING } from '../constants';
import { Content } from '@google/genai';
import { MessageContent } from './MessageContent';

interface ChatInterfaceProps {
  onAnalysisComplete: (data: AnalysisResult) => void;
}

// Pair each model question with the user answer that follows it.
const buildTranscript = (history: Content[]): TranscriptItem[] => {
  const transcript: TranscriptItem[] = [];
  for (let i = 0; i < history.length; i++) {
    const item = history[i];
    const next = history[i + 1];
    if (item.role === 'model' && next && next.role === 'user') {
      const question = (item.parts?.[0]?.text ?? '').replace('[[ANALYSIS_COMPLETE]]', '').trim();
      const answer = (next.parts?.[0]?.text ?? '').trim();
      if (question && answer) {
        transcript.push({ question, answer });
      }
    }
  }
  return transcript;
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ onAnalysisComplete }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [initFailed, setInitFailed] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Raw history for the final report, plus a monotonic id source for messages
  // (never Date.now() - two calls in the same millisecond would collide and
  // React would drop a bubble on key collision).
  const historyRef = useRef<Content[]>([]);
  const msgIdRef = useRef(0);
  const nextId = () => `m${(msgIdRef.current += 1)}`;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGeneratingReport]);

  const initChat = useCallback(async () => {
    setIsLoading(true);
    setInitFailed(false);
    historyRef.current = [];
    try {
      await startDiagnosticChat();
      setMessages([{ id: 'greeting', role: 'model', content: INITIAL_GREETING }]);
      historyRef.current.push({ role: 'model', parts: [{ text: INITIAL_GREETING }] });
    } catch (error) {
      console.error('Failed to start chat', error);
      setInitFailed(true);
      setMessages([{ id: 'init-error', role: 'model', content: `⚠️ ${chatErrorMessage(error)}` }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initChat();
  }, [initChat]);

  const handleSend = async () => {
    const userText = input.trim();
    if (!userText || isLoading || isGeneratingReport || initFailed) return;

    const userMsg: Message = { id: nextId(), role: 'user', content: userText };
    const botMsg: Message = { id: nextId(), role: 'model', content: '' };

    // Add the user's message and the bot placeholder together so the user's
    // bubble can never be clobbered by a later update to the bot message.
    setMessages(prev => [...prev, userMsg, botMsg]);
    historyRef.current.push({ role: 'user', parts: [{ text: userText }] });
    setInput('');
    setIsLoading(true);

    const updateBot = (content: string) =>
      setMessages(prev => prev.map(m => (m.id === botMsg.id ? { ...m, content } : m)));

    try {
      const stream = await sendMessageStream(userText);

      let fullResponse = '';
      for await (const chunk of stream) {
        fullResponse += chunk.text || '';
        updateBot(fullResponse);
      }

      historyRef.current.push({ role: 'model', parts: [{ text: fullResponse }] });

      if (fullResponse.includes('[[ANALYSIS_COMPLETE]]')) {
        const cleanResponse = fullResponse.replace('[[ANALYSIS_COMPLETE]]', '').trim();
        updateBot(cleanResponse || 'Analysis complete. Generating your report...');

        setIsGeneratingReport(true);
        const report = await generateAnalysisReport(historyRef.current);
        report.transcript = buildTranscript(historyRef.current);
        onAnalysisComplete(report);
      }
    } catch (error) {
      console.error('Error sending message', error);
      // Stop the report spinner (if it was showing) and surface an accurate,
      // plain-text message in place of the bot bubble - never a blank screen.
      setIsGeneratingReport(false);
      updateBot(`⚠️ ${chatErrorMessage(error)}`);
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

  const inputDisabled = isLoading || isGeneratingReport || initFailed;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-900">
      {/* Chat Area */}
      <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6">
        {messages.map((msg) => {
          const showTypingDots =
            msg.role === 'model' && msg.content === '' && (isLoading || isGeneratingReport);

          return (
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
                  {showTypingDots ? (
                    <span className="flex items-center gap-1.5 py-1">
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </span>
                  ) : (
                    <MessageContent content={msg.content} />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {initFailed && (
          <div className="flex justify-start">
            <button
              onClick={initChat}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg transition-colors border border-slate-700"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
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
            placeholder={
              initFailed
                ? 'Diagnostic unavailable - use Retry above'
                : inputDisabled
                ? 'Please wait...'
                : 'Type your answer here...'
            }
            disabled={inputDisabled}
            className="w-full bg-slate-800 text-white placeholder-slate-400 border border-slate-700 rounded-xl pl-4 pr-20 py-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || inputDisabled}
            className="absolute right-2 top-2 bottom-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 flex items-center justify-center transition-colors disabled:bg-slate-700 disabled:text-slate-500"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
