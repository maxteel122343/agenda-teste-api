import React, { useState, useEffect, useRef, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  MicOff, 
  Plus, 
  Clock, 
  Trash2, 
  Sparkles, 
  CheckCircle2,
  Volume2,
  Settings,
  Tag,
  Palette,
  Pencil,
  FileText,
  Calendar,
  Monitor,
  Circle,
  Video,
  Layout,
  Search,
  ChevronRight,
  Maximize2,
  Share2,
  Heart,
  Square,
  MessageSquare,
  List,
  LogOut,
  User,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  AlertCircle
} from 'lucide-react';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Task } from './types';
import { AudioService } from './services/audioService';
import { cn } from './lib/utils';

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-red-100 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-500 w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Ops! Algo deu errado.</h1>
            <p className="text-slate-500 mb-6">
              Ocorreu um erro inesperado na aplicação. Tente recarregar a página.
            </p>
            <pre className="bg-slate-50 p-4 rounded-xl text-xs text-red-600 overflow-auto text-left mb-6 max-h-40">
              {this.state.error?.message}
            </pre>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const SYSTEM_INSTRUCTION = `Você é a "Motiva", uma assistente de produtividade extremamente engraçada, sarcástica e motivadora. 
Sua voz deve soar feminina e cheia de energia. 
Seu objetivo é ajudar o usuário a criar tarefas no canvas. 
Quando o usuário pedir para criar uma tarefa, você DEVE usar a ferramenta 'create_task'.
Seja criativa nas respostas! Se ele pedir algo de 20 minutos, diga algo como "20 minutos? Dá pra salvar o mundo ou pelo menos lavar a louça, vamos lá campeão!".
Sempre fale em Português do Brasil.`;

