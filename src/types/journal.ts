export interface JournalReward {
  type: 'ingredient' | 'item' | 'recipe';
  id: string;
  name: string;
  description: string;
  quantity?: number;
}

export interface JournalNote {
  id: string;
  name: string;
  desc: string;
}

export interface DailyGuestRecord {
  guestId: string;
  guestName: string;
  servedDrink: string;
  success: boolean;
  rewards: JournalReward[];
  challenges: string[];
  notes: JournalNote[];
  diaryEntry?: string;
}

export interface DailySummary {
  week: number;
  day: number;
  guests: DailyGuestRecord[];
}
