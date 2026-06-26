'use client';

import { useEffect, useRef } from 'react';

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // ── 星点粒子 ──
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3,
      opacity: Math.random() * 0.6 + 0.1,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
    }));

    // ── 速度线（斜向划过的细线，动漫速度感） ──
    const speedLines = Array.from({ length: 8 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      length: Math.random() * 120 + 60,
      speed: Math.random() * 3 + 1.5,
      opacity: Math.random() * 0.15 + 0.05,
      angle: (Math.random() * 20 - 10) * (Math.PI / 180), // 接近水平
    }));

    // ── 漂浮蓝色六边形小元素 ──
    const hexagons = Array.from({ length: 6 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 12 + 6,
      opacity: Math.random() * 0.08 + 0.02,
      vy: (Math.random() - 0.5) * 0.3,
      vx: (Math.random() - 0.5) * 0.2,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.005,
    }));

    let frame = 0;

    function drawHex(
      cx: number, cy: number, size: number,
      opacity: number, rotation: number
    ) {
      ctx!.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = rotation + (Math.PI / 3) * i;
        const px = cx + size * Math.cos(angle);
        const py = cy + size * Math.sin(angle);
        i === 0 ? ctx!.moveTo(px, py) : ctx!.lineTo(px, py);
      }
      ctx!.closePath();
      ctx!.strokeStyle = `rgba(30, 144, 255, ${opacity})`;
      ctx!.lineWidth = 0.8;
      ctx!.stroke();
    }

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      // 星点
      stars.forEach((s) => {
        s.twinkle += s.twinkleSpeed;
        const alpha = s.opacity * (0.7 + 0.3 * Math.sin(s.twinkle));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 220, 255, ${alpha})`;
        ctx.fill();
      });

      // 速度线
      speedLines.forEach((l) => {
        l.x += Math.cos(l.angle) * l.speed;
        l.y += Math.sin(l.angle) * l.speed;
        if (l.x > canvas.width + 200) {
          l.x = -200;
          l.y = Math.random() * canvas.height;
        }
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(l.x - Math.cos(l.angle) * l.length, l.y - Math.sin(l.angle) * l.length);
        ctx.strokeStyle = `rgba(0, 180, 255, ${l.opacity})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // 六边形
      hexagons.forEach((h) => {
        h.x += h.vx;
        h.y += h.vy;
        h.rotation += h.rotationSpeed;
        if (h.x < -50) h.x = canvas.width + 50;
        if (h.x > canvas.width + 50) h.x = -50;
        if (h.y < -50) h.y = canvas.height + 50;
        if (h.y > canvas.height + 50) h.y = -50;
        drawHex(h.x, h.y, h.size, h.opacity, h.rotation);
      });

      // 底部周期性扫描线
      if (frame % 3 === 0) {
        const scanY = ((frame * 0.5) % canvas.height);
        const scanGrad = ctx.createLinearGradient(0, scanY, canvas.width, scanY);
        scanGrad.addColorStop(0, 'rgba(0,180,255,0)');
        scanGrad.addColorStop(0.5, 'rgba(0,180,255,0.03)');
        scanGrad.addColorStop(1, 'rgba(0,180,255,0)');
        ctx.fillStyle = scanGrad;
        ctx.fillRect(0, scanY, canvas.width, 2);
      }

      requestAnimationFrame(animate);
    }

    animate();

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
}
