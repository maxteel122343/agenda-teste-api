import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { Stage, Layer, Rect, Text, Group } from 'react-konva';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Task } from './types';
import { AudioService } from './services/audioService';
import { cn } from './lib/utils';
import Konva from 'konva';

const SYSTEM_INSTRUCTION = `Você é a "Motiva", uma assistente de produtividade extremamente engraçada, sarcástica e motivadora. 
Sua voz deve soar feminina e cheia de energia. 
Seu objetivo é ajudar o usuário a criar tarefas. 
Quando o usuário pedir para criar uma tarefa, você DEVE usar a ferramenta 'create_task'.
Seja criativa nas respostas! Se ele pedir algo de 20 minutos, diga algo como "20 minutos? Dá pra salvar o mundo ou pelo menos lavar a louça, vamos lá campeão!".
Sempre fale em Português do Brasil.`;

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const audioService = useRef(new AudioService());
  const sessionRef = useRef<any>(null);

  const [stageScale, setStageScale] = useState(1);
  const [stageX, setStageX] = useState(0);
  const [stageY, setStageY] = useState(0);
  const stageRef = useRef<Konva.Stage>(null);

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY > 0 ? oldScale * 0.9 : oldScale * 1.1;

    setStageScale(newScale);
    setStageX(pointer.x - mousePointTo.x * newScale);
    setStageY(pointer.y - mousePointTo.y * newScale);
  };

  const addTask = useCallback((title: string, duration: number) => {
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      duration,
      createdAt: Date.now(),
      x: Math.random() * (window.innerWidth - 300), // Random position on canvas
      y: Math.random() * (window.innerHeight - 200),
    };
    setTasks(prev => [newTask, ...prev]);
  }, []);

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>, id: string) => {
    const updatedTasks = tasks.map(task => {
      if (task.id === id) {
        return { ...task, x: e.target.x(), y: e.target.y() };
      }
      return task;
    });
    setTasks(updatedTasks);
  };

  const connectLive = async () => {
    if (isConnected) {
      sessionRef.current?.close();
      audioService.current.stop();
      setIsConnected(false);
      return;
    }

    setIsConnecting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } }, // Zephyr sounds energetic
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
              session.sendRealtimeInput({
                media: { data: base64, mimeType: 'audio/pcm;rate=16000' }
              });
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

            if (message.serverContent?.interrupted) {
              // Handle interruption if needed
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
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] selection:bg-orange-100 flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-bottom border-slate-100">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-200">
              <Sparkles className="text-white w-6 h-6" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
              Motiva<span className="text-orange-500">Task</span>
            </h1>
          </div>

          <button
            onClick={connectLive}
            disabled={isConnecting}
            className={cn(
              "relative flex items-center gap-3 px-6 py-3 rounded-full font-medium transition-all duration-300 shadow-sm",
              isConnected 
                ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" 
                : "bg-slate-900 text-white hover:bg-slate-800"
            )}
          >
            {isConnecting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : isConnected ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
            <span>{isConnecting ? "Conectando..." : isConnected ? "Parar Conversa" : "Falar com a Motiva"}</span>
            
            {isConnected && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}
          </button>
        </div>
      </header>



      <main className="flex-1 relative">
        <Stage
          width={window.innerWidth}
          height={window.innerHeight}
          onWheel={handleWheel}
          scaleX={stageScale}
          scaleY={stageScale}
          x={stageX}
          y={stageY}
          ref={stageRef}
        >
          <Layer>
            {tasks.map((task) => (
              <Group
                key={task.id}
                x={task.x}
                y={task.y}
                draggable
                onDragEnd={(e) => handleDragEnd(e, task.id)}
              >
                <Rect
                  width={300}
                  height={150}
                  fill="white"
                  cornerRadius={12}
                  shadowBlur={10}
                  shadowOpacity={0.1}
                  stroke="#e2e8f0"
                  strokeWidth={1}
                />
                <Text
                  text={task.title}
                  x={20}
                  y={20}
                  width={260}
                  fontSize={18}
                  fill="#1e293b"
                  fontFamily="Space Grotesk"
                  fontStyle="bold"
                />
                <Text
                  text={`${task.duration} minutos`}
                  x={20}
                  y={80}
                  fontSize={14}
                  fill="#64748b"
                  fontFamily="Inter"
                />
                <Text
                  text={new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  x={20}
                  y={110}
                  fontSize={10}
                  fill="#94a3b8"
                  fontFamily="JetBrains Mono"
                />
                <Rect
                  x={270}
                  y={10}
                  width={20}
                  height={20}
                  fill="#ef4444"
                  cornerRadius={4}
                  onClick={() => removeTask(task.id)}
                />
                <Text
                  text="X"
                  x={276}
                  y={13}
                  fontSize={12}
                  fill="white"
                  fontFamily="Inter"
                  listening={false}
                />
              </Group>
            ))}
            {isConnected && tasks.length === 0 && (
              <Text
                text="A Motiva está ouvindo... peça uma tarefa!"
                x={window.innerWidth / 2 - 150}
                y={window.innerHeight / 2 - 20}
                fontSize={20}
                fill="#94a3b8"
                fontFamily="Inter"
                align="center"
                width={300}
              />
            )}
          </Layer>
        </Stage>
      </main>
      <AnimatePresence>
        {isConnected && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/10">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [8, 16, 8] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                    className="w-1 bg-orange-500 rounded-full"
                  />
                ))}
              </div>
              <span className="text-sm font-medium">Conversa Ativa com Motiva</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
