import React, { useState, useEffect, useContext } from 'react';
import { DeSoIdentityContext } from 'react-deso-protocol';
import { ChatInterface } from './components/ChatInterface';
import { Dashboard } from './components/Dashboard';
import { DeSoAuth } from './components/DeSoAuth';
import { AnalysisResult } from './types';
import { Activity, DollarSign, ChevronRight, FileText } from 'lucide-react';

enum AppState {
  INTRO,
  DIAGNOSTIC,
  ANALYZING,
  RESULTS
}

export default function App() {
  const [currentState, setCurrentState] = useState<AppState>(AppState.INTRO);
  const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);

  // The diagnostic is gated behind a DeSo login.
  const { currentUser } = useContext(DeSoIdentityContext);

  const handleStartDiagnostic = () => {
    if (!currentUser) return;
    setCurrentState(AppState.DIAGNOSTIC);
  };

  const handleAnalysisComplete = (data: AnalysisResult) => {
    setAnalysisData(data);
    setCurrentState(AppState.RESULTS);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400">
            <Activity className="w-6 h-6" />
            <span className="font-bold text-xl tracking-tight text-white">MLOT <span className="text-slate-400 font-normal">Analyzer</span></span>
          </div>
          <div className="text-sm text-slate-400 hidden sm:block">
            Money Left On the Table Diagnostic Tool
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex flex-col">
        {currentState === AppState.INTRO && (
          <div className="flex-grow flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-slate-900 to-slate-800">
            <div className="max-w-2xl space-y-8 animate-fade-in">
              <div className="inline-flex items-center justify-center p-4 bg-emerald-500/10 rounded-full mb-4 ring-1 ring-emerald-500/30 shadow-[0_0_30px_-5px_rgba(16,185,129,0.3)]">
                <DollarSign className="w-12 h-12 text-emerald-400" />
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
                How much money are you <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">leaving on the table?</span>
              </h1>
              <p className="text-lg text-slate-300 max-w-xl mx-auto leading-relaxed">
                Discover financial leakage in your leadership, culture, processes, and sales. 
                Our AI consultant will guide you through a deep-dive diagnostic to uncover lost revenue and provide actionable solutions.
              </p>
              
              <div className="pt-4 flex flex-col items-center gap-4">
                <button
                  onClick={handleStartDiagnostic}
                  disabled={!currentUser}
                  className="group relative inline-flex items-center gap-3 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold py-4 px-8 rounded-xl transition-all duration-200 shadow-lg shadow-emerald-900/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-500 disabled:hover:shadow-lg disabled:hover:translate-y-0"
                >
                  Start Diagnostic Analysis
                  <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </button>
                {!currentUser && (
                  <p className="text-sm text-slate-400">Log in with DeSo to begin.</p>
                )}
                <DeSoAuth />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-12 text-left text-sm text-slate-400">
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <strong className="block text-slate-200 mb-1">7-Point Analysis</strong>
                  From leadership alignment to revenue collection gaps.
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <strong className="block text-slate-200 mb-1">Instant Estimation</strong>
                  Real-time calculation of annual financial leakage.
                </div>
                <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <strong className="block text-slate-200 mb-1">Download a Report</strong>
                  Actionable roadmap and "Business In A Box" solutions.
                </div>
              </div>
            </div>
          </div>
        )}

        {currentState === AppState.DIAGNOSTIC && (
          <ChatInterface onAnalysisComplete={handleAnalysisComplete} />
        )}

        {currentState === AppState.RESULTS && analysisData && (
          <Dashboard data={analysisData} onRestart={() => setCurrentState(AppState.INTRO)} />
        )}
      </main>

      <footer className="bg-slate-950 py-6 border-t border-slate-900 text-center text-slate-500 text-sm no-print">
        <p>&copy; {new Date().getFullYear()} MLOT Analyzer. Powered by Gemini.</p>
      </footer>
    </div>
  );
}