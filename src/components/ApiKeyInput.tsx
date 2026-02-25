import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Loader2, Info } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { cn } from '../lib/utils';

interface ApiKeyInputProps {
  onApiKeyChange: (key: string | null) => void;
}

const LOCAL_STORAGE_KEY = 'gemini_api_key';

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ onApiKeyChange }) => {
  const [apiKey, setApiKey] = useState<string>(() => {
    // Initialize from localStorage or environment variable
    const storedKey = localStorage.getItem(LOCAL_STORAGE_KEY);
    return storedKey || process.env.GEMINI_API_KEY || '';
  });
  const [status, setStatus] = useState<'idle' | 'testing' | 'valid' | 'invalid'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(false);

  const testApiKey = async (key: string) => {
    if (!key) {
      setStatus('idle');
      setError(null);
      onApiKeyChange(null);
      return;
    }

    setStatus('testing');
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      // Make a simple call to verify the API key
      await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "test",
        config: { maxOutputTokens: 1 }, // Minimal output for quick test
      });
      setStatus('valid');
      localStorage.setItem(LOCAL_STORAGE_KEY, key);
      onApiKeyChange(key);
    } catch (e: any) {
      setStatus('invalid');
      setError(e.message || 'Erro desconhecido ao testar a chave API.');
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      onApiKeyChange(null);
    }
  };

  useEffect(() => {
    // Test API key on component mount if it exists
    if (apiKey) {
      testApiKey(apiKey);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    // Test immediately as user types, or debounce for performance
    testApiKey(newKey);
  };

  return (
    <div className="fixed top-4 right-4 z-[101]">
      <AnimatePresence>
        {!showInput && status !== 'valid' && ( // Show info icon if input is hidden and not valid
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setShowInput(true)}
            className="p-2 rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 transition-colors"
            title="Chave API inválida ou ausente. Clique para inserir."
          >
            <Info className="w-5 h-5" />
          </motion.button>
        )}

        {showInput && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="bg-white p-4 rounded-xl shadow-lg border border-slate-100 flex flex-col gap-3 w-80"
          >
            <div className="flex justify-between items-center">
              <h4 className="font-display text-md font-bold text-slate-900">Chave API Gemini</h4>
              <button onClick={() => setShowInput(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <input
              type="password"
              value={apiKey}
              onChange={handleInputChange}
              placeholder="Insira sua chave API..."
              className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-body"
            />

            <div className="flex items-center gap-2 text-sm font-medium">
              {status === 'testing' && (
                <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
              )}
              {status === 'valid' && (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              )}
              {status === 'invalid' && (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span
                className={cn(
                  status === 'valid' && 'text-green-600',
                  status === 'invalid' && 'text-red-600',
                  status === 'testing' && 'text-slate-600'
                )}
              >
                {status === 'testing' && 'Testando chave...'}
                {status === 'valid' && 'Chave API válida!'}
                {status === 'invalid' && 'Chave API inválida.'}
                {status === 'idle' && 'Insira sua chave API.'}
              </span>
            </div>
            {error && status === 'invalid' && (
              <p className="text-xs text-red-500 break-all">Erro: {error}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ApiKeyInput;
