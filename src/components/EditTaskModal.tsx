import React, { useState, useEffect } from 'react';
import { Task } from '../types';
import { cn } from '../lib/utils';

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onSave: (updatedTask: Task) => void;
}

const EditTaskModal: React.FC<EditTaskModalProps> = ({ isOpen, onClose, task, onSave }) => {
  const [title, setTitle] = useState(task?.title || '');
  const [duration, setDuration] = useState(task?.duration || 0);
  const [dueDate, setDueDate] = useState<string>(task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
  const [recurrence, setRecurrence] = useState<'daily' | 'weekly' | 'monthly' | 'none'>(task?.recurrence || 'none');
  const [progress, setProgress] = useState(task?.progress || 0);
  const [timerDuration, setTimerDuration] = useState(task?.timerDuration || 0);
  const [timerType, setTimerType] = useState<'stopwatch' | 'countdown' | 'none'>(task?.timerType || 'none');
  const [soundEffect, setSoundEffect] = useState(task?.soundEffect || '');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDuration(task.duration);
      setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
      setRecurrence(task.recurrence || 'none');
      setProgress(task.progress || 0);
      setTimerDuration(task.timerDuration || 0);
      setTimerType(task.timerType || 'none');
      setSoundEffect(task.soundEffect || '');
    }
  }, [task]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (task) {
      const updatedTask: Task = {
        ...task,
        title,
        duration,
        dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
        recurrence,
        progress,
        timerDuration,
        timerType,
        soundEffect,
      };
      onSave(updatedTask);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-display font-bold text-slate-900 mb-4">Editar Tarefa</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-slate-700">Título</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm p-2 focus:ring-orange-500 focus:border-orange-500"
              required
            />
          </div>
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-slate-700">Duração (minutos)</label>
            <input
              type="number"
              id="duration"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value))}
              className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm p-2 focus:ring-orange-500 focus:border-orange-500"
              required
            />
          </div>
          <div>
            <label htmlFor="dueDate" className="block text-sm font-medium text-slate-700">Data de Vencimento</label>
            <input
              type="date"
              id="dueDate"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm p-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <div>
            <label htmlFor="recurrence" className="block text-sm font-medium text-slate-700">Recorrência</label>
            <select
              id="recurrence"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as 'daily' | 'weekly' | 'monthly' | 'none')}
              className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm p-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="none">Nenhuma</option>
              <option value="daily">Diária</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
            </select>
          </div>
          <div>
            <label htmlFor="progress" className="block text-sm font-medium text-slate-700">Progresso (%)</label>
            <input
              type="number"
              id="progress"
              value={progress}
              onChange={(e) => setProgress(parseInt(e.target.value))}
              className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm p-2 focus:ring-orange-500 focus:border-orange-500"
              min="0"
              max="100"
            />
          </div>
          <div>
            <label htmlFor="timerDuration" className="block text-sm font-medium text-slate-700">Duração do Timer (minutos)</label>
            <input
              type="number"
              id="timerDuration"
              value={timerDuration}
              onChange={(e) => setTimerDuration(parseInt(e.target.value))}
              className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm p-2 focus:ring-orange-500 focus:border-orange-500"
              min="0"
            />
          </div>
          <div>
            <label htmlFor="timerType" className="block text-sm font-medium text-slate-700">Tipo de Timer</label>
            <select
              id="timerType"
              value={timerType}
              onChange={(e) => setTimerType(e.target.value as 'stopwatch' | 'countdown' | 'none')}
              className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm p-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="none">Nenhum</option>
              <option value="stopwatch">Cronômetro</option>
              <option value="countdown">Contagem Regressiva</option>
            </select>
          </div>
          <div>
            <label htmlFor="soundEffect" className="block text-sm font-medium text-slate-700">Efeito Sonoro (URL/Nome)</label>
            <input
              type="text"
              id="soundEffect"
              value={soundEffect}
              onChange={(e) => setSoundEffect(e.target.value)}
              className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm p-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 text-slate-800 rounded-md hover:bg-slate-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTaskModal;
