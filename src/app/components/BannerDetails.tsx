import React from 'react';
import { Monitor, Smartphone } from 'lucide-react';

interface Placement {
  platform: string;
  pages: string[];
}

interface BannerDetailsProps {
  device: 'desktop' | 'mobile';
  placement: Placement;
  width: number;
  height: number;
}

export function BannerDetails({ device, placement, width, height }: BannerDetailsProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {device === 'desktop' ? (
        <Monitor size={12} className="text-[#86868b] flex-shrink-0" strokeWidth={2} />
      ) : (
        <Smartphone size={12} className="text-[#86868b] flex-shrink-0" strokeWidth={2} />
      )}
      <span className="text-[13px] text-[#86868b] font-medium">
        {placement.platform}
      </span>
      <span className="text-[15px] text-[#b0b0b5]">•</span>
      <span className="text-[13px] text-[#86868b] font-medium">
        {placement.pages.join(' • ')}
      </span>
      <span className="text-[15px] text-[#b0b0b5]">•</span>
      <span className="text-[13px] text-[#86868b] font-medium tabular-nums">
        {width} × {height}
      </span>
    </div>
  );
}