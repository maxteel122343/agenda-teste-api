export interface Task {
  id: string;
  title: string;
  duration: number; // in minutes
  createdAt: number;
  x: number;
  y: number;
}

export interface LiveState {
  isConnected: boolean;
  isInterrupted: boolean;
  transcript: string;
}
