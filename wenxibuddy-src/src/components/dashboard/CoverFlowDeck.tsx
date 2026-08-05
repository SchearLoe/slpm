import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { CardDeckItem } from '@/types';

interface CoverFlowDeckProps {
  onSelectDoc?: (doc: CardDeckItem) => void;
}

const items: CardDeckItem[] = [
  {
    id: 'deck-1',
    title: '项目文档',
    quarter: '2025 - Q2',
    completionRate: 87,
    type: '项目归档',
    colorTheme: 'emerald',
    details: '包含核心需求定义、原型设计图纸及各模块验收报告全套资料。',
    author: 'Brandon',
    updatedAt: '2025-05-24 16:30',
  },
  {
    id: 'deck-2',
    title: '架构设计图谱',
    quarter: '2025 - Q2',
    completionRate: 94,
    type: '系统架构',
    colorTheme: 'glass',
    details: '涵盖微服务链路拓扑、高可用容灾方案与数据库拆分规范。',
    author: 'Alex',
    updatedAt: '2025-05-23 11:20',
  },
  {
    id: 'deck-3',
    title: '用户体验报告',
    quarter: '2025 - Q1',
    completionRate: 76,
    type: '调研归档',
    colorTheme: 'glass',
    details: '针对30位核心客户的深度访谈与NPS净推荐值数据分析报告。',
    author: 'Sarah',
    updatedAt: '2025-05-20 09:15',
  },
  {
    id: 'deck-4',
    title: 'API接口文档',
    quarter: '2025 - Q2',
    completionRate: 65,
    type: '技术规范',
    colorTheme: 'glass',
    details: '包含全套RESTful & GraphQL API 签名机制与鉴权逻辑。',
    author: 'David',
    updatedAt: '2025-05-19 14:00',
  },
  {
    id: 'deck-5',
    title: '测试用例集',
    quarter: '2025 - Q2',
    completionRate: 80,
    type: '质量保障',
    colorTheme: 'glass',
    details: '涵盖自动化回归测试套件、并发压力测试与安全漏洞排查项。',
    author: 'Elena',
    updatedAt: '2025-05-18 17:45',
  },
  {
    id: 'deck-6',
    title: '产品路线图 3.0',
    quarter: '2025 - Q3',
    completionRate: 40,
    type: '战略规划',
    colorTheme: 'glass',
    details: '下半年AI智能化升级方向与生态拓展里程碑划分。',
    author: 'Brandon',
    updatedAt: '2025-05-15 10:00',
  },
  {
    id: 'deck-7',
    title: '全量规格',
    quarter: '2025 - Q2',
    completionRate: 70,
    type: '规格书',
    colorTheme: 'glass',
    details: '全量产品规格与接口对齐清单。',
    author: 'Team',
    updatedAt: '2025-05-14 12:00',
  },
];

const spring = { type: 'spring' as const, stiffness: 300, damping: 28, mass: 0.72 };

