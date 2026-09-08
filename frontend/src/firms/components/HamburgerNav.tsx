import {
  Globe2,
  MapPinned,
  Flame,
  Image,
  Newspaper,
  Bell,
  Archive,
  Server,
  BookOpen,
  HelpCircle,
  Boxes,
  GitBranch,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useFires, useFiresDispatch } from '../state/store';
import { cn } from './ui';

const ITEMS: { label: string; icon: LucideIcon; active?: boolean }[] = [
  { label: 'Global Fire Map', icon: Globe2, active: true },
  { label: 'India Fire Map', icon: MapPinned },
  { label: 'Active Fire Data', icon: Flame },
  { label: 'Satellite Imagery', icon: Image },
  { label: "Blog — What's New", icon: Newspaper },
  { label: 'Fire Alerts', icon: Bell },
  { label: 'Download Archived Data', icon: Archive },
  { label: 'Web Services', icon: Server },
  { label: 'Tutorials', icon: BookOpen },
  { label: 'FAQs', icon: HelpCircle },
  { label: 'Additional Resources', icon: Boxes },
  { label: 'About Jvalyx', icon: GitBranch },
];

export function HamburgerNav() {
  const { hamburgerOpen } = useFires();
  const dispatch = useFiresDispatch();

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[1400] bg-black/40 transition-opacity',
          hamburgerOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => dispatch({ type: 'toggleHamburger', open: false })}
      />
      <nav
        className={cn(
          'fixed left-0 top-0 z-[1401] h-full w-72 transform bg-[#0b0f14] text-white shadow-2xl transition-transform',
          hamburgerOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between bg-gradient-to-r from-[#8a0f2e] to-[#a11540] px-4 py-3">
          <span className="text-lg font-black tracking-widest">JVALYX · FIRMS</span>
          <button type="button" onClick={() => dispatch({ type: 'toggleHamburger', open: false })}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="py-2">
          {ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              className={cn(
                'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/10',
                item.active && 'bg-[#a11540]/25 font-semibold text-white',
              )}
            >
              <item.icon className="h-4 w-4 text-white/70" />
              {item.label}
            </button>
          ))}
        </div>
        <div className="absolute bottom-0 w-full border-t border-white/10 px-4 py-3 text-[10px] leading-relaxed text-white/40">
          Research prototype. Active-fire data © NASA FIRMS / LANCE. Not an official
          emergency-response system.
        </div>
      </nav>
    </>
  );
}
