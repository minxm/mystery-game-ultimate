export interface Suspect {
  id: string;
  name: string;
  age: number;
  occupation: string;
  relationship: string;
  alibi: string;
  motive: string;
  personality: string;
  secrets: string[];
  imageUrl?: string;
  isGuilty: boolean;
}

export interface Evidence {
  id: string;
  name: string;
  description: string;
  location: string;
  significance: string;
  imageUrl?: string;
  relatedSuspects: string[];
}

export interface TimelineEvent {
  time: string;
  event: string;
  location: string;
  witness?: string;
  significance: 'low' | 'medium' | 'high' | 'critical';
}

export interface CaseData {
  id: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  setting: string;
  victim: {
    name: string;
    age: number;
    occupation: string;
    background: string;
    imageUrl?: string;
  };
  deathMethod: string;
  sceneDescription: string;
  sceneImageUrl?: string;
  mapImageUrl?: string;
  suspects: Suspect[];
  evidence: Evidence[];
  timeline: TimelineEvent[];
  truth: {
    killer: string;
    method: string;
    motive: string;
    process: string[];
    keyClues: string[];
  };
  redHerrings: string[];
  createdAt: number;
}

export interface GameProgress {
  caseId: string;
  discoveredEvidence: string[];
  interrogatedSuspects: string[];
  notes: string;
  startTime: number;
  endTime?: number;
  score?: number;
}

export interface InterrogationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

export interface UserStats {
  casesCompleted: number;
  averageScore: number;
  perfectSolves: number;
  achievements: Achievement[];
  streak: number;
}
