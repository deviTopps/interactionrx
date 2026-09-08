'use client';

import { ImageDithering } from '@paper-design/shaders-react';

export default function LoginBackground() {
  return (
    <ImageDithering
      originalColors={false}
      inverted={false}
      type="8x8"
      size={2}
      colorSteps={2}
      image="https://app.paper.design/static/flowers.webp"
      scale={1}
      fit="cover"
      colorBack="#00000000"
      colorFront="#94FFAF"
      colorHighlight="#EAFF94"
      className="fixed inset-0 h-full w-full bg-[#000C38]"
    />
  );
}
