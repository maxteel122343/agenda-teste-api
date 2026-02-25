import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X, Volume2, VolumeX } from 'lucide-react';
import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { AudioService } from '../services/audioService';
import { cn } from '../lib/utils';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  audioPlaying?: boolean;
}

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
  systemInstruction: string;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ isOpen, onClose, systemInstruction }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioService = useRef(new AudioService());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (input.trim() === '' || isSending) return;

    const userMessage: ChatMessage = { id: Date.now().toString(), text: input, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview", // Using flash for general text chat
        config: { systemInstruction: systemInstruction },
      });

      const response: GenerateContentResponse = await chat.sendMessage({ message: input });
      const aiText = response.text || "Desculpe, não consegui gerar uma resposta.";

      const aiMessage: ChatMessage = { id: (Date.now() + 1).toString(), text: aiText, sender: 'ai' };
      setMessages(prev => [...prev, aiMessage]);

      // Convert AI text to speech and play
      const speechResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: aiText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }, // Using Kore for chat responses
          },
        },
      });

      const base64Audio = speechResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        setIsSpeaking(true);
        audioService.current.playAudioChunk(base64Audio, () => {
          setIsSpeaking(false);
        });
      }

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { id: Date.now().toString(), text: "Ocorreu um erro ao se comunicar com a Motiva.", sender: 'ai' }]);
    } finally {
      setIsSending(false);
    }
  };

  const toggleSpeech = () => {
    if (isSpeaking) {
      audioService.current.stop();
      setIsSpeaking(false);
    } else {
      // Replay last AI message if available
      const lastAiMessage = messages.slice().reverse().find(msg => msg.sender === 'ai');
      if (lastAiMessage) {
        // This would require re-generating speech or storing audio, for simplicity we'll just stop/start
        // For a real app, you'd store the audio or use a more advanced TTS playback system.
      }
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed bottom-24 right-8 w-96 h-[500px] bg-white rounded-2xl shadow-xl flex flex-col z-[100] border border-slate-100"
    >
      <div className="flex justify-between items-center p-4 border-b border-slate-100">
        <h3 className="font-display text-lg font-bold text-slate-900">Chat com Motiva</h3>
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleSpeech}
            className="p-2 rounded-full text-slate-500 hover:bg-slate-50 transition-colors"
            title={isSpeaking ? "Parar Fala" : "Reproduzir Fala"}
          >
            {isSpeaking ? <VolumeX className="w-5 h-5 text-red-500" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button 
            onClick={onClose}
            className="p-2 rounded-full text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.sender === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                "max-w-[70%] p-3 rounded-xl",
                message.sender === 'user'
                  ? 'bg-orange-500 text-white rounded-br-none'
                  : 'bg-slate-100 text-slate-800 rounded-bl-none'
              )}
            >
              <p className="text-sm font-body">{message.text}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-slate-100 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Converse com a Motiva..."
          className="flex-1 p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-body"
          disabled={isSending}
        />
        <button
          onClick={sendMessage}
          className="p-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"
          disabled={isSending}
        >
          {isSending ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </motion.div>
  );
};

export default ChatWindow;