function MotivaApp() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const audioService = useRef(new AudioService());
  const sessionRef = useRef<any>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const addTask = useCallback((title: string, duration: number) => {
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      duration,
      createdAt: Date.now(),
      x: window.innerWidth / 2 - 150 - pan.x,
      y: window.innerHeight / 2 - 100 - pan.y,
    };
    setTasks(prev => [...prev, newTask]);
  }, [pan]);

  const updateTaskPos = (id: string, x: number, y: number) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, x, y } : t));
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const connectLive = async () => {
    if (isConnected) {
      try {
        sessionRef.current?.close();
      } catch (e) {
        console.warn("Error closing session:", e);
      }
      audioService.current.stop();
      setIsConnected(false);
      return;
    }

    setIsConnecting(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY não encontrada no ambiente.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: [{
            functionDeclarations: [{
              name: "create_task",
              description: "Cria um novo card de tarefa com título e duração.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "O título ou descrição da tarefa." },
                  duration: { type: Type.NUMBER, description: "A duração da tarefa em minutos." }
                },
                required: ["title", "duration"]
              }
            }]
          }]
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            audioService.current.start((base64) => {
              if (sessionRef.current) {
                sessionRef.current.sendRealtimeInput({
                  media: { data: base64, mimeType: 'audio/pcm;rate=16000' }
                });
              }
            }).catch(err => {
              console.error("Microphone error:", err);
              setIsConnected(false);
              setIsConnecting(false);
            });
          },
          onmessage: async (message) => {
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData) {
                  audioService.current.playAudioChunk(part.inlineData.data);
                }
              }
            }

            if (message.toolCall) {
              for (const call of message.toolCall.functionCalls) {
                if (call.name === "create_task") {
                  const { title, duration } = call.args as any;
                  addTask(title, duration);
                  session.sendToolResponse({
                    functionResponses: [{
                      name: "create_task",
                      id: call.id,
                      response: { success: true }
                    }]
                  });
                }
              }
            }
          },
          onclose: () => {
            setIsConnected(false);
            audioService.current.stop();
          },
          onerror: (err) => {
            console.error("Live Error:", err);
            setIsConnected(false);
            setIsConnecting(false);
          }
        }
      });

      sessionRef.current = session;
    } catch (error) {
      console.error("Connection failed:", error);
      setIsConnecting(false);
      alert("Falha ao conectar com a IA. Verifique seu microfone e conexão.");
    }
  };

  return (
    <div className="relative w-screen h-screen bg-[#FDFCFB] overflow-hidden flex">
      {/* Sidebar */}
      <aside className="w-[60px] h-full bg-[#333] flex flex-col items-center py-4 gap-4 z-50">
        <div className="w-10 h-10 bg-slate-600 rounded-lg flex items-center justify-center text-white cursor-pointer hover:bg-slate-500 transition-colors">
          <Square className="w-5 h-5" />
        </div>
        <div className="w-10 h-10 bg-[#9333ea] rounded-lg flex items-center justify-center text-white cursor-pointer hover:opacity-90 transition-opacity">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div className="w-10 h-10 bg-slate-600 rounded-lg flex items-center justify-center text-white cursor-pointer hover:bg-slate-500 transition-colors">
          <List className="w-5 h-5" />
        </div>
        <div className="w-10 h-10 bg-[#10b981] rounded-lg flex items-center justify-center text-white cursor-pointer hover:opacity-90 transition-opacity">
          <Calendar className="w-5 h-5" />
        </div>
        <div className="mt-auto flex flex-col gap-4">
          <div className="w-10 h-10 bg-[#2563eb] rounded-lg flex items-center justify-center text-white cursor-pointer">
            <LogOut className="w-5 h-5 rotate-180" />
          </div>
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-slate-900 cursor-pointer">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-white cursor-pointer">
            <List className="w-5 h-5" />
          </div>
          <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-white cursor-pointer">
            <Settings className="w-5 h-5" />
          </div>
          <div className="w-10 h-10 bg-[#9333ea] rounded-lg flex items-center justify-center text-white cursor-pointer">
            <User className="w-5 h-5" />
          </div>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Top Search Bar */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-md">
          <div className="bg-white rounded-full shadow-lg border border-slate-100 flex items-center px-6 py-3">
            <input 
              type="text" 
              placeholder="Buscar por tags ou título..." 
              className="flex-1 bg-transparent border-none outline-none text-slate-600 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Floating Toolbar */}
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-white rounded-xl shadow-lg border border-slate-100 flex items-center gap-1 p-1">
            {[Settings, Tag, Palette, Pencil, FileText, Calendar, Monitor, Mic, Circle, Video, Layout, Trash2].map((Icon, i) => (
              <button 
                key={i}
                onClick={Icon === Mic ? connectLive : undefined}
                className={cn(
                  "p-2 rounded-lg hover:bg-slate-50 transition-colors",
                  Icon === Mic && isConnected && "text-red-500 bg-red-50",
                  Icon === Mic && isConnecting && "animate-pulse"
                )}
              >
                <Icon className="w-5 h-5 text-slate-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <motion.div 
          ref={canvasRef}
          drag
          dragConstraints={{ left: -2000, right: 2000, top: -2000, bottom: 2000 }}
          onDrag={(e, info) => setPan({ x: info.point.x, y: info.point.y })}
          className="absolute inset-0 canvas-grid cursor-grab active:cursor-grabbing"
          style={{ 
            x: pan.x, 
            y: pan.y,
            scale: zoom
          }}
        >
          <AnimatePresence>
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                drag
                dragMomentum={false}
                onDragEnd={(e, info) => updateTaskPos(task.id, task.x + info.offset.x, task.y + info.offset.y)}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={cn(
                  "absolute w-[300px] bg-white rounded-2xl shadow-xl border-2 transition-colors cursor-default",
                  task.duration === 5 ? "border-yellow-400" : "border-slate-100"
                )}
                style={{ left: task.x, top: task.y }}
              >
                {/* Card Header */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                      {String(Math.floor(task.duration)).padStart(2, '0')}:00
                    </span>
                    {task.duration === 5 && (
                      <span className="text-[10px] font-mono font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded flex items-center gap-1">
                        <Circle className="w-2 h-2 fill-current" /> +00:03
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Share2 className="w-3 h-3 text-slate-300" />
                    <Maximize2 className="w-3 h-3 text-slate-300" />
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 min-h-[150px]">
                  <h3 className="text-lg font-display font-bold text-slate-800 mb-2">
                    {task.title}
                  </h3>
                  <p className="text-slate-400 text-sm italic">
                    Digite algo aqui...
                  </p>
                </div>

                {/* Card Footer */}
                <div className="absolute bottom-4 right-4">
                  <Plus className="w-4 h-4 text-slate-200" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Bottom Toolbar */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-white/90 backdrop-blur rounded-full shadow-lg border border-slate-100 flex items-center gap-4 px-6 py-3">
            <div className="flex items-center gap-2 pr-4 border-r border-slate-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="text-xs font-bold text-slate-400">0</span>
            </div>
            <div className="flex items-center gap-2 pr-4 border-r border-slate-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-bold text-slate-400">0</span>
            </div>
            <div className="flex items-center gap-2 pr-4 border-r border-slate-100">
              <AlertCircle className="w-5 h-5 text-orange-400" />
              <span className="text-xs font-bold text-slate-400">0</span>
            </div>
            <div className="flex items-center gap-4">
              <Volume2 className="w-5 h-5 text-slate-300" />
              <Trash2 className="w-5 h-5 text-red-400" />
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <ChevronRight className="w-5 h-5 text-blue-500" />
              </div>
              <Clock className="w-5 h-5 text-yellow-500" />
              <Sparkles className="w-5 h-5 text-orange-400" />
            </div>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="absolute bottom-8 left-8 z-40 flex flex-col gap-2">
          <button 
            onClick={() => setZoom(z => Math.min(z + 0.1, 2))}
            className="w-10 h-10 bg-white rounded-xl shadow-lg border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <div className="bg-white px-2 py-1 rounded-lg shadow-lg border border-slate-100 text-[10px] font-bold text-slate-400 text-center">
            {Math.round(zoom * 100)}%
          </div>
          <button 
            onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))}
            className="w-10 h-10 bg-white rounded-xl shadow-lg border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
        </div>

        {/* Fullscreen Toggle */}
        <div className="absolute bottom-8 right-8 z-40">
          <button className="w-10 h-10 bg-white rounded-xl shadow-lg border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600">
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>

        {/* Helper Text */}
        <div className="absolute bottom-2 right-1/2 translate-x-1/2 text-[10px] text-slate-400 font-medium whitespace-nowrap">
          Click the circle node to connect cards • Double-click card to edit • Scroll to Zoom
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MotivaApp />
    </ErrorBoundary>
  );
}
