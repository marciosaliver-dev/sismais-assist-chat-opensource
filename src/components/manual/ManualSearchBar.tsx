import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

interface ManualSearchBarProps {
  onSearch: (term: string) => void;
  placeholder?: string;
}

export function ManualSearchBar({ onSearch, placeholder = 'Buscar no manual...' }: ManualSearchBarProps) {
  const [value, setValue] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSearch(value);
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, onSearch]);

  return (
    <div className="relative w-full max-w-[560px]">
      <Search
        size={18}
        className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#666666]"
      />
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full h-12 bg-white rounded-xl pl-12 pr-20 text-sm outline-none border border-transparent text-[#333333] transition-all duration-200 shadow-[0_4px_6px_-1px_rgba(16,41,63,0.1),0_2px_4px_-1px_rgba(16,41,63,0.06)] focus:border-[#45E5E5] focus:shadow-[0_0_0_3px_rgba(69,229,229,0.15),0_4px_6px_-1px_rgba(16,41,63,0.1)]"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded-md bg-white/80 border border-[#E5E5E5] text-[10px] font-medium text-[#999] pointer-events-none select-none">
        <kbd className="font-sans">Ctrl</kbd>
        <span>+</span>
        <kbd className="font-sans">K</kbd>
      </span>
    </div>
  );
}