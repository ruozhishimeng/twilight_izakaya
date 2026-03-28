import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Guest } from '../data/gameData';
import { DailySummary } from '../types/journal';

interface Props {
  guest: Guest;
  discoveredFeatures: string[];
  journalHistory?: DailySummary[];
  currentWeek: number;
  currentDay: number;
  onClose: () => void;
}

type DiaryPage =
  | {
      key: string;
      label: string;
      kind: 'current';
      week: number;
      day: number;
    }
  | {
      key: string;
      label: string;
      kind: 'summary';
      week: number;
      day: number;
      summary: DailySummary;
    };

function weekLabel(week: number) {
  return `第 ${week} 周`;
}

function dayLabel(day: number) {
  const labels = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
  return labels[day - 1] || `第 ${day} 天`;
}

function PixelButton({
  onClick,
  disabled,
  title,
  className = '',
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`pixel-button pixel-rounded-lg flex items-center justify-center ${className}`}
    >
      {children}
    </button>
  );
}

function pageClass(side: 'left' | 'right') {
  const edge =
    side === 'left'
      ? 'shadow-[inset_-1px_0_0_rgba(212,184,134,0.12)]'
      : 'shadow-[inset_1px_0_0_rgba(212,184,134,0.12)]';
  return `relative flex min-h-0 flex-1 flex-col bg-[#2c1e16] px-8 py-8 text-[#e8dcc4] ${edge}`;
}

