import React from "react";

interface BottleProps {
  currentMl: number;
  totalMl: number;
  size?: "sm" | "md" | "lg";
}

export function Bottle({ currentMl, totalMl, size = "md" }: BottleProps) {
  const percentage = totalMl > 0 ? Math.min(100, Math.max(0, (currentMl / totalMl) * 100)) : 0;

  // Color based on percentage
  let fillColor = "#22c55e"; // Green
  if (percentage <= 25) {
    fillColor = "#ef4444"; // Red
  } else if (percentage <= 50) {
    fillColor = "#eab308"; // Yellow
  }

  const sizes = {
    sm: { width: 40, height: 70 },
    md: { width: 60, height: 100 },
    lg: { width: 80, height: 140 },
  };

  const { width, height } = sizes[size];

  // SVG dimensions (viewBox coordinates)
  const bottleWidth = 40;
  const bottleHeight = 100;
  const neckHeight = 20;
  const neckWidth = 14;
  const bodyTop = 25;
  const bodyBottom = 95;
  const bodyHeight = bodyBottom - bodyTop;

  // Liquid level calculation
  const liquidHeight = (bodyHeight * percentage) / 100;
  const liquidTop = bodyBottom - liquidHeight;

  return (
    <div className="bottle-container" style={{ width, height }}>
      <svg
        viewBox={`0 0 ${bottleWidth} ${bottleHeight}`}
        className="bottle"
        style={{ width: "100%", height: "100%" }}
      >
        {/* Bottle outline */}
        <defs>
          <clipPath id={`bottle-clip-${percentage}`}>
            {/* Neck */}
            <rect x={(bottleWidth - neckWidth) / 2} y="5" width={neckWidth} height={neckHeight} rx="2" />
            {/* Body */}
            <path
              d={`
                M ${(bottleWidth - neckWidth) / 2} ${bodyTop - 5}
                Q 5 ${bodyTop + 5} 5 ${bodyTop + 15}
                L 5 ${bodyBottom - 5}
                Q 5 ${bodyBottom} 10 ${bodyBottom}
                L 30 ${bodyBottom}
                Q 35 ${bodyBottom} 35 ${bodyBottom - 5}
                L 35 ${bodyTop + 15}
                Q 35 ${bodyTop + 5} ${(bottleWidth + neckWidth) / 2} ${bodyTop - 5}
                Z
              `}
            />
          </clipPath>

          {/* Gradient for liquid */}
          <linearGradient id={`liquid-gradient-${percentage}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={fillColor} stopOpacity="0.8" />
            <stop offset="50%" stopColor={fillColor} stopOpacity="1" />
            <stop offset="100%" stopColor={fillColor} stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* Bottle background (glass) */}
        <g clipPath={`url(#bottle-clip-${percentage})`}>
          <rect x="0" y="0" width={bottleWidth} height={bottleHeight} fill="rgba(255,255,255,0.1)" />
        </g>

        {/* Liquid */}
        <g clipPath={`url(#bottle-clip-${percentage})`}>
          <rect
            x="0"
            y={liquidTop}
            width={bottleWidth}
            height={liquidHeight + 5}
            fill={`url(#liquid-gradient-${percentage})`}
            className="bottle-liquid"
          />
          {/* Liquid surface highlight */}
          {percentage > 0 && (
            <ellipse
              cx={bottleWidth / 2}
              cy={liquidTop}
              rx="12"
              ry="2"
              fill="rgba(255,255,255,0.3)"
            />
          )}
        </g>

        {/* Bottle outline stroke */}
        <g fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5">
          {/* Neck */}
          <rect x={(bottleWidth - neckWidth) / 2} y="5" width={neckWidth} height={neckHeight} rx="2" />
          {/* Cap */}
          <rect x={(bottleWidth - neckWidth - 2) / 2} y="2" width={neckWidth + 2} height="5" rx="1" fill="rgba(255,255,255,0.2)" />
          {/* Body */}
          <path
            d={`
              M ${(bottleWidth - neckWidth) / 2} ${bodyTop - 5}
              Q 5 ${bodyTop + 5} 5 ${bodyTop + 15}
              L 5 ${bodyBottom - 5}
              Q 5 ${bodyBottom} 10 ${bodyBottom}
              L 30 ${bodyBottom}
              Q 35 ${bodyBottom} 35 ${bodyBottom - 5}
              L 35 ${bodyTop + 15}
              Q 35 ${bodyTop + 5} ${(bottleWidth + neckWidth) / 2} ${bodyTop - 5}
            `}
          />
        </g>

        {/* Shine effect */}
        <rect
          x="8"
          y={bodyTop + 5}
          width="3"
          height={bodyHeight - 15}
          rx="1.5"
          fill="rgba(255,255,255,0.15)"
        />
      </svg>
    </div>
  );
}
