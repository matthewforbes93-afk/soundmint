'use client';

import { useEffect, useRef, useState } from 'react';

interface LevelMeterProps {
  analyser: AnalyserNode | null;
  orientation?: 'vertical' | 'horizontal';
  height?: number;
  width?: number;
  showPeak?: boolean;
  showDB?: boolean;
}

export default function LevelMeter({
  analyser,
  orientation = 'vertical',
  height = 120,
  width = 24,
  showPeak = true,
  showDB = true,
}: LevelMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peakRef = useRef(0);
  const peakHoldRef = useRef(0);
  const peakDecayRef = useRef(0);
  const animRef = useRef(0);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      analyser.getByteFrequencyData(dataArray);

      // Calculate RMS level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = dataArray[i] / 255;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const level = Math.min(1, rms * 2.5); // Scale up for visibility

      // Peak hold
      if (level > peakRef.current) {
        peakRef.current = level;
        peakHoldRef.current = 30; // Hold for 30 frames
      }
      if (peakHoldRef.current > 0) {
        peakHoldRef.current--;
      } else {
        peakRef.current *= 0.95; // Decay
      }

      // Draw
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (orientation === 'vertical') {
        const meterH = canvas.height - (showDB ? 16 : 0);
        const meterW = canvas.width;
        const levelH = level * meterH;
        const peakY = meterH - peakRef.current * meterH;

        // Background
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, meterW, meterH);

        // Meter segments
        const segments = 30;
        const segH = meterH / segments;
        const gap = 1;

        for (let i = 0; i < segments; i++) {
          const y = meterH - (i + 1) * segH;
          const segLevel = (i + 1) / segments;

          if (segLevel <= level) {
            // Color: green → yellow → red
            if (segLevel > 0.85) ctx.fillStyle = '#ef4444'; // Red
            else if (segLevel > 0.7) ctx.fillStyle = '#f59e0b'; // Yellow
            else ctx.fillStyle = '#14b8a6'; // Teal/green
          } else {
            ctx.fillStyle = '#1a1a2e'; // Dark inactive
          }

          ctx.fillRect(1, y + gap, meterW - 2, segH - gap * 2);
        }

        // Peak indicator
        if (showPeak && peakRef.current > 0.01) {
          ctx.fillStyle = peakRef.current > 0.85 ? '#ef4444' : '#ffffff';
          ctx.fillRect(0, peakY, meterW, 2);
        }

        // dB label
        if (showDB) {
          const db = level > 0 ? Math.round(20 * Math.log10(level)) : -60;
          ctx.fillStyle = level > 0.85 ? '#ef4444' : '#666';
          ctx.font = '9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${db}`, meterW / 2, meterH + 12);
        }
      } else {
        // Horizontal
        const meterW = canvas.width - (showDB ? 30 : 0);
        const meterH = canvas.height;
        const levelW = level * meterW;

        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, meterW, meterH);

        const segments = 40;
        const segW = meterW / segments;

        for (let i = 0; i < segments; i++) {
          const x = i * segW;
          const segLevel = (i + 1) / segments;

          if (segLevel <= level) {
            if (segLevel > 0.85) ctx.fillStyle = '#ef4444';
            else if (segLevel > 0.7) ctx.fillStyle = '#f59e0b';
            else ctx.fillStyle = '#14b8a6';
          } else {
            ctx.fillStyle = '#1a1a2e';
          }

          ctx.fillRect(x + 0.5, 1, segW - 1, meterH - 2);
        }

        if (showPeak && peakRef.current > 0.01) {
          const peakX = peakRef.current * meterW;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(peakX, 0, 2, meterH);
        }

        if (showDB) {
          const db = level > 0 ? Math.round(20 * Math.log10(level)) : -60;
          ctx.fillStyle = '#666';
          ctx.font = '9px monospace';
          ctx.fillText(`${db}dB`, meterW + 4, meterH / 2 + 3);
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [analyser, orientation, height, width, showPeak, showDB]);

  return (
    <canvas
      ref={canvasRef}
      width={orientation === 'vertical' ? width : width}
      height={orientation === 'vertical' ? height : height}
      className="rounded"
    />
  );
}
