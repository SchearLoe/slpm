import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  AlertTriangle,
  Repeat,
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
  const { data: events = [], isLoading: eventsLoading, isError: eventsError, refetch: refetchEvents } = useSchedules(monthStr);

  const [selectedDate, setSelectedDate] = useState<string>(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
  );
  const [priorityFilter, setPriorityFilter] = useState<'all' | '高' | '中' | '低'>('all');
  const [showCreate, setShowCreate] = useState(false);
  // P9-UX3：从 TopBar「预约日程」带 ?action=new 进来时，自动打开创建弹窗
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setShowCreate(true);
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [editing, setEditing] = useState<ApiEvent | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  // P8：删除二次确认（替代"点删即删"）
  const [pendingDelete, setPendingDelete] = useState<ApiEvent | null>(null);

  // 表单：用 datetime-local 字符串（YYYY-MM-DDTHH:mm）
  const emptyForm = () => ({
    title: '',
    startInput: `${selectedDate}T10:00`,
    endInput: `${selectedDate}T11:00`,
    // P9-UX4：去掉假默认地点（原硬编码"线上会议室 Alpha"会污染每条新建日程）
    location: '',
    priority: '高' as '高' | '中' | '低',
    attendees: '',
    // P11-3：周期性日程
    recurrence: 'none' as 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly',
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
      location: '',
      priority: '高',
      attendees: '',
      recurrence: 'none',
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
      // P11-3：周期性日程模板（虚拟场次的 id 带 #日期后缀，操作时剥离）
      recurrence: evt.recurrence ?? 'none',
    });
    setShowCreate(true);
    setMenuId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      show('请填写日程标题', 'warning');
      return;
    }
    // P9-UX4：结束时间必须晚于开始时间（原仅校验标题，可创建倒序日程）
    if (new Date(form.endInput) <= new Date(form.startInput)) {
      show('结束时间必须晚于开始时间', 'warning');
      return;
    }
    const payload = {
      title: form.title.trim(),
      startTime: new Date(form.startInput).toISOString(),
      endTime: new Date(form.endInput).toISOString(),
      location: form.location,
      priority: form.priority,
      attendees: form.attendees.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
      status: editing?.status ?? ('待开始' as const),
      recurrence: form.recurrence, // P11-3
    };
    // P11-3：编辑周期性虚拟场次 → 操作的是系列模板（剥离 #日期后缀）
    const realId = editing ? editing.id.split('#')[0] : null;
    try {
      if (editing) {
        const r = await updateMut.mutateAsync({ id: realId!, ...payload });
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
    // P11-3：周期性场次删除的是整个系列模板
    const id = pendingDelete.id.split('#')[0];
    try {
      await deleteMut.mutateAsync(id);
      show(pendingDelete.recurrence && pendingDelete.recurrence !== 'none' ? '周期性日程系列已删除' : '日程已删除');
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
        description={pendingDelete ? `「${pendingDelete.title}」将被删除${pendingDelete.recurrence && pendingDelete.recurrence !== 'none' ? '（含所有重复场次）' : ''}，该操作不可恢复。` : ''}
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
              {/* P9-UX：加载中骨架，避免误显示"当日暂无日程"的假空态 */}
              {eventsLoading && (
                <div className="space-y-2.5">
                  {[0,1,2].map(i => <div key={i} className="h-14 rounded-xl bg-white/[0.04] border border-white/[0.05] animate-pulse" />)}
                </div>
              )}
              {dayEvents.length === 0 && !eventsLoading && (
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
            {/* P11-3：周期性日程 */}
            <div>
              <label className="text-[11px] text-white/40 mb-1.5 block">重复</label>
              <LiquidSelect
                value={form.recurrence}
                onChange={(v) => setForm({ ...form, recurrence: v as typeof form.recurrence })}
                options={[
                  { value: 'none', label: '不重复' },
                  { value: 'daily', label: '每天' },
                  { value: 'weekly', label: '每周' },
                  { value: 'biweekly', label: '每两周' },
                  { value: 'monthly', label: '每月' },
                ]}
              />
              {form.recurrence !== 'none' && (
                <p className="text-[10px] text-emerald-300/70 mt-1.5">
                  将按所选周期在日历中自动重复出现；编辑或删除任一场次会作用于整个系列
                </p>
              )}
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
                  <div key={e.id} className="px-1 py-0.5 rounded text-[9px] truncate bg-emerald-500/15 text-emerald-200 border border-emerald-400/20 flex items-center gap-0.5">
                    {e.recurrence && e.recurrence !== 'none' && <Repeat className="w-2 h-2 shrink-0 opacity-70" />}
                    <span className="truncate">{e.title}</span>
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

// ============ 周视图（基于选中日期所在周，含冲突高亮） ============
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

  // P10-5：按天分组，检测时间重叠的冲突事件（同一天内 startA < endB && startB < endA）
  const conflictIds = useMemo(() => {
    const ids = new Set<string>();
    for (const dStr of weekDays) {
      const dayEvents = events.filter((e) => e.startTime.slice(0, 10) === dStr);
      for (let i = 0; i < dayEvents.length; i++) {
        for (let j = i + 1; j < dayEvents.length; j++) {
          const a = dayEvents[i], b = dayEvents[j];
          if (new Date(a.startTime) < new Date(b.endTime) && new Date(b.startTime) < new Date(a.endTime)) {
            ids.add(a.id);
            ids.add(b.id);
          }
        }
      }
    }
    return ids;
  }, [events, weekDays.join()]);

  // P11-2c：当前时刻（今天日期串 / 分钟数 / 是否当前小时）
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isCurrentHour = (hour: number) => now.getHours() === hour;

  return (
    <div className="h-full min-h-[420px] overflow-auto">
      {/* P10-5：冲突图例 */}
      {conflictIds.size > 0 && (
        <div className="mb-2 flex items-center gap-1.5 text-[10.5px] text-rose-300/80">
          <AlertTriangle className="w-3.5 h-3.5" />
          本周有 {conflictIds.size} 个日程时间冲突（红色标记），建议调整
        </div>
      )}
      <div className="grid grid-cols-[52px_repeat(7,minmax(0,1fr))] gap-1 min-w-[640px]">
        <div />
        {weekDays.map((dStr, i) => {
          const dayNum = Number(dStr.slice(8));
          const dayHasConflict = events.some((e) => e.startTime.slice(0, 10) === dStr && conflictIds.has(e.id));
          const isToday = dStr === todayStr;
          return (
            <button
              key={dStr}
              onClick={() => onSelectDay(dStr)}
              className={`text-center py-2 rounded-xl text-[11px] font-semibold border ${
                selectedDate === dStr
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                  : isToday
                    ? 'text-emerald-200 border-emerald-400/25 bg-emerald-400/[0.06]'
                    : 'text-white/45 border-transparent hover:bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <span>周{WEEKDAY_LABELS[i]}</span>
                {dayHasConflict && <AlertTriangle className="w-3 h-3 text-rose-400/80" />}
                {isToday && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              </div>
              <div className="font-mono text-[13px] mt-0.5">{dayNum}</div>
            </button>
          );
        })}
        {HOURS.map((hour) => (
          <React.Fragment key={hour}>
            <div className={`text-[10px] font-mono py-2 pr-1 text-right ${isCurrentHour(hour) ? 'text-rose-300 font-bold' : 'text-white/30'}`}>
              {String(hour).padStart(2, '0')}:00
            </div>
            {weekDays.map((dStr) => {
              const cellEvents = events.filter((e) => e.startTime.slice(0, 13) === `${dStr}T${String(hour).padStart(2, '0')}`);
              const cellConflict = cellEvents.some((e) => conflictIds.has(e.id));
              // P11-2c：今天当前小时格内画「现在」红线（按分钟比例定位）
              const showNow = dStr === todayStr && isCurrentHour(hour);
              return (
                <div
                  key={`${dStr}-${hour}`}
                  className={`relative min-h-[44px] border rounded-lg p-0.5 ${
                    cellConflict
                      ? 'border-rose-400/30 bg-rose-500/[0.06]'
                      : dStr === todayStr
                        ? 'border-emerald-400/15 bg-emerald-400/[0.02]'
                        : 'border-white/[0.04] bg-black/15'
                  }`}
                >
                  {showNow && (
                    <div
                      className="absolute left-1 right-1 h-[2px] rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)] pointer-events-none z-10"
                      style={{ top: `${(nowMinutes / 60) * 100}%` }}
                    >
                      <span className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.9)]" />
                      <span className="absolute right-0 -top-[16px] text-[8px] font-bold text-rose-300 bg-black/60 px-1 rounded">现在</span>
                    </div>
                  )}
                  {cellEvents.map((e) => {
                    const conflicted = conflictIds.has(e.id);
                    return (
                      <button
                        key={e.id}
                        onClick={() => onSelectEvent(e)}
                        title={conflicted ? `⚠ 时间冲突：${fmtRange(e.startTime, e.endTime)}` : fmtRange(e.startTime, e.endTime)}
                        className={`w-full text-left px-1.5 py-1 rounded-md text-[9px] truncate hover:brightness-110 flex items-center gap-0.5 ${
                          conflicted
                            ? 'bg-rose-500/25 text-rose-100 border border-rose-400/40'
                            : 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/25'
                        }`}
                      >
                        {conflicted && <AlertTriangle className="w-2.5 h-2.5 shrink-0" />}
                        {e.recurrence && e.recurrence !== 'none' && <Repeat className="w-2.5 h-2.5 shrink-0 opacity-60" />}
                        <span className="truncate">{e.title}</span>
                      </button>
                    );
                  })}
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
  // P11-2c：现在线（仅当选中的就是今天）
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isToday = selectedDate === todayStr;
  const nowHour = now.getHours();
  const nowMin = now.getMinutes();
  return (
    <div className="h-full min-h-[420px] space-y-1 overflow-auto">
      <div className="text-[12px] text-white/40 mb-2">{selectedDate.replace(/-/g, '/')} · 时间轴（点击空白时段可预约）</div>
      {HOURS.map((hour) => {
        const slotEvents = events.filter((e) => new Date(e.startTime).getHours() === hour);
        const isCurrent = isToday && nowHour === hour;
        return (
          <div key={hour} className="grid grid-cols-[56px_1fr] gap-2 items-stretch min-h-[52px]">
            <div className={`text-[11px] font-mono pt-2 text-right ${isCurrent ? 'text-rose-300 font-bold' : 'text-white/35'}`}>{String(hour).padStart(2, '0')}:00</div>
            <button
              type="button"
              onClick={() => { if (slotEvents.length === 0) onEmptySlot(hour); }}
              className={`relative rounded-xl border p-1.5 text-left transition-colors min-h-[52px] ${
                isCurrent
                  ? 'border-rose-400/25 bg-rose-500/[0.04] hover:border-rose-400/40'
                  : 'border-white/[0.05] bg-black/20 hover:border-emerald-400/30'
              }`}
            >
              {isCurrent && (
                <div
                  className="absolute left-2 right-2 h-[2px] rounded-full bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.8)] pointer-events-none z-10"
                  style={{ top: `${(nowMin / 60) * 100}%` }}
                >
                  <span className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]" />
                  <span className="absolute right-0 -top-[17px] text-[9px] font-bold text-rose-300 bg-black/60 px-1.5 rounded">现在 {String(nowHour).padStart(2, '0')}:{String(nowMin).padStart(2, '0')}</span>
                </div>
              )}
              {slotEvents.length === 0 && <span className="text-[10px] text-white/20 px-2">空闲 · 点击预约</span>}
              {slotEvents.map((e) => (
                <div
                  key={e.id}
                  onClick={(ev) => { ev.stopPropagation(); onSelectEvent(e); }}
                  className="px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500/25 to-teal-500/15 border border-emerald-400/30 mb-1 last:mb-0 cursor-pointer"
                >
                  <div className="text-[12px] font-semibold text-white flex items-center gap-1">
                    {e.recurrence && e.recurrence !== 'none' && (
                      <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded bg-white/10 text-[8px] font-bold text-white/60 shrink-0">
                        <Repeat className="w-2 h-2" />{{ daily: '每天', weekly: '每周', biweekly: '双周', monthly: '每月' }[e.recurrence]}
                      </span>
                    )}
                    <span className="truncate">{e.title}</span>
                  </div>
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
