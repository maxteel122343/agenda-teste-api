import React from 'react';
import { Task } from '../types';
import { cn } from '../lib/utils';

interface CalendarViewProps {
  tasks: Task[];
}

const CalendarView: React.FC<CalendarViewProps> = ({ tasks }) => {
  // Group tasks by date
  const groupedTasks = tasks.reduce((acc, task) => {
    if (task.dueDate) {
      const date = new Date(task.dueDate);
      const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!acc[dateString]) {
        acc[dateString] = [];
      }
      acc[dateString].push(task);
    }
    return acc;
  }, {} as Record<string, Task[]>);

  const sortedDates = Object.keys(groupedTasks).sort();

  return (
    <div className="p-4">
      <h2 className="text-2xl font-display font-bold text-slate-900 mb-6">Calendário de Tarefas</h2>
      
      {sortedDates.length === 0 ? (
        <p className="text-slate-500">Nenhuma tarefa agendada.</p>
      ) : (
        <div className="space-y-8">
          {sortedDates.map(dateString => (
            <div key={dateString} className="border-b border-slate-200 pb-4 last:border-b-0">
              <h3 className="text-xl font-display font-bold text-slate-700 mb-4">
                {new Date(dateString).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h3>
              <div className="space-y-3">
                {groupedTasks[dateString].map(task => (
                  <div key={task.id} className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{task.title}</p>
                      <p className="text-sm text-slate-500">{task.duration} minutos</p>
                      {task.recurrence && task.recurrence !== 'none' && (
                        <p className="text-xs text-slate-400">Repete: {task.recurrence}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(task.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CalendarView;
