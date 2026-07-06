import React, { useState, useEffect } from 'react';
import { CalendarDays, Clock, ChevronLeft, ChevronRight, CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { CalendarEvent } from '../../hooks/useCalendar';
import { CheckBox } from '../ui/checkbox';
import EmptyState from '../ui/EmptyState';

const PRIORITY_COLORS = [
  "#1D2A44", // Priority 1 (Default)
  "#0E86D4", // Priority 2 (neoBlue)
  "#FBBF24", // Priority 3 (neoYellow)
  "#EC4899", // Priority 4 (neoPink)
  "#FF7A00"  // Priority 5 (neoOrange)
];


interface Task {
  id: string;
  title: string;
  description: string;
  timeEstimateMinutes: number;
  dueDate: string | null;
  priority: number;
  status: string;
  category: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
}

interface CalendarViewProps {
  events: CalendarEvent[];
  tasks: Task[];
  onToggleTaskComplete: (taskId: string, currentStatus: string) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}

export default function CalendarView({ events, tasks, onToggleTaskComplete, onDeleteTask }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [weekDays, setWeekDays] = useState<Date[]>([]);
  const [currentHourLineTop, setCurrentHourLineTop] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'year'>('week');
  const [selectedItem, setSelectedItem] = useState<{
    id: string;
    title: string;
    type: 'task' | 'event';
    start: string;
    end: string;
    category: string;
    description?: string;
    timeEstimateMinutes?: number;
    status?: string;
    completed?: boolean;
  } | null>(null);

  // Deteksi resolusi mobile
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Set default activeDayIdx ke hari ini jika tanggalnya masuk dalam daftar
  useEffect(() => {
    if (weekDays.length > 0) {
      const today = new Date();
      const idx = weekDays.findIndex(d => 
        d.getDate() === today.getDate() && 
        d.getMonth() === today.getMonth() && 
        d.getFullYear() === today.getFullYear()
      );
      if (idx !== -1) {
        setActiveDayIdx(idx);
      }
    }
  }, [weekDays]);

  // Generate week days when current date changes
  useEffect(() => {
    const day = currentDate.getDay();
    const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const monday = new Date(currentDate.setDate(diff));
    
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    setWeekDays(days);
  }, [currentDate]);

  // Update current time indicator position
  useEffect(() => {
    const updateTimeLine = () => {
      const now = new Date();
      const hour = now.getHours();
      const minutes = now.getMinutes();
      
      const startHour = 8;
      const totalHours = 14; // 8:00 AM to 10:00 PM (22:00)
      
      const timeInHours = hour + minutes / 60;
      
      if (timeInHours >= startHour && timeInHours <= startHour + totalHours) {
        const topPercent = ((timeInHours - startHour) / totalHours) * 100;
        setCurrentHourLineTop(topPercent);
      } else {
        setCurrentHourLineTop(null);
      }
    };

    updateTimeLine();
    const interval = setInterval(updateTimeLine, 60000);
    return () => clearInterval(interval);
  }, []);

  const handlePrev = () => {
    const prev = new Date(currentDate);
    if (viewMode === 'day') {
      prev.setDate(prev.getDate() - 1);
    } else if (viewMode === 'week') {
      prev.setDate(prev.getDate() - 7);
    } else if (viewMode === 'month') {
      prev.setMonth(prev.getMonth() - 1);
    } else if (viewMode === 'year') {
      prev.setFullYear(prev.getFullYear() - 1);
    }
    setCurrentDate(prev);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'day') {
      next.setDate(next.getDate() + 1);
    } else if (viewMode === 'week') {
      next.setDate(next.getDate() + 7);
    } else if (viewMode === 'month') {
      next.setMonth(next.getMonth() + 1);
    } else if (viewMode === 'year') {
      next.setFullYear(next.getFullYear() + 1);
    }
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Format date range for header based on viewMode
  const getDateRangeString = () => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    if (viewMode === 'week') {
      if (weekDays.length === 0) return '';
      const first = weekDays[0];
      const last = weekDays[6];
      const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      const yearOptions: Intl.DateTimeFormatOptions = { year: 'numeric' };
      
      if (first.getMonth() === last.getMonth()) {
        return `${first.toLocaleDateString('id-ID', { month: 'long' })} ${first.getDate()} — ${last.getDate()}, ${first.toLocaleDateString('id-ID', yearOptions)}`;
      }
      return `${first.toLocaleDateString('id-ID', options)} — ${last.toLocaleDateString('id-ID', options)}, ${last.toLocaleDateString('id-ID', yearOptions)}`;
    }
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric',
      });
    }
    // year
    return currentDate.toLocaleDateString('id-ID', {
      year: 'numeric',
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const isSameDay = (date1Str: string, date2: Date) => {
    const d1 = new Date(date1Str);
    return d1.getDate() === date2.getDate() &&
      d1.getMonth() === date2.getMonth() &&
      d1.getFullYear() === date2.getFullYear();
  };

  // Calendar math functions
  const startHour = 8;
  const totalHours = 14;

  const getEventPositionProps = (startTimeStr: string, endTimeStr: string) => {
    const start = new Date(startTimeStr);
    const end = new Date(endTimeStr);
    
    const startVal = start.getHours() + start.getMinutes() / 60;
    const endVal = end.getHours() + end.getMinutes() / 60;
    
    // Bounds check
    const displayStart = Math.max(startHour, startVal);
    const displayEnd = Math.min(startHour + totalHours, endVal);
    
    if (displayStart >= startHour + totalHours || displayEnd <= startHour) {
      return null; // completely out of bounds
    }
    
    const top = ((displayStart - startHour) / totalHours) * 100;
    const height = ((displayEnd - displayStart) / totalHours) * 100;
    
    return { top: `${top}%`, height: `${height}%` };
  };

  // Generate 1 hour row labels
  const hourLabels: string[] = [];
  for (let i = 0; i < totalHours; i++) {
    const hr = startHour + i;
    const ampm = hr >= 12 ? 'PM' : 'AM';
    const displayHr = hr > 12 ? hr - 12 : hr;
    hourLabels.push(`${displayHr}:00 ${ampm}`);
  }

  const getMonthDaysGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    let startDayOfWeek = firstDay.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Mon is 0
    
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevMonthTotalDays = new Date(year, month, 0).getDate();
    
    const gridDays: Date[] = [];
    
    // Add padding days from previous month
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      gridDays.push(new Date(year, month - 1, prevMonthTotalDays - i));
    }
    
    // Add active month days
    for (let i = 1; i <= totalDays; i++) {
      gridDays.push(new Date(year, month, i));
    }
    
    // Add padding days from next month
    const remaining = gridDays.length % 7;
    if (remaining > 0) {
      const padding = 7 - remaining;
      for (let i = 1; i <= padding; i++) {
        gridDays.push(new Date(year, month + 1, i));
      }
    }
    
    return gridDays;
  };

  const renderDayView = () => {
    const day = currentDate;
    const dayTasks = tasks.filter(t => t.dueDate && isSameDay(t.dueDate, day));
    const dayEvents = events.filter(e => e.startTime && isSameDay(e.startTime, day));
    
    const unscheduledTasks = dayTasks.filter(t => !t.scheduledStart);
    const scheduledTasks = dayTasks.filter(t => t.scheduledStart && t.scheduledEnd);
    const isDayToday = isToday(day);

    return (
      <div className="flex flex-col items-center gap-4 w-full">
        {/* Weekday Selector Bar (Desktop & Tablet) */}
        <div className="flex overflow-x-auto scrollbar-none flex-nowrap md:justify-center gap-2 bg-neoCream border-2 border-black p-1.5 rounded-2xl shadow-neo-sm max-w-[800px] w-full py-2">
          {weekDays.map((d, idx) => {
            const isSelected = d.getDate() === currentDate.getDate() && 
                             d.getMonth() === currentDate.getMonth() && 
                             d.getFullYear() === currentDate.getFullYear();
            const isDayToday = isToday(d);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentDate(d)}
                className={`flex flex-col items-center p-2 rounded-xl border-2 border-black flex-1 min-w-[50px] shrink-0 transition-all cursor-pointer shadow-neo-sm ${
                  isSelected 
                    ? 'bg-neoYellow text-black translate-y-[1px] shadow-none' 
                    : isDayToday ? 'bg-neoYellow/20 text-black' : 'bg-white text-black hover:bg-neoCream'
                }`}
              >
                <span className="text-[11px] font-black uppercase text-black/50">{d.toLocaleDateString('id-ID', { weekday: 'short' })}</span>
                <span className="text-xs font-black mt-0.5">{d.getDate()}</span>
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto w-full">
          <div className="min-w-[500px] max-w-[800px] mx-auto grid grid-cols-4 relative bg-white border-2 border-black rounded-2xl overflow-hidden shadow-neo-sm">
            
            {/* Time Labels Column */}
            <div className="col-span-1 pt-[72px] pr-4 border-r-2 border-black bg-neoCream/35 space-y-0 relative h-[700px]">
              <div className="absolute inset-0 flex flex-col justify-between pt-[72px] h-full">
                {hourLabels.map((label, idx) => (
                  <div key={idx} className="text-xxs text-black/75 font-black font-mono h-0 text-right pr-2">
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Single Day Column */}
            <div className="col-span-3 flex flex-col relative h-[700px]">
              
              {/* Column Header */}
              <div className={`flex flex-col items-center justify-center py-3 border-b-2 border-black h-[72px] ${
                isDayToday ? 'bg-neoYellow/10' : ''
              }`}>
                <span className="text-xs uppercase tracking-wider font-black text-black/60">{day.toLocaleDateString('id-ID', { weekday: 'long' })}</span>
                <span className={`text-xs font-black px-3 py-1 rounded-lg mt-1 border border-black ${
                  isDayToday ? 'bg-neoYellow text-black shadow-neo-sm border-2' : 'bg-neoCream text-black'
                }`}>
                  {day.getDate()} {day.toLocaleDateString('id-ID', { month: 'short' })}
                </span>
              </div>

              {/* Unscheduled Tasks Area */}
              <div className="bg-neoCream/10 border-b-2 border-black p-2 min-h-[60px] max-h-[120px] overflow-y-auto space-y-1.5 flex flex-col">
                {unscheduledTasks.length === 0 ? (
                  <span className="text-[10px] text-black/45 font-extrabold text-center italic mt-3.5">Bebas Tugas Sepanjang Hari</span>
                ) : (
                  unscheduledTasks.map(task => {
                    const isCompleted = task.status === 'completed';
                    return (
                      <div 
                        key={task.id} 
                        onClick={() => setSelectedItem({
                          id: task.id,
                          title: task.title,
                          type: 'task',
                          start: task.dueDate ? new Date(task.dueDate).toISOString() : '',
                          end: task.dueDate ? new Date(task.dueDate).toISOString() : '',
                          category: task.category,
                          description: task.description,
                          timeEstimateMinutes: task.timeEstimateMinutes,
                          status: task.status,
                          completed: isCompleted
                        })}
                        className={`bg-white border-2 border-black rounded-xl p-2 flex items-center justify-between shadow-neo-sm text-left transition-all cursor-pointer ${
                          isCompleted ? 'bg-neoCream opacity-60 shadow-none' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 select-none scale-95 mt-0.5"
                          >
                            <CheckBox
                              checked={isCompleted}
                              onClick={() => onToggleTaskComplete(task.id, task.status)}
                              size={20}
                              color={PRIORITY_COLORS[(task.priority - 1) || 0] || "#1D2A44"}
                              duration={0.4}
                            />
                          </div>
                          <span className={`text-xs font-black text-black truncate ${isCompleted ? 'line-through text-black/45' : ''}`}>
                            {task.title}
                          </span>
                        </div>
                        <span className="neo-badge bg-neoCream/50 text-[8px] px-1.5 py-0.5 rounded font-mono uppercase font-black scale-90 shrink-0">
                          {task.category}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Hourly Timetable Area */}
              <div className="relative flex-grow flex flex-col bg-white/50 h-[628px]">
                
                {/* Hour Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none h-full">
                  {hourLabels.map((_, idx) => (
                    <div key={idx} className="border-b border-black/10 w-full h-0"></div>
                  ))}
                </div>

                {/* Rapat Kalender */}
                {dayEvents.map(event => {
                  const pos = getEventPositionProps(event.startTime, event.endTime);
                  if (!pos) return null;

                  return (
                    <div
                      key={event.id}
                      style={{ top: pos.top, height: pos.height, minHeight: '54px' }}
                      onClick={() => setSelectedItem({
                        id: event.id,
                        title: event.title,
                        type: 'event',
                        start: event.startTime,
                        end: event.endTime,
                        category: 'Rapat Kalender',
                        description: event.description,
                        completed: false
                      })}
                      className="absolute left-2 right-2 rounded-xl bg-neoBlue border-2 border-black p-2 overflow-hidden flex flex-col justify-start text-left shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer"
                    >
                      <span className="text-xs font-black text-black truncate leading-tight mb-1">{event.title}</span>
                      <div className="flex items-center gap-1.5 text-[9px] text-black/85 font-black font-mono mt-auto">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span>
                          {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {` - `}
                          {new Date(event.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Scheduled Tasks */}
                {scheduledTasks.map(task => {
                  if (!task.scheduledStart || !task.scheduledEnd) return null;
                  const pos = getEventPositionProps(task.scheduledStart, task.scheduledEnd);
                  if (!pos) return null;

                  const isCompleted = task.status === 'completed';

                  return (
                    <div
                      key={task.id}
                      style={{ top: pos.top, height: pos.height, minHeight: '54px' }}
                      onClick={() => setSelectedItem({
                        id: task.id,
                        title: task.title,
                        type: 'task',
                        start: task.scheduledStart!,
                        end: task.scheduledEnd!,
                        category: task.category,
                        description: task.description,
                        timeEstimateMinutes: task.timeEstimateMinutes,
                        status: task.status,
                        completed: isCompleted
                      })}
                      className={`absolute left-2 right-2 rounded-xl bg-neoViolet border-2 border-black p-2 overflow-hidden flex flex-col justify-start text-left shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer ${
                        isCompleted ? 'bg-neoCream opacity-60 shadow-none translate-x-[0.5px] translate-y-[0.5px]' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className={`text-xs font-black text-black truncate leading-tight ${
                          isCompleted ? 'line-through text-black/45' : ''
                        }`}>
                          {task.title}
                        </span>
                        <span className="neo-badge bg-white text-[8px] px-1.5 py-0.5 rounded font-extrabold uppercase font-mono">
                          {task.category}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-[9px] text-black/90 font-black font-mono mt-auto">
                        <div className="flex items-center gap-1 bg-white border border-black rounded px-1.5 py-0.2">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{task.timeEstimateMinutes}m</span>
                        </div>
                        <span>
                          {new Date(task.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Red Current Time Line */}
                {isDayToday && currentHourLineTop !== null && (
                  <div 
                    style={{ top: `${currentHourLineTop}%` }}
                    className="absolute left-0 right-0 h-1 bg-neoOrange border-y border-black z-10 pointer-events-none flex items-center"
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-neoOrange border-2 border-black -ml-1.5"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const gridDays = getMonthDaysGrid();
    const weekdaysLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    const activeMonth = currentDate.getMonth();

    return (
      <div className="overflow-x-auto w-full">
        <div className="min-w-[800px] border-2 border-black rounded-2xl overflow-hidden bg-white shadow-neo-sm">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b-2 border-black bg-neoCream/35">
            {weekdaysLabels.map((lbl, idx) => (
              <div key={idx} className="py-2.5 text-center text-xs font-black text-black border-r border-black/10 last:border-r-0">
                {lbl}
              </div>
            ))}
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-7 grid-rows-5 select-none">
            {gridDays.map((day, idx) => {
              const isCurrentMonth = day.getMonth() === activeMonth;
              const isDayToday = isToday(day);
              
              const dayTasks = tasks.filter(t => t.dueDate && isSameDay(t.dueDate, day));
              const dayEvents = events.filter(e => e.startTime && isSameDay(e.startTime, day));
              const allDayItems = [
                ...dayEvents.map(e => ({ id: e.id, title: e.title, type: 'event' as const, bg: 'bg-neoBlue', event: e, task: null })),
                ...dayTasks.map(t => ({ id: t.id, title: t.title, type: 'task' as const, bg: t.status === 'completed' ? 'bg-neoCream opacity-50 line-through' : 'bg-neoViolet', event: null, task: t }))
              ];

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setCurrentDate(day);
                    setViewMode('day');
                  }}
                  className={`border-r border-b border-black/10 p-1.5 min-h-[105px] flex flex-col justify-between transition-all hover:bg-neoCream/10 cursor-pointer ${
                    isCurrentMonth ? 'bg-white' : 'bg-neoCream/20 text-black/40'
                  } ${(idx + 1) % 7 === 0 ? 'border-r-0' : ''}`}
                >
                  {/* Date number */}
                  <div className="flex justify-between items-start">
                    <span className={`text-[10px] font-black w-6 h-6 rounded flex items-center justify-center border ${
                      isDayToday 
                        ? 'bg-neoYellow border-black font-black shadow-[1px_1px_0px_#000] text-black' 
                        : isCurrentMonth ? 'border-transparent text-black' : 'border-transparent text-black/35'
                    }`}>
                      {day.getDate()}
                    </span>
                    {allDayItems.length > 0 && (
                      <span className="text-[8px] font-bold text-black/40 px-1 bg-neoCream/40 rounded">
                        {allDayItems.length}
                      </span>
                    )}
                  </div>

                  {/* Day events/tasks list */}
                  <div className="flex-1 mt-1.5 space-y-1 overflow-hidden max-h-[70px]">
                    {allDayItems.slice(0, 3).map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.type === 'event' && item.event) {
                            setSelectedItem({
                              id: item.event.id,
                              title: item.event.title,
                              type: 'event',
                              start: item.event.startTime,
                              end: item.event.endTime,
                              category: 'Rapat Kalender',
                              description: item.event.description,
                              completed: false
                            });
                          } else if (item.type === 'task' && item.task) {
                            setSelectedItem({
                              id: item.task.id,
                              title: item.task.title,
                              type: 'task',
                              start: item.task.scheduledStart || item.task.dueDate || '',
                              end: item.task.scheduledEnd || item.task.dueDate || '',
                              category: item.task.category,
                              description: item.task.description,
                              timeEstimateMinutes: item.task.timeEstimateMinutes,
                              status: item.task.status,
                              completed: item.task.status === 'completed'
                            });
                          }
                        }}
                        className={`text-[8.5px] font-black truncate px-1 py-0.5 rounded border border-black shadow-[1px_1px_0px_#000] text-black leading-none ${item.bg}`}
                        title={item.title}
                      >
                        {item.title}
                      </div>
                    ))}
                    {allDayItems.length > 3 && (
                      <div className="text-[7.5px] font-black text-black/50 text-center uppercase tracking-wider py-0.2 bg-neoCream/30 border border-dashed border-black/30 rounded">
                        + {allDayItems.length - 3} Lainnya
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderMiniMonth = (monthIdx: number) => {
    const year = currentDate.getFullYear();
    const firstDay = new Date(year, monthIdx, 1);
    let startDayOfWeek = firstDay.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Mon is 0
    const totalDays = new Date(year, monthIdx + 1, 0).getDate();

    const blanks = Array(startDayOfWeek).fill(null);
    const dayNumbers = Array.from({ length: totalDays }, (_, i) => i + 1);
    const totalCells = [...blanks, ...dayNumbers];

    const monthName = new Date(year, monthIdx, 1).toLocaleDateString('id-ID', { month: 'long' });

    return (
      <div 
        onClick={() => {
          const newDate = new Date(currentDate);
          newDate.setMonth(monthIdx);
          newDate.setDate(1);
          setCurrentDate(newDate);
          setViewMode('month');
        }}
        className="bg-white border-2 border-black rounded-xl p-3 shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer flex flex-col gap-2 h-full select-none"
      >
        <h4 className="text-xs font-black text-black uppercase tracking-wider border-b border-black/20 pb-1 text-center bg-neoYellow/10 py-1 border rounded-lg border-black shadow-[1px_1px_0px_#000]">
          {monthName}
        </h4>
        
        {/* Micro Grid */}
        <div className="grid grid-cols-7 gap-0.5 text-[7px] text-center font-bold">
          {['S', 'S', 'R', 'K', 'J', 'S', 'M'].map((d, i) => (
            <span key={i} className="text-black/50 font-black">{d}</span>
          ))}
          {totalCells.map((cell, idx) => {
            if (cell === null) {
              return <span key={idx} />;
            }
            
            const checkDay = new Date(year, monthIdx, cell);
            const dayTasks = tasks.filter(t => t.dueDate && isSameDay(t.dueDate, checkDay));
            const dayEvents = events.filter(e => e.startTime && isSameDay(e.startTime, checkDay));
            const hasItems = dayTasks.length > 0 || dayEvents.length > 0;
            const isDayToday = isToday(checkDay);

            return (
              <span 
                key={idx} 
                className={`w-3.5 h-3.5 mx-auto rounded flex items-center justify-center border ${
                  isDayToday ? 'bg-neoYellow border-black font-black' :
                  hasItems ? 'bg-neoViolet/20 border-neoViolet/30 text-neoViolet font-black' : 'border-transparent text-black/75'
                }`}
              >
                {cell}
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  const renderYearView = () => {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
        {Array.from({ length: 12 }).map((_, monthIdx) => (
          <div key={monthIdx}>
            {renderMiniMonth(monthIdx)}
          </div>
        ))}
      </div>
    );
  };


  return (
    <div className="bg-white border-3 border-black shadow-neo rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full flex flex-col gap-4 sm:gap-6 text-left min-w-0 overflow-hidden">
      {/* Navigator Header Kalender (Neobrutalism) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-3 border-black pb-6">
        <div className="flex items-center gap-3 text-left">
          <div className="w-10 h-10 rounded-xl bg-neoYellow border-2 border-black flex items-center justify-center shadow-neo-sm text-black">
            <CalendarDays className="w-5.5 h-5.5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-black tracking-tight">Rencana Agenda</h2>
            <p className="text-xs text-black/60 font-bold">Integrasi tugas & kalender rapat AI</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex bg-neoCream border-2 border-black rounded-xl p-1 items-center shadow-neo-sm text-xxs font-black">
            {(['day', 'week', 'month', 'year'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2 py-1 rounded-lg capitalize transition-all cursor-pointer ${
                  viewMode === mode ? 'bg-neoYellow text-black border border-black shadow-[1px_1px_0px_#000]' : 'text-black hover:bg-white'
                }`}
              >
                {mode === 'day' ? 'Hari' :
                 mode === 'week' ? 'Minggu' :
                 mode === 'month' ? 'Bulan' : 'Tahun'}
              </button>
            ))}
          </div>

          {/* Prev/Today/Next Navigation */}
          <div className="flex bg-neoCream border-2 border-black rounded-xl p-1 items-center shadow-neo-sm">
            <button
              onClick={handlePrev}
              className="p-1.5 rounded-lg text-black hover:bg-white transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="text-xs px-3 py-1.5 rounded-lg text-black font-extrabold hover:bg-white transition-all cursor-pointer"
            >
              Hari Ini
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 rounded-lg text-black hover:bg-white transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <span className="text-xs sm:text-sm font-black text-black font-heading bg-neoYellow border-2 border-black px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl shadow-neo-sm">
            {getDateRangeString()}
          </span>
        </div>
      </div>

      {/* Mobile-Friendly Agenda List or Desktop Grid */}
      {events.length === 0 && tasks.length === 0 ? (
        <div className="py-4">
          <EmptyState
            mascot="clock"
            title="Kalender Agenda Kosong"
            description="Belum ada agenda rapat atau tugas terjadwal. Hubungkan akun Google Calendar Anda atau buat tugas di menu Tugas untuk mengisi jadwal."
            ctaText="Buat Tugas Pertama 🚀"
            ctaAction={() => {
              // trigger redirection to list tab
              const listTabBtn = document.querySelector('button[title="Tasks"]') as HTMLButtonElement;
              if (listTabBtn) {
                listTabBtn.click();
              } else {
                // fallback
                window.location.reload();
              }
            }}
          />
        </div>
      ) : isMobile ? (
        <div className="flex flex-col gap-4">
          {/* Day Selector */}
          <div className="flex gap-2 overflow-x-auto flex-nowrap pb-3 pt-1.5 border-b-2 border-black scrollbar-none">
            {weekDays.map((day, idx) => {
              const active = idx === activeDayIdx;
              const isDayToday = isToday(day);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveDayIdx(idx)}
                  className={`flex flex-col items-center p-2.5 rounded-xl border-2 border-black min-w-[50px] shrink-0 transition-all cursor-pointer shadow-neo-sm ${
                    active 
                      ? 'bg-neoYellow text-black translate-y-[1px]' 
                      : isDayToday ? 'bg-neoYellow/20 text-black' : 'bg-white text-black'
                  }`}
                >
                  <span className="text-[11px] font-black uppercase text-black/50">{day.toLocaleDateString('id-ID', { weekday: 'short' })}</span>
                  <span className="text-xs font-black mt-0.5">{day.getDate()}</span>
                </button>
              );
            })}
          </div>

          {/* Agenda List of Cards */}
          {(() => {
            const activeDay = weekDays[activeDayIdx];
            if (!activeDay) return null;

            const dayTasks = tasks.filter(t => t.dueDate && isSameDay(t.dueDate, activeDay));
            const dayEvents = events.filter(e => e.startTime && isSameDay(e.startTime, activeDay));

            // Unscheduled tasks
            const unscheduledTasks = dayTasks.filter(t => !t.scheduledStart);
            // Scheduled items sorted chronologically
            const scheduledItems = [
              ...dayEvents.map(e => ({
                id: e.id,
                title: e.title,
                type: 'event',
                start: e.startTime,
                end: e.endTime,
                category: 'Rapat Kalender',
                colorClass: 'bg-neoBlue',
                completed: false,
              })),
              ...dayTasks.filter(t => t.scheduledStart && t.scheduledEnd).map(t => ({
                id: t.id,
                title: t.title,
                type: 'task',
                start: t.scheduledStart!,
                end: t.scheduledEnd!,
                category: t.category,
                colorClass: t.status === 'completed' ? 'bg-neoCream opacity-60 shadow-none' : 'bg-neoViolet',
                completed: t.status === 'completed',
              }))
            ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

            return (
              <div className="space-y-6">
                
                {/* Jam Terjadwal (Timeline) */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-black/60 flex items-center gap-1.5 mt-2">
                    <Clock className="w-3.5 h-3.5" /> Agenda Jam Terjadwal ({scheduledItems.length})
                  </h3>
                  {scheduledItems.length === 0 ? (
                    <div className="border-2 border-dashed border-black/35 rounded-xl p-8 text-center bg-neoCream/10">
                      <span className="text-[11px] text-black/45 font-extrabold italic">Tidak ada agenda terjadwal untuk hari ini.</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {scheduledItems.map((item, idx) => {
                        const isEvent = item.type === 'event';
                        const originalTask = tasks.find(t => t.id === item.id);
                        return (
                          <div 
                            key={idx}
                            onClick={() => {
                              const originalEvent = events.find(e => e.id === item.id);
                              setSelectedItem({
                                id: item.id,
                                title: item.title,
                                type: item.type as 'task' | 'event',
                                start: item.start,
                                end: item.end,
                                category: item.category,
                                description: originalTask?.description || originalEvent?.description || '',
                                timeEstimateMinutes: originalTask?.timeEstimateMinutes,
                                status: originalTask?.status,
                                completed: item.completed
                              });
                            }}
                            className={`border-2 border-black rounded-xl p-3.5 shadow-neo-sm flex items-center justify-between transition-all hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none cursor-pointer ${
                              item.colorClass
                            }`}
                          >
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-mono font-black bg-white border border-black rounded px-1.5 py-0.5 shrink-0">
                                  {new Date(item.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 bg-white/70 border border-black rounded shrink-0">
                                  {item.category === 'work' ? 'Pekerjaan' :
                                   item.category === 'personal' ? 'Pribadi' :
                                   item.category === 'health' ? 'Kesehatan' :
                                   item.category === 'education' ? 'Pendidikan' : item.category}
                                </span>
                              </div>
                              <h4 className={`text-[13px] font-black text-black truncate ${item.completed ? 'line-through text-black/45' : ''}`}>
                                {item.title}
                              </h4>
                            </div>
                            
                            {!isEvent && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="ml-4 shrink-0 select-none scale-105"
                              >
                                <CheckBox
                                  checked={item.completed}
                                  onClick={() => onToggleTaskComplete(item.id, item.completed ? 'completed' : 'pending')}
                                  size={24}
                                  color={originalTask?.priority ? PRIORITY_COLORS[originalTask.priority - 1] : "#1D2A44"}
                                  duration={0.4}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Tugas Bebas Jam (All-Day) */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-black/60 flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" /> Tugas Sepanjang Hari ({unscheduledTasks.length})
                  </h3>
                  {unscheduledTasks.length === 0 ? (
                    <div className="border-2 border-dashed border-black/35 rounded-xl p-8 text-center bg-neoCream/10">
                      <span className="text-[11px] text-black/45 font-extrabold italic">Bebas tugas alokasi sepanjang hari.</span>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {unscheduledTasks.map(task => {
                        const isCompleted = task.status === 'completed';
                        return (
                          <div 
                            key={task.id}
                            onClick={() => setSelectedItem({
                              id: task.id,
                              title: task.title,
                              type: 'task',
                              start: task.dueDate ? new Date(task.dueDate).toISOString() : '',
                              end: task.dueDate ? new Date(task.dueDate).toISOString() : '',
                              category: task.category,
                              description: task.description,
                              timeEstimateMinutes: task.timeEstimateMinutes,
                              status: task.status,
                              completed: isCompleted
                            })}
                            className={`border-2 border-black rounded-lg p-3.5 bg-white shadow-neo-sm flex items-center justify-between transition-all hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none cursor-pointer ${
                              isCompleted ? 'bg-neoCream opacity-60' : ''
                            }`}
                          >
                            <span className={`text-[13px] font-black text-black truncate flex-1 ${isCompleted ? 'line-through text-black/45' : ''}`}>
                              {task.title}
                            </span>
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="ml-4 shrink-0 select-none scale-100"
                            >
                              <CheckBox
                                checked={isCompleted}
                                onClick={() => onToggleTaskComplete(task.id, task.status)}
                                size={22}
                                color={PRIORITY_COLORS[(task.priority - 1) || 0] || "#1D2A44"}
                                duration={0.4}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            );
          })()}

        </div>
      ) : (
        viewMode === 'day' ? (
          renderDayView()
        ) : viewMode === 'week' ? (
          <div className="overflow-x-auto w-full">
            <div className="min-w-[800px] grid grid-cols-8 relative bg-white border-2 border-black rounded-2xl overflow-hidden shadow-neo-sm">
            
            {/* Time Labels Column (Column 0) */}
            <div className="col-span-1 pt-[72px] pr-4 border-r-2 border-black bg-neoCream/35 space-y-0 relative" style={{ height: '700px' }}>
              <div className="absolute inset-0 flex flex-col justify-between pt-[72px]" style={{ height: '100%' }}>
                {hourLabels.map((label, idx) => (
                  <div key={idx} className="text-xxs text-black/75 font-black font-mono h-0 text-right pr-2">
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* 7 Days Columns */}
            <div className="col-span-7 grid grid-cols-7 relative">
              
              {/* Hour Rows Lines drawn in background */}
              <div className="absolute inset-0 flex flex-col justify-between pt-[72px] pointer-events-none" style={{ height: '100%' }}>
                {hourLabels.map((_, idx) => (
                  <div key={idx} className="border-b border-black/10 w-full h-0"></div>
                ))}
              </div>

              {/* Grid Columns for each day */}
              {weekDays.map((day, dayIdx) => {
                const dayTasks = tasks.filter(t => t.dueDate && isSameDay(t.dueDate, day));
                const dayEvents = events.filter(e => e.startTime && isSameDay(e.startTime, day));

                // Filter unscheduled tasks for top section (only due today, but not scheduled hourly)
                const unscheduledTasks = dayTasks.filter(t => !t.scheduledStart);
                // Filter scheduled tasks for timeline
                const scheduledTasks = dayTasks.filter(t => t.scheduledStart && t.scheduledEnd);

                const isDayToday = isToday(day);

                return (
                  <div key={dayIdx} className={`border-r-2 border-black/10 flex flex-col relative ${dayIdx === 6 ? 'border-r-0' : ''}`}>
                    
                    {/* Column Header */}
                    <div className={`flex flex-col items-center py-3 border-b-2 border-black ${
                      isDayToday ? 'bg-neoYellow/10' : ''
                    }`} style={{ height: '72px' }}>
                      <span className="text-xxs uppercase tracking-wider font-black text-black/60">{day.toLocaleDateString('id-ID', { weekday: 'short' })}</span>
                      <span className={`text-sm font-black w-8 h-8 rounded-lg flex items-center justify-center mt-1 border border-black ${
                        isDayToday 
                          ? 'bg-neoYellow text-black shadow-neo-sm border-2' 
                          : 'bg-neoCream text-black'
                      }`}>
                        {day.getDate()}
                      </span>
                    </div>

                    {/* Unscheduled Tasks Area (All-Day Section) */}
                    <div className="bg-neoCream/10 border-b-2 border-black p-1.5 min-h-[55px] max-h-[120px] overflow-y-auto space-y-1 flex flex-col">
                      {unscheduledTasks.length === 0 ? (
                        <span className="text-[9px] text-black/45 font-extrabold text-center italic mt-3">Bebas Tugas</span>
                      ) : (
                        unscheduledTasks.map(task => {
                          const isCompleted = task.status === 'completed';
                          return (
                            <div 
                              key={task.id} 
                              onClick={() => setSelectedItem({
                                id: task.id,
                                title: task.title,
                                type: 'task',
                                start: task.dueDate ? new Date(task.dueDate).toISOString() : '',
                                end: task.dueDate ? new Date(task.dueDate).toISOString() : '',
                                category: task.category,
                                description: task.description,
                                timeEstimateMinutes: task.timeEstimateMinutes,
                                status: task.status,
                                completed: isCompleted
                              })}
                              className={`bg-white border-2 border-black rounded-lg p-1 flex items-center gap-1 shadow-neo-sm text-left transition-all cursor-pointer ${
                                isCompleted ? 'bg-neoCream opacity-60 shadow-none' : ''
                              }`}
                            >
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="shrink-0 select-none scale-75"
                              >
                                <CheckBox
                                  checked={isCompleted}
                                  onClick={() => onToggleTaskComplete(task.id, task.status)}
                                  size={16}
                                  color={PRIORITY_COLORS[(task.priority - 1) || 0] || "#1D2A44"}
                                  duration={0.4}
                                />
                              </div>
                              <span 
                                className={`text-[9px] font-black text-black truncate w-full ${isCompleted ? 'line-through text-black/45' : ''}`}
                                title={task.title}
                              >
                                {task.title}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Hourly Timetable Area (height 628px) */}
                    <div className="relative flex-grow flex flex-col bg-white/50" style={{ height: '628px' }}>
                      
                      {/* Synchronized Meetings (Meetings) */}
                      {dayEvents.map(event => {
                        const pos = getEventPositionProps(event.startTime, event.endTime);
                        if (!pos) return null;

                        return (
                          <div
                            key={event.id}
                            style={{ top: pos.top, height: pos.height, minHeight: '54px' }}
                            onClick={() => setSelectedItem({
                              id: event.id,
                              title: event.title,
                              type: 'event',
                              start: event.startTime,
                              end: event.endTime,
                              category: 'Rapat Kalender',
                              description: event.description,
                              completed: false
                            })}
                            className="absolute left-1 right-1 rounded-xl bg-neoBlue border-2 border-black p-1.5 overflow-hidden flex flex-col justify-start text-left shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer"
                          >
                            <span className="text-[9.5px] font-black text-black truncate leading-tight mb-0.5">{event.title}</span>
                            <div className="flex items-center gap-1 text-[8px] text-black/85 font-black font-mono mt-auto">
                              <Clock className="w-2.5 h-2.5 shrink-0" />
                              <span>
                                {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Scheduled Tasks (AI Timetable) */}
                      {scheduledTasks.map(task => {
                        if (!task.scheduledStart || !task.scheduledEnd) return null;
                        const pos = getEventPositionProps(task.scheduledStart, task.scheduledEnd);
                        if (!pos) return null;

                        const isCompleted = task.status === 'completed';

                        return (
                          <div
                            key={task.id}
                            style={{ top: pos.top, height: pos.height, minHeight: '54px' }}
                            onClick={() => setSelectedItem({
                              id: task.id,
                              title: task.title,
                              type: 'task',
                              start: task.scheduledStart!,
                              end: task.scheduledEnd!,
                              category: task.category,
                              description: task.description,
                              timeEstimateMinutes: task.timeEstimateMinutes,
                              status: task.status,
                              completed: isCompleted
                            })}
                            className={`absolute left-1 right-1 rounded-xl bg-neoViolet border-2 border-black p-1.5 overflow-hidden flex flex-col justify-start text-left shadow-neo-sm hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none transition-all cursor-pointer ${
                              isCompleted ? 'bg-neoCream opacity-60 shadow-none translate-x-[0.5px] translate-y-[0.5px]' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className={`text-[9.5px] font-black text-black truncate leading-tight ${
                                isCompleted ? 'line-through text-black/45' : ''
                              }`}>
                                {task.title}
                              </span>
                              <span className="neo-badge bg-white text-[7px] px-1 py-0.2 rounded font-extrabold uppercase font-mono">
                                {task.category}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-1.5 text-[8px] text-black/90 font-black font-mono mt-auto">
                              <div className="flex items-center gap-0.5 bg-white border border-black rounded px-1">
                                <Clock className="w-2.5 h-2.5 shrink-0" />
                                <span>{task.timeEstimateMinutes}m</span>
                              </div>
                              <span>
                                {new Date(task.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Red Current Time Horizontal Line */}
                      {isDayToday && currentHourLineTop !== null && (
                        <div 
                          style={{ top: `${currentHourLineTop}%` }}
                          className="absolute left-0 right-0 h-1 bg-neoOrange border-y border-black z-10 pointer-events-none flex items-center"
                        >
                          <div className="w-3 h-3 rounded-full bg-neoOrange border-2 border-black -ml-1"></div>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}

            </div>

          </div>
        </div>
        ) : viewMode === 'month' ? (
          renderMonthView()
        ) : (
          renderYearView()
        )
      )}
      {/* ── Detail Event Modal (Neobrutalism Style) ── */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white border-4 border-black rounded-3xl p-6 max-w-md w-full shadow-[6px_6px_0px_0px_#000] space-y-4 relative animate-in zoom-in-95 duration-200">
            {/* Header / Title */}
            <div className="flex items-start justify-between border-b-2 border-black pb-3">
              <div className="min-w-0 pr-4">
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 border border-black rounded-md inline-block shadow-[1px_1px_0px_#000] mb-1.5 ${
                  selectedItem.type === 'event' ? 'bg-neoBlue text-black' : 'bg-neoViolet text-black'
                }`}>
                  {selectedItem.type === 'event' ? 'Rapat Kalender' : 'Tugas Kuliah'}
                </span>
                <h3 className="text-lg font-black text-black leading-tight break-words" title={selectedItem.title}>
                  {selectedItem.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="w-8 h-8 rounded-lg border-2 border-black bg-neoCream hover:bg-neoYellow flex items-center justify-center cursor-pointer transition-all shadow-[2px_2px_0px_#000] active:translate-y-[2px] active:shadow-none"
              >
                <ChevronLeft size={16} className="rotate-180 stroke-[2.5]" />
              </button>
            </div>

            {/* Event Details */}
            <div className="space-y-3.5 text-xs text-black/85 font-semibold">
              {/* Waktu Pelaksanaan */}
              {selectedItem.start && (
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-neoYellow border border-black flex items-center justify-center shrink-0">
                    <Clock size={14} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-[9px] text-black/50 block font-bold">Waktu Terjadwal</span>
                    <span className="font-extrabold text-black">
                      {new Date(selectedItem.start).toLocaleDateString('id-ID', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                      {selectedItem.start !== selectedItem.end && ` (${new Date(selectedItem.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(selectedItem.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`}
                    </span>
                  </div>
                </div>
              )}

              {/* Kategori */}
              {selectedItem.category && (
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-neoMint border border-black flex items-center justify-center shrink-0">
                    <CalendarDays size={14} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-[9px] text-black/50 block font-bold">Kategori</span>
                    <span className="font-extrabold text-black uppercase">
                      {selectedItem.category === 'work' ? 'Pekerjaan 💼' :
                       selectedItem.category === 'personal' ? 'Pribadi 🏠' :
                       selectedItem.category === 'health' ? 'Kesehatan 🩺' :
                       selectedItem.category === 'education' ? 'Pendidikan 🎓' : selectedItem.category}
                    </span>
                  </div>
                </div>
              )}

              {/* Estimasi Durasi */}
              {selectedItem.type === 'task' && selectedItem.timeEstimateMinutes !== undefined && (
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-neoYellow border border-black flex items-center justify-center shrink-0">
                    <Sparkles size={14} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-[9px] text-black/50 block font-bold">Estimasi Durasi</span>
                    <span className="font-extrabold text-black">
                      {selectedItem.timeEstimateMinutes} menit ({Math.round(selectedItem.timeEstimateMinutes / 60 * 10) / 10} jam)
                    </span>
                  </div>
                </div>
              )}

              {/* Status */}
              {selectedItem.type === 'task' && selectedItem.status && (
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-neoCream border border-black flex items-center justify-center shrink-0">
                    <CheckCircle2 size={14} className="stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-[9px] text-black/50 block font-bold">Status Tugas</span>
                    <span className={`font-black uppercase text-[10px] px-2 py-0.5 border border-black rounded ${
                      selectedItem.status === 'completed' ? 'bg-[#38BDF8]/20 text-[#2563EB]' : 'bg-[#FBBF24]/20 text-black'
                    }`}>
                      {selectedItem.status === 'completed' ? 'Selesai ✓' : 'Belum Selesai'}
                    </span>
                  </div>
                </div>
              )}

              {/* Deskripsi */}
              <div className="border-t-2 border-dashed border-black/20 pt-3.5 space-y-1">
                <span className="text-[9px] text-black/50 block font-bold">Deskripsi Tambahan</span>
                <p className="text-xxs leading-relaxed bg-neoCream/35 border-2 border-black rounded-xl p-3 text-black/90 font-mono min-h-[60px] whitespace-pre-wrap">
                  {selectedItem.description || 'Tidak ada catatan atau deskripsi tambahan.'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2.5 border-t-2 border-black">
              {selectedItem.type === 'task' && selectedItem.status && (
                <button
                  type="button"
                  onClick={async () => {
                    const nextStatus = selectedItem.status === 'completed' ? 'pending' : 'completed';
                    await onToggleTaskComplete(selectedItem.id, selectedItem.status!);
                    // Update state
                    setSelectedItem(prev => prev ? {
                      ...prev,
                      status: nextStatus,
                      completed: nextStatus === 'completed'
                    } : null);
                  }}
                  className={`px-4 py-2 border-2 border-black text-black font-extrabold text-[11px] rounded-xl shadow-[2px_2px_0px_#000] active:translate-y-[2px] active:shadow-none hover:-translate-y-0.5 transition-all cursor-pointer ${
                    selectedItem.completed ? 'bg-neoCream hover:bg-white' : 'bg-neoYellow hover:bg-neoYellow/80'
                  }`}
                >
                  {selectedItem.completed ? 'Tandai Belum Selesai' : 'Tandai Selesai ✓'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 border-2 border-black bg-black text-white hover:bg-neutral-800 font-extrabold text-[11px] rounded-xl shadow-[2px_2px_0px_#000] active:translate-y-[2px] active:shadow-none hover:-translate-y-0.5 transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
