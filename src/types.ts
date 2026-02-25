export interface Task {
  id: string;
  title: string;
  duration: number; // in minutes
  createdAt: number;
  x: number;
  y: number;
  dueDate?: number; // Timestamp for due date
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'none'; // e.g., 'daily', 'weekly', 'monthly'
  parentId?: string; // ID of the parent task, if this is a child task
  progress?: number; // Current progress percentage (0-100)
  timerDuration?: number; // Total duration for a timer (in minutes)
  timerType?: 'stopwatch' | 'countdown' | 'none'; // Type of timer
  soundEffect?: string; // Path or name of a sound effect to play
  notes?: Note[]; // Array of text notes associated with this task
}

export interface Note {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LiveState {
  isConnected: boolean;
  isInterrupted: boolean;
  transcript: string;
}
