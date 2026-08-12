import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Users,
  MoreHorizontal,
  Pencil,
  Trash2,
  Download,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { LiquidModal } from '@/components/ui/LiquidModal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { springSoft } from '@/lib/motion';
import { ViewTransition } from '@/components/ui/PageTransition';
import { LiquidSelect } from '@/components/ui/LiquidSelect';
import { useSchedules, useCreateSchedule, useUpdateSchedule, useDeleteSchedule, ScheduleEvent as ApiEvent } from '@/lib/queries';
import { apiError } from '@/lib/api';

// P6-E5：生成 ICS（iCalendar）文件并触发下载，兼容 Outlook/Apple/Google 日历
function exportICS(events: ApiEvent[], filename: string) {
  const pad = (n: number) => String(n).padStart(2, '0');
  // ICS 时间格式：YYYYMMDDTHHMMSSZ（UTC）
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  };
  // 转义 ICS 文本中的特殊字符
  const esc = (s: string) => s.replace(/([\\,;])/g, '\\$1').replace(/\n/g, '\\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SLPM//Schedule//CN',
    'CALSCALE:GREGORIAN',
    ...events.flatMap((e) => [
      'BEGIN:VEVENT',
      `UID:${e.id}@slpm`,
      `DTSTAMP:${fmt(new Date().toISOString())}`,
      `DTSTART:${fmt(e.startTime)}`,
      `DTEND:${fmt(e.endTime)}`,
      `SUMMARY:${esc(e.title)}`,
      e.location ? `LOCATION:${esc(e.location)}` : '',
      e.attendees.length > 0 ? `ATTENDEE:${esc(e.attendees.join(','))}` : '',
      `DESCRIPTION:优先级:${e.priority}`,
      'END:VEVENT',
    ]).filter(Boolean),
    'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

// 工具：年月的数字 → "YYYY-MM"
function ym(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}
// 该月天数
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
// 该月 1 日是周几（周一=0）
function firstDayWeekday(year: number, month: number): number {
  const d = new Date(year, month - 1, 1).getDay(); // 周日=0
  return (d + 6) % 7;
}

export const ScheduleManagementPage: React.FC = () => {
  const { show, ToastEl } = useToast();
  const createMut = useCreateSchedule();
  const updateMut = useUpdateSchedule();
  const deleteMut = useDeleteSchedule();

  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [viewDir, setViewDir] = useState(1);
  const viewOrder = { month: 0, week: 1, day: 2 } as const;

  // 真实日期游标：从当前月起步，可前后翻任意月份（修复原 demo "只能 5 月"）
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });
  const monthStr = ym(cursor.year, cursor.month);
  const { data: events = [] } = useSchedules(monthStr);

  const [selectedDate, setSelectedDate] = useState<string>(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
  );
  const [priorityFilter, setPriorityFilter] = useState<'all' | '高' | '中' | '低'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ApiEvent | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  // P8：删除二次确认（替代"点删即删"）
  const [pendingDelete, setPendingDelete] = useState<ApiEvent | null>(null);

  // 表单：用 datetime-local 字符串（YYYY-MM-DDTHH:mm）
  const emptyForm = () => ({
    title: '',
    startInput: `${selectedDate}T10:00`,
    endInput: `${selectedDate}T11:00`,
    location: '线上会议室 Alpha',
    priority: '高' as '高' | '中' | '低',
    attendees: '',
  });
  const [form, setForm] = useState(emptyForm());

  const filteredEvents = useMemo(
    () => events.filter((e) => priorityFilter === 'all' || e.priority === priorityFilter),
    [events, priorityFilter],
  );

  // 按选中日期过滤（YYYY-MM-DD 比较）
  const dayEvents = filteredEvents
    .filter((e) => e.startTime.slice(0, 10) === selectedDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const monthLabel = `${cursor.year}年 ${cursor.month}月`;

  const openCreate = (dateStr = selectedDate) => {
    setForm({
      title: '',
      startInput: `${dateStr}T10:00`,
      endInput: `${dateStr}T11:00`,
      location: '线上会议室 Alpha',
      priority: '高',
      attendees: '',
    });
    setEditing(null);
    setShowCreate(true);
  };

  const openEdit = (evt: ApiEvent) => {
    setEditing(evt);
    setForm({
      title: evt.title,
      startInput: evt.startTime.slice(0, 16),
      endInput: evt.endTime.slice(0, 16),
      location: evt.location || '',
      priority: evt.priority,
      attendees: evt.attendees.join(', '),
    });
    setShowCreate(true);
    setMenuId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      startTime: new Date(form.startInput).toISOString(),
      endTime: new Date(form.endInput).toISOString(),
      location: form.location,
      priority: form.priority,
      attendees: form.attendees.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      status: editing?.status ?? ('待开始' as const),
    };
    try {
      if (editing) {
        const r = await updateMut.mutateAsync({ id: editing.id, ...payload });
        show('日程已更新');
        // P4-2：冲突预警
        if (r.conflicts && r.conflicts.length > 0) {
          show(`⚠️ 时间冲突：与「${r.conflicts[0].title}」等 ${r.conflicts.length} 个日程重叠`);
        }
      } else {
        const r = await createMut.mutateAsync(payload);
        show('日程已创建');
        // P4-2：冲突预警
        if (r.conflicts && r.conflicts.length > 0) {
          show(`⚠️ 时间冲突：与「${r.conflicts[0].title}」等 ${r.conflicts.length} 个日程重叠`);
        }
      }
      setSelectedDate(form.startInput.slice(0, 10));
      setShowCreate(false);
      setEditing(null);
    } catch (err) {
      show(apiError(err, '保存失败'));
    }
  };

  // P8：删除改为先弹确认框
  const deleteEvent = (evt: ApiEvent) => {
    setMenuId(null);
    setPendingDelete(evt);
  };
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    try {
      await deleteMut.mutateAsync(id);
      show('日程已删除');
    } catch (err) {
      show(apiError(err, '删除失败'));
    } finally {
      setPendingDelete(null);
    }
  };

  const goToday = () => {
    setCursor({ year: today.getFullYear(), month: today.getMonth() + 1 });
    setSelectedDate(
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    );
    show('已回到今天');
  };

  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      let m = c.month + delta;
      let y = c.year;
      if (m < 1) { m = 12; y -= 1; }
      if (m > 12) { m = 1; y += 1; }
      return { year: y, month: m };
    });
  };

  const field = 'liquid-input w-full px-3.5 py-2.5 rounded-xl text-[12px] text-white';

  return (
    <div className="w-full h-full min-h-0 flex flex-col gap-3 pb-1">
      {ToastEl}
      {/* P8：日程删除二次确认 */}
      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        variant="danger"
        title="删除该日程？"
        description={pendingDelete ? `「${pendingDelete.title}」将被删除，该操作不可恢复。` : ''}
        confirmText="确认删除"
      />

      {/* 顶栏工具 — 单行 */}
      <div className="flex items-center justify-between gap-3 flex-nowrap shrink-0 min-w-0 overflow-x-auto">
        <div className="flex items-center gap-3 shrink-0">
          <div className="liquid-icon-well w-10 h-10 rounded-2xl flex items-center justify-center text-emerald-300">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[18px] font-bold text-white tracking-tight whitespace-nowrap">日程与会议管理</h2>
            <p className="text-[11px] text-white/40 whitespace-nowrap">月 / 周 / 日视图 · 预约 · 编辑 · 筛选</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <div className="liquid-pill p-1 flex items-center gap-0.5 whitespace-nowrap relative">
            {(['month', 'week', 'day'] as const).map((v) => (
              <button
                key={v}
                onClick={() => {
                  setViewDir(viewOrder[v] >= viewOrder[view] ? 1 : -1);
                  setView(v);
                }}
                className={`relative px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap z-10 ${
                  view === v ? 'text-white' : 'text-white/40 hover:text-white/75'
                }`}
              >
                {view === v && (
                  <motion.span
                    layoutId="schedule-view-pill"
                    className="absolute inset-0 rounded-full bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{v === 'month' ? '月视图' : v === 'week' ? '周视图' : '日视图'}</span>
              </button>
            ))}
          </div>

          <LiquidSelect
            variant="pill"
            value={priorityFilter}
            onChange={(v) => setPriorityFilter(v as typeof priorityFilter)}
            aria-label="优先级筛选"
            options={[
              { value: 'all', label: '优先级: 全部' },
              { value: '高', label: '高' },
              { value: '中', label: '中' },
              { value: '低', label: '低' },
            ]}
          />

          <button
            onClick={() => {
              if (events.length === 0) {
                show('当前月份暂无日程可导出');
                return;
              }
              exportICS(events, `slpm-日程-${monthStr}.ics`);
              show(`已导出 ${events.length} 条日程为 ICS（可导入 Outlook/Apple/Google 日历）`);
            }}
            disabled={events.length === 0}
            className="h-9 px-3 rounded-full liquid-btn-ghost text-[12px] text-white/60 flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40"
            title="导出当前月份日程为 ICS"
          >
            <Download className="w-3.5 h-3.5" />
            导出 ICS
          </button>

          <button
            onClick={() => openCreate()}
            className="h-9 px-3.5 rounded-full liquid-btn-primary text-[12px] font-bold flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            预约新日程
          </button>
        </div>
      </div>

      {/* 主体：通高下对齐 */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-3.5 items-stretch">
        <GlassCard className="p-4 sm:p-5 flex flex-col min-h-0 h-full overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] shrink-0 gap-2 flex-nowrap">
            <div className="text-[13px] font-bold text-white whitespace-nowrap">
              {monthLabel}
              <span className="text-white/35 font-medium ml-2 text-[11px]">
                · {view === 'month' ? '月视图' : view === 'week' ? '周视图' : '日视图'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-white/50 shrink-0">
              <button onClick={() => shiftMonth(-1)} className="p-1.5 rounded-lg hover:bg-white/5 hover:text-white" title="上一月">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={goToday} className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-semibold border border-emerald-400/30">
                今天
              </button>
              <button onClick={() => shiftMonth(1)} className="p-1.5 rounded-lg hover:bg-white/5 hover:text-white" title="下一月">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 pt-3 overflow-hidden">
            <ViewTransition viewKey={view} direction={viewDir} className="h-full min-h-0 overflow-auto">
              {view === 'month' ? (
                <MonthView
                  year={cursor.year}
                  month={cursor.month}
                  selectedDate={selectedDate}
                  events={filteredEvents}
                  onSelectDay={(d) => setSelectedDate(d)}
                  onDayDoubleCreate={(d) => openCreate(d)}
                />
              ) : view === 'week' ? (
                <WeekView selectedDate={selectedDate} events={filteredEvents} onSelectDay={(d) => setSelectedDate(d)} onSelectEvent={openEdit} />
              ) : (
                <DayView selectedDate={selectedDate} events={dayEvents} onSelectEvent={openEdit} onEmptySlot={(hour) => {
                  setForm((f) => ({ ...f, startInput: `${selectedDate}T${String(hour).padStart(2, '0')}:00`, endInput: `${selectedDate}T${String(hour + 1).padStart(2, '0')}:00` }));
                  setEditing(null);
                  setShowCreate(true);
                }} />
              )}
            </ViewTransition>
          </div>
        </GlassCard>

        {/* 右侧详情 — 通高，底对齐操作 */}
        <GlassCard className="p-4 sm:p-5 flex flex-col min-h-0 h-full overflow-hidden">
          <div className="flex items-center justify-between shrink-0 pb-3 border-b border-white/[0.06]">
            <h3 className="text-[13px] font-bold text-white">{selectedDate.replace(/-/g, '/')} · 日程</h3>
            <span className="text-[11px] text-emerald-300 font-mono">{dayEvents.length} 项</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 py-3">
            <ViewTransition viewKey={selectedDate} className="space-y-2.5">
              {dayEvents.length === 0 && (
                <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-[12px] text-white/35 gap-3">
                  <p>当日暂无日程</p>
                  <button onClick={() => openCreate(selectedDate)} className="h-9 px-3 rounded-full liquid-btn-ghost text-[11px] text-white/60">
                    + 在此日预约
                  </button>
                </div>
              )}
              {dayEvents.map((evt) => (
                <div key={evt.id} className="p-3 rounded-2xl bg-black/25 border border-white/[0.06] space-y-2 relative group">
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => openEdit(evt)} className="text-left min-w-0">
                      <div className="text-[12px] font-bold text-white leading-snug">{evt.title}</div>
                      <div className="text-[10px] text-white/35 mt-0.5">{evt.status}</div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-400/25">
                        {evt.priority}
                      </span>
                      <button onClick={() => setMenuId(menuId === evt.id ? null : evt.id)} className="p-1 rounded-lg text-white/35 hover:text-white hover:bg-white/5">
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] text-white/45 space-y-1">
                    <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-emerald-300" />{fmtRange(evt.startTime, evt.endTime)}</div>
                    {evt.location && <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-white/30" />{evt.location}</div>}
                    {evt.attendees.length > 0 && <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-white/30" />{evt.attendees.join('、')}</div>}
                  </div>
                  <AnimatePresence>
                    {menuId === evt.id && (
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        className="absolute right-2 top-10 z-20 p-1 liquid-glass min-w-[120px]"
                      >
                        <button onClick={() => openEdit(evt)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] text-white/70 hover:bg-white/5">
                          <Pencil className="w-3 h-3" /> 编辑
                        </button>
                        <button onClick={() => deleteEvent(evt)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] text-rose-300 hover:bg-rose-500/10">
                          <Trash2 className="w-3 h-3" /> 删除
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </ViewTransition>
          </div>

          <div className="pt-3 mt-auto border-t border-white/[0.06] shrink-0 flex gap-2">
            <button onClick={() => openCreate(selectedDate)} className="flex-1 h-10 rounded-full liquid-btn-primary text-[12px] font-bold flex items-center justify-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              预约新日程
            </button>
          </div>
        </GlassCard>
      </div>

      {/* 预约/编辑 — 液态玻璃弹窗 */}
      <LiquidModal
        open={showCreate}
        onClose={() => { setShowCreate(false); setEditing(null); }}
        title={editing ? '编辑日程' : '预约新日程'}
        subtitle={editing ? `ID · ${editing.id}` : '高效排期 · 冲突预警'}
        icon={<CalendarIcon className="w-5 h-5" />}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => { setShowCreate(false); setEditing(null); }} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">
              取消
            </button>
            <button type="submit" form="schedule-form" disabled={createMut.isPending || updateMut.isPending} className="h-10 px-5 rounded-full liquid-btn-primary text-[12px] font-bold disabled:opacity-60">
              {editing ? '保存修改' : '确认创建'}
            </button>
          </div>
        }
      >
        <form id="schedule-form" onSubmit={handleSave} className="space-y-3.5">
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block">会议主题 <span className="text-emerald-300">*</span></label>
            <input required className={field} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="请输入会议主题" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-white/40 mb-1.5 block">开始时间</label>
              <input type="datetime-local" className={`${field} [color-scheme:dark]`} value={form.startInput} onChange={(e) => setForm({ ...form, startInput: e.target.value })} />
            </div>
            <div>
              <label className="text-[11px] text-white/40 mb-1.5 block">结束时间</label>
              <input type="datetime-local" className={`${field} [color-scheme:dark]`} value={form.endInput} onChange={(e) => setForm({ ...form, endInput: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-white/40 mb-1.5 block">地点 / 会议室</label>
            <input className={field} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-white/40 mb-1.5 block">优先级</label>
              <LiquidSelect
                value={form.priority}
                onChange={(v) => setForm({ ...form, priority: v as '高' | '中' | '低' })}
                options={[{ value: '高', label: '高' }, { value: '中', label: '中' }, { value: '低', label: '低' }]}
              />
            </div>
            <div>
              <label className="text-[11px] text-white/40 mb-1.5 block">参会人（逗号分隔）</label>
              <input className={field} value={form.attendees} onChange={(e) => setForm({ ...form, attendees: e.target.value })} />
            </div>
          </div>
        </form>
      </LiquidModal>
    </div>
  );
};

// ---- 工具：格式化时间范围 ----
function fmtHM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function fmtRange(start: string, end: string): string {
  return `${fmtHM(start)} - ${fmtHM(end)}`;
}

// ============ 月视图（真实日历，任意年月） ============
function MonthView({
  year, month, selectedDate, events, onSelectDay, onDayDoubleCreate,
}: {
  year: number; month: number; selectedDate: string;
  events: ApiEvent[]; onSelectDay: (d: string) => void; onDayDoubleCreate: (d: string) => void;
}) {
  const total = daysInMonth(year, month);
  const pad = firstDayWeekday(year, month);
  const cells: (number | null)[] = [...Array.from({ length: pad }, () => null), ...Array.from({ length: total }, (_, i) => i + 1)];

  const todayStr = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  })();

  return (
    <div className="h-full min-h-[420px] flex flex-col">
      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-white/40 pb-2 shrink-0">
        {WEEKDAY_LABELS.map((d, i) => (
          <div key={d} className={i >= 5 ? 'text-emerald-300/70' : ''}>{`周${d}`}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 flex-1 auto-rows-fr min-h-0">
        {cells.map((dayNum, idx) => {
          if (dayNum == null) return <div key={`e-${idx}`} className="rounded-xl bg-transparent" />;
          const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayStr;
          const dayEvts = events.filter((e) => e.startTime.slice(0, 10) === dateStr);
          return (
            <button
              key={dayNum}
              onClick={() => onSelectDay(dateStr)}
              onDoubleClick={() => onDayDoubleCreate(dateStr)}
              className={`min-h-[72px] rounded-xl p-2 border text-left flex flex-col gap-1 transition-all ${
                isSelected
                  ? 'bg-emerald-950/45 border-emerald-500/55 shadow-[0_0_16px_rgba(16,185,129,0.18)]'
                  : 'bg-black/20 border-white/[0.05] hover:border-emerald-500/35'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-mono text-[12px] font-bold ${isToday || isSelected ? 'text-emerald-300' : 'text-white/70'}`}>
                  {dayNum}
                </span>
                {isToday && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              </div>
              <div className="space-y-0.5 min-h-0 overflow-hidden flex-1">
                {dayEvts.slice(0, 2).map((e) => (
                  <div key={e.id} className="px-1 py-0.5 rounded text-[9px] truncate bg-emerald-500/15 text-emerald-200 border border-emerald-400/20">
                    {e.title}
                  </div>
                ))}
                {dayEvts.length > 2 && <div className="text-[9px] text-white/30">+{dayEvts.length - 2}</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============ 周视图（基于选中日期所在周） ============
function WeekView({
  selectedDate, events, onSelectDay, onSelectEvent,
}: {
  selectedDate: string; events: ApiEvent[];
  onSelectDay: (d: string) => void; onSelectEvent: (e: ApiEvent) => void;
}) {
  const HOURS = Array.from({ length: 12 }, (_, i) => i + 8);
  // 选中日期所在周的周一~周日
  const base = new Date(selectedDate);
  const wd = (base.getDay() + 6) % 7; // 周一=0
  const monday = new Date(base);
  monday.setDate(base.getDate() - wd);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  return (
    <div className="h-full min-h-[420px] overflow-auto">
      <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] gap-1 min-w-[640px]">
        <div />
        {weekDays.map((dStr, i) => {
          const dayNum = Number(dStr.slice(8));
          return (
            <button
              key={dStr}
              onClick={() => onSelectDay(dStr)}
              className={`text-center py-2 rounded-xl text-[11px] font-semibold border ${
                selectedDate === dStr
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                  : 'text-white/45 border-transparent hover:bg-white/[0.03]'
              }`}
            >
              <div>周{WEEKDAY_LABELS[i]}</div>
              <div className="font-mono text-[13px] mt-0.5">{dayNum}</div>
            </button>
          );
        })}
        {HOURS.map((hour) => (
          <React.Fragment key={hour}>
            <div className="text-[10px] font-mono text-white/30 py-2 pr-1 text-right">{String(hour).padStart(2, '0')}:00</div>
            {weekDays.map((dStr) => {
              const cellEvents = events.filter((e) => e.startTime.slice(0, 13) === `${dStr}T${String(hour).padStart(2, '0')}`);
              return (
                <div key={`${dStr}-${hour}`} className="min-h-[44px] border border-white/[0.04] rounded-lg bg-black/15 p-0.5">
                  {cellEvents.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => onSelectEvent(e)}
                      className="w-full text-left px-1.5 py-1 rounded-md text-[9px] bg-emerald-500/20 text-emerald-100 border border-emerald-400/25 truncate hover:brightness-110"
                    >
                      {e.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ============ 日视图 ============
function DayView({
  selectedDate, events, onSelectEvent, onEmptySlot,
}: {
  selectedDate: string; events: ApiEvent[];
  onSelectEvent: (e: ApiEvent) => void; onEmptySlot: (hour: number) => void;
}) {
  const HOURS = Array.from({ length: 12 }, (_, i) => i + 8);
  return (
    <div className="h-full min-h-[420px] space-y-1 overflow-auto">
      <div className="text-[12px] text-white/40 mb-2">{selectedDate.replace(/-/g, '/')} · 时间轴（点击空白时段可预约）</div>
      {HOURS.map((hour) => {
        const slotEvents = events.filter((e) => new Date(e.startTime).getHours() === hour);
        return (
          <div key={hour} className="grid grid-cols-[56px_1fr] gap-2 items-stretch min-h-[52px]">
            <div className="text-[11px] font-mono text-white/35 pt-2 text-right">{String(hour).padStart(2, '0')}:00</div>
            <button
              type="button"
              onClick={() => { if (slotEvents.length === 0) onEmptySlot(hour); }}
              className="rounded-xl border border-white/[0.05] bg-black/20 p-1.5 text-left hover:border-emerald-400/30 transition-colors min-h-[52px]"
            >
              {slotEvents.length === 0 && <span className="text-[10px] text-white/20 px-2">空闲 · 点击预约</span>}
              {slotEvents.map((e) => (
                <div
                  key={e.id}
                  onClick={(ev) => { ev.stopPropagation(); onSelectEvent(e); }}
                  className="px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500/25 to-teal-500/15 border border-emerald-400/30 mb-1 last:mb-0 cursor-pointer"
                >
                  <div className="text-[12px] font-semibold text-white">{e.title}</div>
                  <div className="text-[10px] text-white/45 mt-0.5">{fmtRange(e.startTime, e.endTime)}{e.location ? ` · ${e.location}` : ''}</div>
                </div>
              ))}
            </button>
          </div>
        );
      })}
    </div>
  );
}