export const CoverFlowDeck: React.FC<CoverFlowDeckProps> = ({ onSelectDoc }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [hovered, setHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelLock = useRef(false);
  const wheelAcc = useRef(0);

  const go = useCallback((dir: 1 | -1) => {
    setActiveIndex((p) => (p + dir + items.length) % items.length);
  }, []);

  useEffect(() => {
    if (!autoPlay || hovered) return;
    const id = window.setInterval(() => go(1), 4500);
    return () => window.clearInterval(id);
  }, [autoPlay, hovered, go]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      wheelAcc.current += e.deltaY;
      if (wheelLock.current) return;
      if (Math.abs(wheelAcc.current) < 28) return;

      const dir: 1 | -1 = wheelAcc.current > 0 ? 1 : -1;
      wheelAcc.current = 0;
      wheelLock.current = true;
      go(dir);
      window.setTimeout(() => {
        wheelLock.current = false;
      }, 320);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [go]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[220px] overflow-hidden select-none scrollbar-none"
      onMouseEnter={() => {
        setHovered(true);
        setAutoPlay(false);
      }}
      onMouseLeave={() => {
        setHovered(false);
        setAutoPlay(true);
      }}
      title="滚轮切换卡片"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-[18%] top-1/2 -translate-y-1/2 w-[65%] h-[80%] bg-emerald-400/20 blur-[90px] rounded-full animate-pulse-glow" />
        <div className="absolute right-[6%] top-[25%] w-40 h-40 bg-cyan-400/10 blur-[60px] rounded-full" />
      </div>

      <div
        className="relative w-full h-full flex items-center justify-center"
        style={{ perspective: '1600px', perspectiveOrigin: '38% 50%' }}
      >
        {items.map((item, index) => {
          const diff = (index - activeIndex + items.length) % items.length;
          const isActive = diff === 0;
          // 更大卡片 + 自适应扇形步进
          const step = 42;
          const x = isActive ? -56 : -18 + diff * step;
          const y = isActive ? 0 : diff * 1.5;
          const z = -diff * 58;
          const rotY = isActive ? -8 : -28 - diff * 1.4;
          const scale = isActive ? 1.08 : Math.max(0.76, 1 - diff * 0.045);
          const opacity = isActive ? 1 : Math.max(0.3, 0.94 - diff * 0.09);
          const zIndex = items.length - diff;

          return (
            <motion.div
              key={item.id}
              onClick={() => setActiveIndex(index)}
              initial={false}
              animate={{ x, y, z, rotateY: rotY, scale, opacity }}
              transition={spring}
              style={{
                zIndex,
                transformStyle: 'preserve-3d',
                // 整体放大，随容器自适应：最小 200 → 理想 56% 宽 → 最大 280
                width: 'clamp(180px, 52%, min(300px, 28vw))',
                height: 'clamp(220px, 86%, min(340px, 38vh))',
              }}
              className={`absolute rounded-[20px] cursor-pointer p-4 flex flex-col justify-between overflow-hidden will-change-transform ${
                isActive ? 'frost-card-active text-white' : 'frost-card text-white/90'
              }`}
            >
              {/* 文档纹理 */}
              <div className="absolute inset-0 pointer-events-none opacity-30">
                <div className="absolute top-[36%] left-5 right-5 space-y-2.5">
                  <div className="h-[2px] rounded bg-white/40 w-full" />
                  <div className="h-[2px] rounded bg-white/30 w-[88%]" />
                  <div className="h-[2px] rounded bg-white/25 w-[72%]" />
                  <div className="h-[2px] rounded bg-white/20 w-[80%]" />
                  <div className="h-[2px] rounded bg-white/15 w-[60%]" />
                </div>
              </div>

              {/* 顶部标题 */}
              <div className="relative z-10 pr-2">
                <div className="text-[15px] sm:text-[16px] font-bold tracking-tight truncate">{item.title}</div>
                <div className={`text-[11px] mt-1 ${isActive ? 'text-emerald-50/90' : 'text-white/50'}`}>
                  {item.quarter}
                </div>
              </div>

              {/* 中部完成度 / 类型 */}
              <div className="relative z-10 flex-1 flex flex-col justify-end pb-12">
                {isActive ? (
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[36px] sm:text-[40px] font-extrabold leading-none tracking-tight">
                      {item.completionRate}%
                    </span>
                    <span className="text-[11px] font-medium text-emerald-50/90">完成度</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-[11px] text-white/45 font-medium">{item.type}</div>
                    <div className="text-[20px] font-bold text-white/55 tabular-nums">{item.completionRate}%</div>
                  </div>
                )}
              </div>

              {/* 每张卡片右下角播放按钮 — 随卡片 3D 位移一起动 */}
              <motion.button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIndex(index);
                  onSelectDoc?.(item);
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.92 }}
                className={`absolute z-20 bottom-3.5 right-3.5 rounded-full flex items-center justify-center text-white transition-shadow ${
                  isActive ? 'w-11 h-11 sm:w-12 sm:h-12' : 'w-9 h-9 sm:w-10 sm:h-10'
                }`}
                style={{
                  background: isActive
                    ? 'linear-gradient(145deg, rgba(255,255,255,0.42), rgba(255,255,255,0.12))'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.28), rgba(255,255,255,0.06))',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  border: '1px solid rgba(255,255,255,0.4)',
                  boxShadow: isActive
                    ? 'inset 0 1px 0 rgba(255,255,255,0.55), 0 8px 24px rgba(0,0,0,0.35), 0 0 20px rgba(255,255,255,0.12)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 16px rgba(0,0,0,0.3)',
                }}
                title={`预览 · ${item.title}`}
                aria-label={`预览 ${item.title}`}
              >
                <Play
                  className={`fill-white text-white translate-x-[1px] ${
                    isActive ? 'w-5 h-5' : 'w-3.5 h-3.5'
                  }`}
                />
              </motion.button>
            </motion.div>
          );
        })}
      </div>

      {/* 页码指示：右上角小点，避免底部出现莫名细条 */}
      <div className="absolute top-2 right-2 z-50 flex items-center gap-1 pointer-events-none">
        {items.map((it, i) => (
          <span
            key={it.id}
            className={`rounded-full transition-all ${i === activeIndex ? 'w-4 h-1.5 bg-emerald-300/90' : 'w-1.5 h-1.5 bg-white/25'}`}
          />
        ))}
      </div>

      {hovered && (
        <div className="absolute top-2 left-2 z-50 text-[10px] text-white/35 px-2 py-1 rounded-full bg-black/35 border border-white/5 pointer-events-none">
          滚轮切换 · {activeIndex + 1}/{items.length}
        </div>
      )}
    </div>
  );
};
