/** 60-second Break Quiz session — offline bundled pack, no TV-show branding. */
import { QUIZ_PACK, type LifelineId, type QuizQuestion } from './quiz-pack.js';

export type QuizPhase = 'off' | 'start' | 'question' | 'end';

function daySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  const rnd = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export class BreakQuiz {
  phase: QuizPhase = 'off';
  score = 0;
  level = 1;
  streak = 0;
  startedAt = 0;
  qStartedAt = 0;
  sessionMs = 60_000;
  used: Record<LifelineId, boolean> = { hint: false, expert: false, fifty: false, star: false, friend: false };
  history: { q: QuizQuestion; correct: boolean }[] = [];
  hidden = new Set<number>();
  doubleNext = false;
  doubleNow = false;
  help = '';
  friendThinking = false;
  friendReveal = '';
  friendStartedAt = 0;
  friendMs = 10_000;
  queue: QuizQuestion[] = [];
  idx = 0;
  pausedTabs = 0;

  current(): QuizQuestion | null {
    return this.queue[this.idx] ?? null;
  }

  reset(): void {
    this.phase = 'start';
    this.score = 0;
    this.level = 1;
    this.streak = 0;
    this.startedAt = 0;
    this.qStartedAt = 0;
    this.used = { hint: false, expert: false, fifty: false, star: false, friend: false };
    this.history = [];
    this.hidden = new Set();
    this.doubleNext = false;
    this.doubleNow = false;
    this.help = '';
    this.friendThinking = false;
    this.friendReveal = '';
    this.queue = shuffle(QUIZ_PACK, daySeed());
    this.idx = 0;
  }

  begin(): void {
    this.phase = 'question';
    this.startedAt = performance.now();
    this.openQuestion();
  }

  questionBudget(): number {
    return Math.max(6000, 16000 - (this.level - 1) * 2000);
  }

  sessionLeft(): number {
    if (!this.startedAt) return this.sessionMs;
    return Math.max(0, this.sessionMs - (performance.now() - this.startedAt));
  }

  questionLeft(): number {
    if (!this.qStartedAt) return this.questionBudget();
    return Math.max(0, this.questionBudget() - (performance.now() - this.qStartedAt));
  }

  sessionOver(): boolean {
    return this.phase === 'question' && this.sessionLeft() <= 0;
  }

  questionOver(): boolean {
    return this.phase === 'question' && this.questionLeft() <= 0;
  }

  private openQuestion(): void {
    if (this.idx >= this.queue.length) this.idx = 0;
    this.qStartedAt = performance.now();
    this.hidden = new Set();
    this.help = '';
    this.friendThinking = false;
    this.friendReveal = '';
    this.doubleNow = this.doubleNext;
    this.doubleNext = false;
  }

  answer(i: number): { correct: boolean; done: boolean } | null {
    const q = this.current();
    if (!q || this.phase !== 'question' || this.hidden.has(i)) return null;
    const correct = i === q.answer;
    this.history.push({ q, correct });
    if (correct) {
      this.streak += 1;
      const mult = 1 + Math.max(0, this.streak - 1) * 0.25;
      const base = 100 * this.level;
      this.score += Math.round(base * mult * (this.doubleNow ? 2 : 1));
      this.level += 1;
    } else {
      this.streak = 0;
    }
    this.doubleNow = false;
    this.idx += 1;
    if (this.sessionLeft() <= 0 || this.idx >= this.queue.length) {
      this.phase = 'end';
      return { correct, done: true };
    }
    this.openQuestion();
    return { correct, done: false };
  }

  miss(): { done: boolean } {
    const q = this.current();
    if (q) this.history.push({ q, correct: false });
    this.streak = 0;
    this.doubleNow = false;
    this.idx += 1;
    if (this.sessionLeft() <= 0 || this.idx >= this.queue.length) {
      this.phase = 'end';
      return { done: true };
    }
    this.openQuestion();
    return { done: false };
  }

  useLifeline(id: LifelineId): string {
    const q = this.current();
    if (!q || this.used[id] || this.phase !== 'question') return '';
    this.used[id] = true;
    if (id === 'hint') {
      this.help = q.hint;
      return q.hint;
    }
    if (id === 'expert') {
      this.help = q.expert;
      return q.expert;
    }
    if (id === 'fifty') {
      const wrong = [0, 1, 2, 3].filter((i) => i !== q.answer);
      for (let n = 0; n < 2 && wrong.length; n++) {
        const pick = wrong.splice(Math.floor(Math.random() * wrong.length), 1)[0];
        this.hidden.add(pick);
      }
      this.help = 'Two options removed.';
      return this.help;
    }
    if (id === 'star') {
      this.doubleNext = true;
      this.help = 'Skipped — next correct is worth double.';
      this.history.push({ q, correct: false });
      this.idx += 1;
      if (this.sessionLeft() <= 0 || this.idx >= this.queue.length) {
        this.phase = 'end';
        return this.help;
      }
      this.openQuestion();
      return this.help;
    }
    if (id === 'friend') {
      this.friendThinking = true;
      this.friendReveal = '';
      this.friendStartedAt = performance.now();
      this.help = 'Video Call a Friend…';
      return this.help;
    }
    return '';
  }

  tickFriend(): void {
    if (!this.friendThinking || this.phase !== 'question') return;
    if (performance.now() - this.friendStartedAt < this.friendMs) return;
    const q = this.current();
    this.friendThinking = false;
    if (!q) return;
    this.friendReveal = `I'd pick “${q.choices[q.friendPick]}” — ${q.friendNote}`;
    this.help = this.friendReveal;
  }

  end(): void {
    this.phase = 'end';
    this.friendThinking = false;
  }
}

export function categoryCounts(): { date: number; science: number; gk: number; total: number } {
  const date = QUIZ_PACK.filter((q) => q.category === 'date').length;
  const science = QUIZ_PACK.filter((q) => q.category === 'science').length;
  const gk = QUIZ_PACK.filter((q) => q.category === 'gk').length;
  return { date, science, gk, total: QUIZ_PACK.length };
}
