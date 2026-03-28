import React from 'react';
import { DailySummary } from '../types/journal';

interface Props {
  summary: DailySummary;
  onContinue: () => void;
}

function weekLabel(week: number) {
  return `第 ${week} 周`;
}

function dayLabel(day: number) {
  const labels = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
  return labels[day - 1] || `第 ${day} 天`;
}

export default function DaySummaryPhase({ summary, onContinue }: Props) {
  const rewardList = summary.guests.flatMap(guest => guest.rewards);
  const challengeList = [...new Set(summary.guests.flatMap(guest => guest.challenges).filter(Boolean))];

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(110,76,43,0.28),transparent_50%),rgba(0,0,0,0.78)] p-8 backdrop-blur-[2px]">
      <div className="relative flex h-full max-h-[760px] w-full max-w-6xl overflow-hidden rounded-[30px] border-[6px] border-[#6f4b2c] bg-[#d5bf95] text-[#3e2723] shadow-[0_0_60px_rgba(0,0,0,0.6)] animate-scale-up">
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-10 -translate-x-1/2 bg-[linear-gradient(90deg,#6f4b2c_0%,#9c6f43_45%,#754d2d_100%)] shadow-[inset_-2px_0_0_rgba(0,0,0,0.2),inset_2px_0_0_rgba(255,255,255,0.18)]" />

        <section
          className="relative flex flex-1 flex-col px-10 py-12"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, rgba(120,78,42,0.08) 0, rgba(120,78,42,0.08) 1px, transparent 1px, transparent 40px)',
          }}
        >
          <div className="mb-8 border-b-2 border-[#8b5a2b] pb-3 text-center">
            <div className="text-sm tracking-[0.35em] text-[#8b5a2b]">DAY END</div>
            <h2 className="mt-2 text-4xl font-bold">营业小结</h2>
            <p className="mt-3 text-sm text-[#7a5331]">
              {weekLabel(summary.week)} · {dayLabel(summary.day)}
            </p>
          </div>

          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            {summary.guests.map(record => (
              <article key={`${record.guestId}-${record.servedDrink}`} className="rounded-2xl border border-[#c8a472] bg-[#f4e8c9]/95 p-4 shadow-[2px_2px_0_rgba(111,75,44,0.12)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm tracking-[0.2em] text-[#8b5a2b]">来客记录</div>
                    <div className="mt-1 text-2xl font-bold">{record.guestName}</div>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-sm ${record.success ? 'bg-[#d4b07e] text-[#4c2f17]' : 'bg-[#e2b29f] text-[#7a2d1d]'}`}>
                    {record.success ? '今晚顺利' : '还需再试'}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm leading-relaxed text-[#5c3a18]">
                  <div>
                    <span className="font-bold text-[#8b5a2b]">调制的酒：</span>
                    {record.servedDrink}
                  </div>
                  <div>
                    <span className="font-bold text-[#8b5a2b]">接下的课题：</span>
                    {record.challenges.length > 0 ? record.challenges.join(' / ') : '今夜没有留下新的课题。'}
                  </div>
                  <div>
                    <span className="font-bold text-[#8b5a2b]">记下的线索：</span>
                    {record.notes.length > 0 ? record.notes.map(note => note.name).join('、') : '没有新的观察。'}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          className="relative flex flex-1 flex-col px-10 py-12"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, rgba(120,78,42,0.08) 0, rgba(120,78,42,0.08) 1px, transparent 1px, transparent 40px)',
          }}
        >
          <div className="mb-8 border-b-2 border-[#8b5a2b] pb-3 text-center">
            <div className="text-sm tracking-[0.35em] text-[#8b5a2b]">NOTEBOOK</div>
            <h2 className="mt-2 text-4xl font-bold">写入记事本</h2>
          </div>

          <div className="space-y-5 overflow-y-auto pr-2 custom-scrollbar">
            <div className="rounded-2xl border border-[#c8a472] bg-[#f7edd5]/95 p-5">
              <div className="text-lg font-bold text-[#8b5a2b]">今日收获</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {rewardList.length > 0 ? rewardList.map((reward, index) => (
                  <span key={`${reward.id}-${index}`} className="rounded-full border border-[#b48a57] bg-[#ecd7ae] px-3 py-1 text-sm">
                    {reward.name}{reward.quantity ? ` x${reward.quantity}` : ''}
                  </span>
                )) : (
                  <span className="text-sm italic text-[#8d7250]">今晚没有额外的收获。</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[#c8a472] bg-[#f7edd5]/95 p-5">
              <div className="text-lg font-bold text-[#8b5a2b]">已接课题</div>
              <div className="mt-3 space-y-2 text-sm leading-relaxed text-[#5c3a18]">
                {challengeList.length > 0 ? challengeList.map(challenge => (
                  <div key={challenge} className="rounded-xl bg-[#efe4c8] px-3 py-2">
                    {challenge}
                  </div>
                )) : (
                  <div className="italic text-[#8d7250]">今晚没有留下新的课题。</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[#c8a472] bg-[#f7edd5]/95 p-5">
              <div className="text-lg font-bold text-[#8b5a2b]">记事本摘录</div>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#5c3a18]">
                {summary.guests.flatMap(record => record.notes).length > 0 ? (
                  summary.guests.flatMap(record => record.notes).slice(0, 4).map(note => (
                    <div key={note.id} className="rounded-xl bg-[#efe4c8] px-3 py-2">
                      <div className="font-bold">{note.name}</div>
                      <div className="mt-1 text-[#6a4726]">{note.desc}</div>
                    </div>
                  ))
                ) : (
                  <div className="italic text-[#8d7250]">这一页还没有写下新的观察。</div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onContinue}
            className="pixel-button mt-8 self-center px-10 py-3 text-xl font-bold"
          >
            翻到下一页
          </button>
        </section>
      </div>
    </div>
  );
}
