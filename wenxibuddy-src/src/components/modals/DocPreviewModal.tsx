import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Download } from 'lucide-react';
import { CardDeckItem } from '@/types';
import { LiquidModal } from '@/components/ui/LiquidModal';

interface DocPreviewModalProps {
  doc: CardDeckItem | null;
  onClose: () => void;
}

export const DocPreviewModal: React.FC<DocPreviewModalProps> = ({ doc, onClose }) => {
  return (
    <LiquidModal
      open={!!doc}
      onClose={onClose}
      title={doc?.title ?? '文档预览'}
      subtitle={doc ? `${doc.quarter} · ${doc.type}` : undefined}
      icon={<FileText className="w-5 h-5" />}
      widthClass="max-w-xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-full liquid-btn-ghost text-[12px] text-white/60">
            关闭
          </button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }} className="h-10 px-4 rounded-full liquid-btn-primary text-[12px] font-bold flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" />
            下载完整附件
          </motion.button>
        </div>
      }
    >
      {doc && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-black/30 border border-white/[0.07] space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white/40">归档完成度</span>
              <span className="text-emerald-300 font-bold font-mono">{doc.completionRate}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden border border-white/10">
              <motion.div
                key={doc.id}
                initial={{ width: 0 }}
                animate={{ width: `${doc.completionRate}%` }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 shadow-[0_0_12px_rgba(52,211,153,0.7)]"
              />
            </div>
          </div>

          <p className="text-[13px] text-white/65 leading-relaxed p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
            {doc.details}
          </p>

          <div className="grid grid-cols-2 gap-3 text-[11px] text-white/45">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]">
              负责人 <span className="text-white/80 font-medium ml-1">{doc.author}</span>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] font-mono">
              {doc.updatedAt}
            </div>
          </div>
        </div>
      )}
    </LiquidModal>
  );
};
