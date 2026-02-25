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
  AlertCircle,
  MessageSquare,
  LayoutDashboard, // Icon for Canvas View
  CalendarDays // Icon for Calendar View
} from 'lucide-react';
import { Stage, Layer, Rect, Text, Group, Line, Wedge } from 'react-konva';
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Task } from './types';
import { AudioService } from './services/audioService';
import { cn } from './lib/utils';
import Konva from 'konva';
import ChatWindow from './components/ChatWindow';
import ApiKeyInput from './components/ApiKeyInput';
import CalendarView from './components/CalendarView';
import EditTaskModal from './components/EditTaskModal';

const SYSTEM_INSTRUCTION = `Você é a "Motiva", uma assistente de produtividade extremamente engraçada, sarcástica e motivadora. 
Sua voz deve soar feminina e cheia de energia. 
Seu objetivo é ajudar o usuário a criar e agendar tarefas. 
Quando o usuário pedir para criar uma ou mais tarefas, você DEVE usar a ferramenta 'create_task'.

Exemplos de como o usuário pode pedir:
- "Crie 5 tarefas de 30 minutos para estudar, diariamente por 5 dias a partir de amanhã."
- "Agende 3 sessões de academia de 60 minutos, semanalmente, começando na próxima segunda."
- "Crie uma tarefa de 20 minutos para lavar a louça."

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
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [userApiKey, setUserApiKey] = useState<string | null>(null);
  const [isCanvasView, setIsCanvasView] = useState(true); // New state for view toggle
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [runningTimers, setRunningTimers] = useState<Record<string, number>>({}); // taskId -> remainingTime/elapsedTime

  const playSound = useCallback((soundUrl: string) => {
    try {
      const audio = new Audio(soundUrl);
      audio.play();
    } catch (error) {
      console.error("Erro ao tocar som:", error);
    }
  }, []);

  useEffect(() => {
    const intervals: Record<string, NodeJS.Timeout> = {};

    tasks.forEach(task => {
      if (task.timerType && task.timerType !== 'none' && task.timerDuration !== undefined) {
        if (runningTimers[task.id] === undefined) {
          // Initialize timer
          setRunningTimers(prev => ({ ...prev, [task.id]: task.timerType === 'countdown' ? task.timerDuration * 60 : 0 }));
        }

        intervals[task.id] = setInterval(() => {
          setRunningTimers(prev => {
            const currentTime = prev[task.id];
            if (task.timerType === 'countdown') {
              if (currentTime <= 1) {
                clearInterval(intervals[task.id]);
                if (task.soundEffect) {
                  playSound(task.soundEffect);
                }
                // Optionally, mark task as complete or remove it
                return { ...prev, [task.id]: 0 };
              }
              return { ...prev, [task.id]: currentTime - 1 };
            } else { // stopwatch
              return { ...prev, [task.id]: currentTime + 1 };
            }
          });
        }, 1000); // Update every second
      }
    });

    return () => {
      Object.values(intervals).forEach(clearInterval);
    };
  }, [tasks, playSound, runningTimers]);

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

  const addTask = useCallback((title: string, duration: number, quantity: number = 1, dueDate?: number, recurrence?: 'daily' | 'weekly' | 'monthly' | 'none') => {
    const newTasks: Task[] = [];
    let currentDueDate = dueDate ? new Date(dueDate) : new Date();

    for (let i = 0; i < quantity; i++) {
      const newTask: Task = {
        id: Math.random().toString(36).substr(2, 9),
        title,
        duration,
        createdAt: Date.now(),
        x: Math.random() * (window.innerWidth - 300),
        y: Math.random() * (window.innerHeight - 200),
        dueDate: currentDueDate.getTime(),
        recurrence: recurrence || 'none',
      };
      newTasks.push(newTask);

      // Calculate next due date based on recurrence
      if (recurrence === 'daily') {
        currentDueDate.setDate(currentDueDate.getDate() + 1);
      } else if (recurrence === 'weekly') {
        currentDueDate.setDate(currentDueDate.getDate() + 7);
      } else if (recurrence === 'monthly') {
        currentDueDate.setMonth(currentDueDate.getMonth() + 1);
      }
    }
    setTasks(prev => [...newTasks, ...prev]);
  }, []);

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const updateTask = useCallback((updatedTask: Task) => {
    setTasks(prev => prev.map(task => (task.id === updatedTask.id ? updatedTask : task)));
  }, []);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>, id: string) => {
    const draggedNode = e.target;
    const draggedTask = tasks.find(task => task.id === id);
    if (!draggedTask) return;

    const updatedTasks = tasks.map(task => {
      if (task.id === id) {
        // Check for collision with other tasks to establish parent-child relationship
        let newParentId: string | undefined = undefined;
        tasks.forEach(otherTask => {
          if (otherTask.id !== id && otherTask.id !== draggedTask.parentId) { // Avoid self-parenting and re-parenting to current parent
            const otherNode = stageRef.current?.findOne(`#${otherTask.id}`);
            if (otherNode && draggedNode.intersects(otherNode)) {
              newParentId = otherTask.id;
            }
          }
        });
        return { ...task, x: draggedNode.x(), y: draggedNode.y(), parentId: newParentId };
      }
      return task;
    });
    setTasks(updatedTasks);
  };

  const createEmptyTask = useCallback(() => {
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      title: "Nova Tarefa",
      duration: 30,
      createdAt: Date.now(),
      x: Math.random() * (window.innerWidth - 300),
      y: Math.random() * (window.innerHeight - 200),
      recurrence: 'none',
      notes: [], // Initialize with empty notes array
    };
    setTasks(prev => [...prev, newTask]);
  }, []);

  const addNoteToTask = useCallback((taskId: string) => {
    setTasks(prevTasks => prevTasks.map(task => {
      if (task.id === taskId) {
        const newNote = {
          id: Math.random().toString(36).substr(2, 9),
          content: "Nova Nota",
          x: 20,
          y: task.height ? task.height - 40 : 110, // Position inside the card, adjust if card height is dynamic
          width: 260,
          height: 30,
        };
        return { ...task, notes: [...(task.notes || []), newNote] };
      }
      return task;
    }));
  }, []);

  const updateNotePosition = useCallback((taskId: string, noteId: string, newX: number, newY: number) => {
    setTasks(prevTasks => prevTasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          notes: task.notes?.map(note =>
            note.id === noteId ? { ...note, x: newX, y: newY } : note
          ),
        };
      }
      return task;
    }));
  }, []);

  const connectLive = async () => {
    if (isConnected) {
      sessionRef.current?.close();
      audioService.current.stop();
      setIsConnected(false);
      return;
    }

    setIsConnecting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: userApiKey || process.env.GEMINI_API_KEY! });
      
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
              description: "Cria um ou mais cards de tarefa com título, duração, quantidade, data de vencimento e recorrência.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: "O título ou descrição da tarefa." },
                  duration: { type: Type.NUMBER, description: "A duração da tarefa em minutos." },
                  quantity: { type: Type.NUMBER, description: "A quantidade de tarefas a serem criadas. Padrão é 1 se não especificado." },
                  dueDate: { type: Type.NUMBER, description: "Timestamp (em milissegundos) da data de vencimento da primeira tarefa. Opcional." },
                  recurrence: { type: Type.STRING, enum: ['daily', 'weekly', 'monthly', 'none'], description: "Padrão de recorrência da tarefa. Opcional. 'daily', 'weekly', 'monthly' ou 'none'." }
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
                  const { title, duration, quantity, dueDate, recurrence } = call.args as any;
                  addTask(title, duration, quantity, dueDate, recurrence);
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

          <button
            onClick={() => setIsCanvasView(prev => !prev)}
            className="relative flex items-center gap-3 px-6 py-3 rounded-full font-medium transition-all duration-300 shadow-sm bg-slate-900 text-white hover:bg-slate-800"
          >
            {isCanvasView ? <CalendarDays className="w-5 h-5" /> : <LayoutDashboard className="w-5 h-5" />}
            <span>{isCanvasView ? "Ver Calendário" : "Ver Canvas"}</span>
          </button>

          <button
            onClick={() => setIsChatOpen(true)}
            className="relative flex items-center gap-3 px-6 py-3 rounded-full font-medium transition-all duration-300 shadow-sm bg-slate-900 text-white hover:bg-slate-800"
          >
            <MessageSquare className="w-5 h-5" />
            <span>Chat</span>
          </button>

          <button
            onClick={createEmptyTask}
            className="relative flex items-center gap-3 px-6 py-3 rounded-full font-medium transition-all duration-300 shadow-sm bg-orange-500 text-white hover:bg-orange-600"
          >
            <Plus className="w-5 h-5" />
            <span>Novo Card</span>
          </button>
        </div>
      </header>

      <ApiKeyInput onApiKeyChange={setUserApiKey} />



      <main className="flex-1 relative">
        {isCanvasView ? (
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
                  onDblClick={() => {
                    setTaskToEdit(task);
                    setIsEditModalOpen(true);
                  }}
                  id={task.id} // Add ID to Group for easy lookup
                >
                  <Rect
                    width={300}
                    height={150}
                    fill="white"
                    cornerRadius={12}
                    shadowBlur={10}
                    shadowOpacity={0.1}
                    stroke={task.dueDate && task.dueDate < Date.now() + 24 * 60 * 60 * 1000 ? "#ef4444" : "#e2e8f0"}
                    strokeWidth={1}
                  />
                  {task.progress !== undefined && (
                    <Rect
                      x={10}
                      y={130}
                      width={280}
                      height={10}
                      fill="#e2e8f0"
                      cornerRadius={5}
                    />
                  )}
                  {task.progress !== undefined && (
                    <Rect
                      x={10}
                      y={130}
                      width={280 * (task.progress / 100)}
                      height={10}
                      fill="#22c55e"
                      cornerRadius={5}
                    />
                  )}
                  {task.timerType === 'countdown' && task.timerDuration !== undefined && runningTimers[task.id] !== undefined && (
                    <Wedge
                      x={280}
                      y={130}
                      radius={15}
                      angle={360 * (runningTimers[task.id] / (task.timerDuration * 60))}
                      fill="#f97316"
                      rotation={-90} // Start from top
                    />
                  )}
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
                  {task.progress !== undefined && (
                    <Text
                      text={`Progresso: ${task.progress}%`}
                      x={20}
                      y={45}
                      fontSize={12}
                      fill="#475569"
                      fontFamily="Inter"
                    />
                  )}
                  {task.timerType && task.timerType !== 'none' && (
                    <Text
                      text={`${task.timerType === 'countdown' ? 'Faltam' : 'Passaram'}: ${runningTimers[task.id] !== undefined ? Math.floor(runningTimers[task.id] / 60) : task.timerDuration || 0} min`}
                      x={20}
                      y={task.progress !== undefined ? 60 : 45} // Adjust y based on progress field
                      fontSize={12}
                      fill="#475569"
                      fontFamily="Inter"
                    />
                  )}
                  {task.soundEffect && (
                    <Text
                      text="🎵"
                      x={270}
                      y={105} // Adjusted y position
                      fontSize={16}
                      fill="#64748b"
                      fontFamily="Inter"
                    />
                  )}
                  <Text
                    text={`${task.duration} minutos`}
                    x={20}
                    y={task.progress !== undefined || (task.timerType && task.timerType !== 'none') ? 80 : 60} // Adjust y based on other fields
                    fontSize={14}
                    fill="#64748b"
                    fontFamily="Inter"
                  />
                  {task.dueDate && (
                    <Text
                      text={`Vence: ${new Date(task.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
                      x={20}
                      y={task.progress !== undefined || (task.timerType && task.timerType !== 'none') ? 95 : 80} // Adjusted y position
                      fontSize={12}
                      fill="#475569"
                      fontFamily="Inter"
                    />
                  )}
                  {task.recurrence && task.recurrence !== 'none' && (
                    <Text
                      text={`Repete: ${task.recurrence}`}
                      x={20}
                      y={task.progress !== undefined || (task.timerType && task.timerType !== 'none') || task.dueDate ? 110 : 95} // Adjusted y position
                      fontSize={10}
                      fill="#94a3b8"
                      fontFamily="JetBrains Mono"
                    />
                  )}
                  <Text
                    text={new Date(task.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    x={20}
                    y={task.progress !== undefined || (task.timerType && task.timerType !== 'none') || task.dueDate || task.recurrence ? 125 : 110} // Adjusted y position
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
                  <Rect
                    x={10}
                    y={10}
                    width={20}
                    height={20}
                    fill="#22c55e"
                    cornerRadius={4}
                    onClick={() => addNoteToTask(task.id)}
                  />
                  <Text
                    text="+"
                    x={16}
                    y={13}
                    fontSize={12}
                    fill="white"
                    fontFamily="Inter"
                    listening={false}
                  />

                  {/* Render Notes */}
                  {task.notes?.map(note => (
                    <Group
                      key={note.id}
                      x={note.x}
                      y={note.y}
                      draggable
                      onDragEnd={(e) => updateNotePosition(task.id, note.id, e.target.x(), e.target.y())}
                    >
                      <Rect
                        width={note.width}
                        height={note.height}
                        fill="#fffbe6" // Light yellow for notes
                        cornerRadius={8}
                        shadowBlur={5}
                        shadowOpacity={0.05}
                        stroke="#fcd34d" // Yellow border
                        strokeWidth={1}
                      />
                      <Text
                        text={note.content}
                        x={10}
                        y={10}
                        width={note.width - 20}
                        height={note.height - 20}
                        fontSize={12}
                        fill="#333"
                        fontFamily="Inter"
                        verticalAlign="middle"
                      />
                    </Group>
                  ))}
                </Group>
              ))}
              {tasks.map(task => {
                if (task.parentId) {
                  const parentTask = tasks.find(t => t.id === task.parentId);
                  if (parentTask) {
                    const startX = task.x + 150; // Center of child card
                    const startY = task.y + 75; // Center of child card
                    const endX = parentTask.x + 150; // Center of parent card
                    const endY = parentTask.y + 75; // Center of parent card
                    return (
                      <Line
                        key={`line-${task.id}`}
                        points={[startX, startY, endX, endY]}
                        stroke="#64748b"
                        strokeWidth={2}
                        tension={0.5}
                      />
                    );
                  }
                }
                return null;
              })}
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
        ) : (
          <CalendarView tasks={tasks} />
        )}
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

      <AnimatePresence>
        {isChatOpen && (
          <ChatWindow 
            isOpen={isChatOpen} 
            onClose={() => setIsChatOpen(false)}
            systemInstruction={SYSTEM_INSTRUCTION}
          />
        )}
      </AnimatePresence>

      <EditTaskModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        task={taskToEdit}
        onSave={updateTask}
      />
    </div>
  );
}