export default function Diary({
  guest,
  discoveredFeatures,
  journalHistory = [],
  currentWeek,
  currentDay,
  onClose,
}: Props) {
  const pages = useMemo<DiaryPage[]>(() => {
    const historyPages = [...journalHistory]
      .sort((a, b) => {
        if (a.week !== b.week) {
          return b.week - a.week;
        }
        return b.day - a.day;
      })
      .map(summary => ({
        key: `summary-${summary.week}-${summary.day}`,
        label: `${weekLabel(summary.week)} ${dayLabel(summary.day)}`,
        kind: 'summary' as const,
        week: summary.week,
        day: summary.day,
        summary,
      }));

    return [
      {
        key: 'current',
        label: `${weekLabel(currentWeek)} ${dayLabel(currentDay)}`,
        kind: 'current',
        week: currentWeek,
        day: currentDay,
      },
      ...historyPages,
    ];
  }, [currentDay, currentWeek, journalHistory]);

  const [pageIndex, setPageIndex] = useState(0);
  const currentPage = pages[Math.min(pageIndex, pages.length - 1)] || pages[0];

  const currentGuestNotes = discoveredFeatures
    .map(id => guest.features.find(feature => feature.id === id))
    .filter(Boolean)
    .map(feature => ({
      id: feature!.id,
      name: feature!.name,
      desc: feature!.desc,
    }));

  const currentSummary = currentPage.kind === 'summary' ? currentPage.summary : null;

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
      <div className="relative flex h-[84vh] w-[88vw] max-w-6xl flex-col overflow-hidden border-[6px] border-[#1a110c] bg-[#1c1411] text-[#e8dcc4] shadow-[0_0_60px_rgba(0,0,0,0.72)] animate-scale-up pixel-rounded-lg">
        <PixelButton
          onClick={onClose}
          title="关闭日记"
          className="absolute right-6 top-6 z-30 h-12 w-12 px-0 text-[#fff2d7] !bg-[#b86943] !border-[#6a351e] !border-b-[#4d2313]"
        >
          <X size={18} />
        </PixelButton>

        <div className="border-b-[6px] border-[#1a110c] bg-[#2c1e16] px-6 py-4 pr-20 text-[#fff2d7]">
          <div className="text-sm tracking-[0.35em]">DIARY</div>
          <div className="mt-2 text-2xl font-bold">营业手记</div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden bg-[#1a110c]">
          <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-6 -translate-x-1/2 bg-[linear-gradient(90deg,#241811_0%,#4a3f35_50%,#241811_100%)]" />

          <div className="flex h-full">
            <section className={pageClass('left')}>
              <div className="mb-4 border-b-2 border-[#b18859] pb-3">
                <div className="text-sm tracking-[0.3em] text-[#8b5a2b]">INDEX</div>
                <h2 className="mt-2 text-3xl font-bold">日期索引</h2>
              </div>

              <div className="border-2 border-[#4a3f35] bg-[#1a110c] p-4 pixel-rounded-lg">
                <div className="text-sm tracking-[0.2em] text-[#8b5a2b]">按日期查找</div>
                <select
                  value={currentPage.key}
                  onChange={event => {
                    const nextIndex = pages.findIndex(page => page.key === event.target.value);
                    if (nextIndex >= 0) {
                      setPageIndex(nextIndex);
                    }
                  }}
                  className="mt-3 block w-full border-4 border-[#8b5a2b] bg-[#2c1e16] px-3 py-3 text-sm text-[#e8dcc4] outline-none pixel-rounded-lg"
                >
                  {pages.map(page => (
                    <option key={page.key} value={page.key}>
                      {page.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                <div className="space-y-3">
                  {pages.map((page, index) => (
                    <button
                      key={page.key}
                      type="button"
                      onClick={() => setPageIndex(index)}
                      className={`block w-full border-4 px-4 py-3 text-left pixel-rounded-lg ${
                        index === pageIndex
                          ? 'border-[#d4b886] bg-[#4a3f35]'
                          : 'border-[#3e2723] bg-[#1a110c] hover:border-[#8b5a2b]'
                      }`}
                    >
                      <div className="text-xs tracking-[0.2em] text-[#8b5a2b]">
                        {page.kind === 'current' ? 'NOW' : 'DAY LOG'}
                      </div>
                      <div className="mt-1 font-bold">{page.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className={pageClass('right')}>
              <div className="mb-4 border-b-2 border-[#b18859] pb-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm tracking-[0.3em] text-[#8b5a2b]">
                      {currentPage.kind === 'current' ? 'CURRENT NOTES' : 'DAY RECORD'}
                    </div>
                    <h2 className="mt-2 text-3xl font-bold">{currentPage.label}</h2>
                  </div>
                  <div className="text-right text-sm text-[#8b5a2b]">
                    第 {pageIndex + 1} / {pages.length} 页
                  </div>
                </div>
              </div>

              {currentPage.kind === 'current' ? (
                <div className="min-h-0 flex-1 overflow-y-auto pr-3 custom-scrollbar">
                  <div className="space-y-4">
                    <div className="border-b-2 border-[#4a3f35] pb-4">
                      <div className="text-sm tracking-[0.2em] text-[#8b5a2b]">当前客人</div>
                      <div className="mt-2 text-3xl font-bold">{guest.name}</div>
                      <div className="mt-2 text-sm text-[#a38c66]">
                        今天已记录 {currentGuestNotes.length}/{guest.features.length} 条观察
                      </div>
                    </div>

                    {currentGuestNotes.length > 0 ? (
                      currentGuestNotes.map((note, index) => (
                        <article key={note.id} className="border-b border-[#4a3f35] pb-4">
                          <div className="flex items-center justify-between gap-4 pb-2">
                            <div className="text-lg font-bold">{note.name}</div>
                            <div className="text-xs text-[#8b5a2b]">观察 {index + 1}</div>
                          </div>
                          <p className="mt-2 leading-8 italic tracking-[0.04em] text-[#d8c7a8]">
                            {note.desc}
                          </p>
                        </article>
                      ))
                    ) : (
                      <div className="border-b border-dashed border-[#4a3f35] pb-5 text-sm italic tracking-[0.04em] text-[#8d7250]">
                        这一页还没有观察记录，等你在观察阶段确认线索后，笔记就会自己补全。
                      </div>
                    )}
                  </div>
                </div>
              ) : currentSummary ? (
                <div className="min-h-0 flex-1 overflow-y-auto pr-3 custom-scrollbar">
                  <div className="space-y-4">
                    <div className="border-b-2 border-[#4a3f35] pb-4">
                      <div className="text-sm tracking-[0.2em] text-[#8b5a2b]">当日概览</div>
                      <div className="mt-3 grid gap-3 text-sm text-[#5c3a18] md:grid-cols-3">
                        <div className="border-2 border-[#4a3f35] bg-[#2c1e16] px-3 py-3 pixel-rounded-lg">
                          接待客人 {currentSummary.guests.length} 位
                        </div>
                        <div className="border-2 border-[#4a3f35] bg-[#2c1e16] px-3 py-3 pixel-rounded-lg">
                          调制成功 {currentSummary.guests.filter(record => record.success).length} 次
                        </div>
                        <div className="border-2 border-[#4a3f35] bg-[#2c1e16] px-3 py-3 pixel-rounded-lg">
                          记录线索 {currentSummary.guests.flatMap(record => record.notes).length} 条
                        </div>
                      </div>
                    </div>

                    <div className="border-b-2 border-[#4a3f35] pb-4">
                      <div className="text-sm tracking-[0.2em] text-[#8b5a2b]">来客与调酒</div>
                      <div className="mt-4 space-y-3">
                        {currentSummary.guests.map(record => (
                          <div key={`${record.guestId}-${record.servedDrink}`} className="border-b border-[#4a3f35] px-1 py-3">
                            <div className="flex items-center justify-between gap-4">
                              <div className="font-bold">{record.guestName}</div>
                              <div className={`text-sm ${record.success ? 'text-[#6e4b21]' : 'text-[#9a4330]'}`}>
                                {record.success ? '调制成功' : '调制失手'}
                              </div>
                            </div>
                            <div className="mt-2 text-sm italic tracking-[0.04em] text-[#d8c7a8]">
                              酒名：{record.servedDrink}
                            </div>
                            {record.challenges.length > 0 && (
                              <div className="mt-2 text-sm italic tracking-[0.04em] text-[#a38c66]">
                                挑战：{record.challenges.join(' / ')}
                              </div>
                            )}
                            {record.diaryEntry && (
                              <div className="mt-3 border-l-2 border-[#8b5a2b] pl-3 text-sm italic tracking-[0.04em] text-[#d8c7a8]">
                                {record.diaryEntry}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="border-b-2 border-[#4a3f35] pb-4">
                        <div className="text-sm tracking-[0.2em] text-[#8b5a2b]">奖励清单</div>
                        <div className="mt-3 space-y-2 text-sm text-[#5c3a18]">
                          {currentSummary.guests.flatMap(record => record.rewards).length > 0 ? (
                            currentSummary.guests.flatMap(record => record.rewards).map((reward, index) => (
                              <div
                                key={`${reward.id}-${index}`}
                                className="border-b border-[#4a3f35] px-1 py-2 italic tracking-[0.04em] text-[#d8c7a8]"
                              >
                                {reward.name}
                                {reward.quantity ? ` x${reward.quantity}` : ''}
                              </div>
                            ))
                          ) : (
                            <div className="italic text-[#8d7250]">这一天没有记下额外奖励。</div>
                          )}
                        </div>
                      </div>

                      <div className="border-b-2 border-[#4a3f35] pb-4">
                        <div className="text-sm tracking-[0.2em] text-[#8b5a2b]">观察线索</div>
                        <div className="mt-3 space-y-2 text-sm text-[#5c3a18]">
                          {currentSummary.guests.flatMap(record => record.notes).length > 0 ? (
                            currentSummary.guests.flatMap(record => record.notes).map(note => (
                              <div key={note.id} className="border-b border-[#4a3f35] px-1 py-2">
                                <div className="font-bold">{note.name}</div>
                                <div className="mt-1 italic tracking-[0.04em] text-[#a38c66]">{note.desc}</div>
                              </div>
                            ))
                          ) : (
                            <div className="italic text-[#8d7250]">这一天还没有留下新的观察线索。</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          <PixelButton
            onClick={() => setPageIndex(index => Math.max(0, index - 1))}
            disabled={pageIndex === 0}
            title="上一页"
            className="absolute left-4 top-1/2 z-20 h-14 w-14 -translate-y-1/2 px-0"
          >
            <ChevronLeft size={18} />
          </PixelButton>

          <PixelButton
            onClick={() => setPageIndex(index => Math.min(pages.length - 1, index + 1))}
            disabled={pageIndex >= pages.length - 1}
            title="下一页"
            className="absolute right-4 top-1/2 z-20 h-14 w-14 -translate-y-1/2 px-0"
          >
            <ChevronRight size={18} />
          </PixelButton>
        </div>
      </div>
    </div>
  );
}
