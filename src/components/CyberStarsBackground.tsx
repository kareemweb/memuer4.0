import React, { useEffect, useRef } from 'react';

interface CyberStarsBackgroundProps {
  theme?: string;
  className?: string;
  speed?: number; // 1, 2, or 3
  cursorFollow?: boolean;
  touchSparkles?: boolean;
}

interface Star {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  size: number;
  baseAlpha: number;
  alpha: number;
  vx: number;
  vy: number;
  color: string;
  twinkleSpeed: number;
  twinklePhase: number;
  isBokeh?: boolean;
  isCrossFlare?: boolean;
  flareRotation?: number;
  isFollower?: boolean;
  followerOffsetAngle?: number;
  followerDist?: number;
  isReturning?: boolean;
}

interface SparkleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  rotation: number;
  rotSpeed: number;
  isFlare?: boolean;
}

export function CyberStarsBackground({
  theme = 'liquidglass',
  className = '',
  speed = 2,
  cursorFollow = true,
  touchSparkles = true
}: CyberStarsBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // If luxury, do not render cyber stars as requested ("exept luxry")
  if (theme === 'luxury') {
    return null;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Calculate speed multiplier based on speed prop (1: calm, 2: balanced, 3: warp/hyperdrive)
    const speedMult = speed === 1 ? 0.7 : speed === 3 ? 2.8 : 1.5;

    // Color palettes for moving stars and cosmic dust with high luminosity and vibrancy
    const getThemeColors = (t: string) => {
      switch (t) {
        case 'midnight':
          return {
            nebula1: 'rgba(6, 182, 212, 0.45)',
            nebula2: 'rgba(37, 99, 235, 0.50)',
            nebula3: 'rgba(99, 102, 241, 0.40)',
            bgGlow: 'radial-gradient(ellipse at 15% 35%, rgba(6, 182, 212, 0.35) 0%, transparent 60%), radial-gradient(ellipse at 85% 75%, rgba(37, 99, 235, 0.35) 0%, transparent 60%)',
            starColors: ['#ffffff', '#e0f2fe', '#38bdf8', '#00f0ff', '#60a5fa', '#818cf8', '#a5f3fc'],
            bokehColors: ['rgba(56, 189, 248, 0.35)', 'rgba(6, 182, 212, 0.30)', 'rgba(99, 102, 241, 0.28)', 'rgba(255, 255, 255, 0.30)'],
            sparkleColors: ['#ffffff', '#38bdf8', '#00f0ff', '#93c5fd', '#67e8f9'],
          };
        case 'forest':
          return {
            nebula1: 'rgba(16, 185, 129, 0.50)',
            nebula2: 'rgba(20, 184, 166, 0.45)',
            nebula3: 'rgba(52, 211, 153, 0.40)',
            bgGlow: 'radial-gradient(ellipse at 15% 35%, rgba(16, 185, 129, 0.35) 0%, transparent 60%), radial-gradient(ellipse at 85% 75%, rgba(20, 184, 166, 0.35) 0%, transparent 60%)',
            starColors: ['#ffffff', '#d1fae5', '#34d399', '#10b981', '#2dd4bf', '#a3e635', '#6ee7b7'],
            bokehColors: ['rgba(52, 211, 153, 0.35)', 'rgba(16, 185, 129, 0.30)', 'rgba(20, 184, 166, 0.28)', 'rgba(255, 255, 255, 0.30)'],
            sparkleColors: ['#ffffff', '#6ee7b7', '#34d399', '#a7f3d0', '#5eead4'],
          };
        case 'crimson':
          return {
            nebula1: 'rgba(244, 63, 94, 0.52)',
            nebula2: 'rgba(225, 29, 72, 0.48)',
            nebula3: 'rgba(251, 113, 133, 0.42)',
            bgGlow: 'radial-gradient(ellipse at 15% 35%, rgba(244, 63, 94, 0.35) 0%, transparent 60%), radial-gradient(ellipse at 85% 75%, rgba(225, 29, 72, 0.35) 0%, transparent 60%)',
            starColors: ['#ffffff', '#ffe4e6', '#fda4af', '#f43f5e', '#fb7185', '#ffedd5', '#fb923c'],
            bokehColors: ['rgba(244, 63, 94, 0.35)', 'rgba(251, 113, 133, 0.30)', 'rgba(225, 29, 72, 0.28)', 'rgba(255, 255, 255, 0.30)'],
            sparkleColors: ['#ffffff', '#fda4af', '#fb7185', '#f43f5e', '#fed7aa'],
          };
        case 'vibrant':
          return {
            nebula1: 'rgba(168, 85, 247, 0.52)',
            nebula2: 'rgba(236, 72, 153, 0.48)',
            nebula3: 'rgba(129, 140, 248, 0.42)',
            bgGlow: 'radial-gradient(ellipse at 15% 35%, rgba(168, 85, 247, 0.35) 0%, transparent 60%), radial-gradient(ellipse at 85% 75%, rgba(236, 72, 153, 0.35) 0%, transparent 60%)',
            starColors: ['#ffffff', '#fae8ff', '#e879f9', '#c084fc', '#818cf8', '#38bdf8', '#f472b6'],
            bokehColors: ['rgba(192, 132, 252, 0.35)', 'rgba(236, 72, 153, 0.30)', 'rgba(129, 140, 248, 0.28)', 'rgba(255, 255, 255, 0.30)'],
            sparkleColors: ['#ffffff', '#f0abfc', '#d8b4fe', '#c084fc', '#e879f9'],
          };
        case 'liquidglass':
        default:
          return {
            nebula1: 'rgba(20, 184, 166, 0.52)',
            nebula2: 'rgba(6, 182, 212, 0.50)',
            nebula3: 'rgba(59, 130, 246, 0.45)',
            bgGlow: 'radial-gradient(ellipse at 12% 30%, rgba(20, 184, 166, 0.38) 0%, transparent 60%), radial-gradient(ellipse at 88% 80%, rgba(6, 182, 212, 0.38) 0%, transparent 60%)',
            starColors: ['#ffffff', '#ccfbf1', '#99f6e4', '#67e8f9', '#38bdf8', '#e0e7ff', '#a5f3fc'],
            bokehColors: ['rgba(45, 212, 191, 0.35)', 'rgba(6, 182, 212, 0.30)', 'rgba(56, 189, 248, 0.28)', 'rgba(255, 255, 255, 0.30)'],
            sparkleColors: ['#ffffff', '#99f6e4', '#67e8f9', '#38bdf8', '#ccfbf1'],
          };
      }
    };

    const palette = getThemeColors(theme);

    // Mouse & Touch interaction state
    const mouse = {
      x: -1000,
      y: -1000,
      targetX: -1000,
      targetY: -1000,
      active: false,
      isTouch: false
    };

    const sparkles: SparkleParticle[] = [];

    // Generate balanced starfield with increased brightness and density
    const stars: Star[] = [];
    const count = Math.min(Math.floor((width * height) / 7000), 170);

    // Count followers
    let followerAssigned = 0;
    const maxFollowers = 8;

    for (let i = 0; i < count; i++) {
      const isLarge = Math.random() < 0.20;
      const isMid = !isLarge && Math.random() < 0.40;
      const isFollower = followerAssigned < maxFollowers && Math.random() < 0.12;
      if (isFollower) followerAssigned++;

      const size = isLarge ? Math.random() * 2.4 + 1.8 : isMid ? Math.random() * 1.4 + 1.0 : Math.random() * 0.9 + 0.6;
      const color = palette.starColors[Math.floor(Math.random() * palette.starColors.length)];
      const startX = Math.random() * width;
      const startY = Math.random() * height;
      
      stars.push({
        x: startX,
        y: startY,
        homeX: startX,
        homeY: startY,
        size,
        baseAlpha: isLarge ? 0.90 + Math.random() * 0.10 : Math.random() * 0.45 + 0.50,
        alpha: Math.random(),
        vx: (Math.random() - 0.5) * 0.18 + (Math.random() < 0.5 ? 0.06 : -0.06),
        vy: (Math.random() - 0.5) * 0.14 - (Math.random() * 0.08 + 0.03),
        color,
        twinkleSpeed: Math.random() * 0.04 + 0.015,
        twinklePhase: Math.random() * Math.PI * 2,
        isFollower,
        followerOffsetAngle: Math.random() * Math.PI * 2,
        followerDist: Math.random() * 120 + 40
      });
    }

    // Soft drifting Bokeh particles
    const bokehCount = 24;
    for (let i = 0; i < bokehCount; i++) {
      const size = Math.random() * 24 + 10;
      const color = palette.bokehColors[Math.floor(Math.random() * palette.bokehColors.length)];
      const startX = Math.random() * width;
      const startY = Math.random() * height;
      stars.push({
        x: startX,
        y: startY,
        homeX: startX,
        homeY: startY,
        size,
        baseAlpha: Math.random() * 0.30 + 0.15,
        alpha: Math.random(),
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.18 - 0.05,
        color,
        twinkleSpeed: Math.random() * 0.02 + 0.008,
        twinklePhase: Math.random() * Math.PI * 2,
        isBokeh: true,
      });
    }

    // Four-point Cyber Flare sparkles with radiant beams
    const flareCount = 8;
    for (let i = 0; i < flareCount; i++) {
      const startX = Math.random() * width;
      const startY = Math.random() * height;
      stars.push({
        x: startX,
        y: startY,
        homeX: startX,
        homeY: startY,
        size: Math.random() * 8 + 10,
        baseAlpha: 0.95,
        alpha: 0.95,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.07,
        color: '#ffffff',
        twinkleSpeed: 0.03,
        twinklePhase: i * 1.2,
        isCrossFlare: true,
        flareRotation: Math.random() * Math.PI,
      });
    }

    // Sparkle burst creator for touch / press
    const spawnSparklesAt = (originX: number, originY: number, count = 10) => {
      if (!touchSparkles) return;
      for (let k = 0; k < count; k++) {
        const angle = Math.random() * Math.PI * 2;
        const sparkSpeed = Math.random() * 3.8 + 1.0;
        const color = palette.sparkleColors[Math.floor(Math.random() * palette.sparkleColors.length)];
        const isFlare = Math.random() < 0.4;

        sparkles.push({
          x: originX + (Math.random() - 0.5) * 12,
          y: originY + (Math.random() - 0.5) * 12,
          vx: Math.cos(angle) * sparkSpeed,
          vy: Math.sin(angle) * sparkSpeed - (Math.random() * 0.6),
          size: isFlare ? Math.random() * 7 + 5 : Math.random() * 3.0 + 1.2,
          color,
          alpha: 1,
          decay: Math.random() * 0.024 + 0.016,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.1,
          isFlare
        });
      }
    };

    // Mouse Event Handlers
    const handleMouseMove = (e: MouseEvent) => {
      if (!cursorFollow) return;
      mouse.isTouch = false;
      mouse.active = true;
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      if (mouse.x === -1000) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
      }
    };

    const handleMouseLeave = () => {
      mouse.active = false;
    };

    // Mobile Touch Event Handlers
    const handleTouchStart = (e: TouchEvent) => {
      mouse.isTouch = true;
      if (!touchSparkles) return;
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        spawnSparklesAt(touch.clientX, touch.clientY, 12);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      mouse.isTouch = true;
      if (!touchSparkles) return;
      if (Math.random() < 0.55) {
        for (let i = 0; i < e.touches.length; i++) {
          const touch = e.touches[i];
          spawnSparklesAt(touch.clientX, touch.clientY, 3);
        }
      }
    };

    const handleWindowClick = (e: MouseEvent) => {
      if (!touchSparkles) return;
      spawnSparklesAt(e.clientX, e.clientY, 10);
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('click', handleWindowClick, { passive: true });
    window.addEventListener('resize', handleResize);

    let time = 0;

    const render = () => {
      time += 0.016;
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse interpolation for PC cursor follow
      if (cursorFollow && mouse.active && !mouse.isTouch) {
        mouse.x += (mouse.targetX - mouse.x) * 0.07;
        mouse.y += (mouse.targetY - mouse.y) * 0.07;
      }

      // Render cosmic stars and moving stardust
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];

        // Maintain organic home coordinates drift
        s.homeX += s.vx * speedMult;
        s.homeY += s.vy * speedMult;
        if (s.homeX < -30) s.homeX = width + 30;
        if (s.homeX > width + 30) s.homeX = -30;
        if (s.homeY < -30) s.homeY = height + 30;
        if (s.homeY > height + 30) s.homeY = -30;

        // Follower stars logic with smooth transition back in place
        if (s.isFollower && cursorFollow && mouse.active && !mouse.isTouch) {
          const orbitAngle = time * 1.5 * s.twinkleSpeed * 10 + (s.followerOffsetAngle || 0);
          const targetX = mouse.x + Math.cos(orbitAngle) * (s.followerDist || 45);
          const targetY = mouse.y + Math.sin(orbitAngle) * (s.followerDist || 45);

          const dx = targetX - s.x;
          const dy = targetY - s.y;
          s.x += dx * 0.038 * speedMult;
          s.y += dy * 0.038 * speedMult;
        } else {
          // Smoothly glide back towards home coordinates or continue drifting
          if (s.isFollower) {
            const hdx = s.homeX - s.x;
            const hdy = s.homeY - s.y;
            // Gentle transition easing back in place
            s.x += hdx * 0.04;
            s.y += hdy * 0.04;
          } else {
            s.x += s.vx * speedMult;
            s.y += s.vy * speedMult;
          }
        }

        // Wrap around boundaries
        if (s.x < -30) s.x = width + 30;
        if (s.x > width + 30) s.x = -30;
        if (s.y < -30) s.y = height + 30;
        if (s.y > height + 30) s.y = -30;

        // Calculate smooth sinusoidal twinkling with high minimum brightness
        const currentAlpha = Math.max(0.40, Math.min(1, s.baseAlpha + Math.sin(time * 3 * s.twinkleSpeed * 10 + s.twinklePhase) * 0.40));

        if (s.isCrossFlare) {
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate((s.flareRotation || 0) + time * 0.25);

          ctx.beginPath();
          ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha})`;
          ctx.shadowColor = palette.starColors[2] || '#38bdf8';
          ctx.shadowBlur = 14;
          ctx.fill();

          const rayLen = s.size * (1.0 + Math.sin(time * 2.5 + s.twinklePhase) * 0.25);
          const gradX = ctx.createLinearGradient(-rayLen, 0, rayLen, 0);
          gradX.addColorStop(0, 'rgba(255, 255, 255, 0)');
          gradX.addColorStop(0.5, `rgba(255, 255, 255, ${currentAlpha})`);
          gradX.addColorStop(1, 'rgba(255, 255, 255, 0)');

          ctx.strokeStyle = gradX;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(-rayLen, 0);
          ctx.lineTo(rayLen, 0);
          ctx.stroke();

          const gradY = ctx.createLinearGradient(0, -rayLen, 0, rayLen);
          gradY.addColorStop(0, 'rgba(255, 255, 255, 0)');
          gradY.addColorStop(0.5, `rgba(255, 255, 255, ${currentAlpha})`);
          gradY.addColorStop(1, 'rgba(255, 255, 255, 0)');

          ctx.strokeStyle = gradY;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(0, -rayLen);
          ctx.lineTo(0, rayLen);
          ctx.stroke();

          ctx.restore();
        } else if (s.isBokeh) {
          ctx.save();
          const radGrad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size);
          radGrad.addColorStop(0, s.color.replace(/[\d\.]+\)$/, `${currentAlpha * 1.2})`));
          radGrad.addColorStop(0.6, s.color.replace(/[\d\.]+\)$/, `${currentAlpha * 0.6})`));
          radGrad.addColorStop(1, s.color.replace(/[\d\.]+\)$/, '0)'));

          ctx.fillStyle = radGrad;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.save();
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fillStyle = s.color;
          ctx.globalAlpha = currentAlpha;

          ctx.shadowColor = s.color;
          ctx.shadowBlur = s.isFollower ? 12 : (s.size > 1.4 ? 9 : 5);
          ctx.fill();
          ctx.restore();
        }
      }

      // Render dynamic Sparkle Bursts
      if (touchSparkles) {
        for (let j = sparkles.length - 1; j >= 0; j--) {
          const p = sparkles[j];
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.95;
          p.vy *= 0.95;
          p.rotation += p.rotSpeed;
          p.alpha -= p.decay;

          if (p.alpha <= 0) {
            sparkles.splice(j, 1);
            continue;
          }

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);

          if (p.isFlare) {
            const ray = p.size * (p.alpha * 0.9 + 0.1);
            ctx.strokeStyle = `rgba(255, 255, 255, ${p.alpha})`;
            ctx.lineWidth = 1.1;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(-ray, 0);
            ctx.lineTo(ray, 0);
            ctx.moveTo(0, -ray);
            ctx.lineTo(0, ray);
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 6;
            ctx.fill();
          }

          ctx.restore();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('click', handleWindowClick);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme, speed, cursorFollow, touchSparkles]);

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none z-0 ${className}`}>
      {/* Dynamic Cosmic Gradient matching the theme */}
      <div 
        className="absolute inset-0 transition-opacity duration-1000"
        style={{
          background: theme === 'liquidglass'
            ? 'radial-gradient(ellipse at 12% 28%, rgba(20, 184, 166, 0.38) 0%, transparent 65%), radial-gradient(ellipse at 88% 85%, rgba(6, 182, 212, 0.40) 0%, transparent 70%), radial-gradient(circle at 50% 50%, rgba(2, 6, 23, 0.2) 0%, rgba(2, 6, 23, 0.85) 100%)'
            : theme === 'midnight'
            ? 'radial-gradient(ellipse at 15% 30%, rgba(6, 182, 212, 0.38) 0%, transparent 65%), radial-gradient(ellipse at 85% 85%, rgba(37, 99, 235, 0.40) 0%, transparent 70%)'
            : theme === 'forest'
            ? 'radial-gradient(ellipse at 15% 30%, rgba(16, 185, 129, 0.38) 0%, transparent 65%), radial-gradient(ellipse at 85% 85%, rgba(20, 184, 166, 0.38) 0%, transparent 70%)'
            : theme === 'crimson'
            ? 'radial-gradient(ellipse at 15% 30%, rgba(244, 63, 94, 0.38) 0%, transparent 65%), radial-gradient(ellipse at 85% 85%, rgba(225, 29, 72, 0.38) 0%, transparent 70%)'
            : 'radial-gradient(ellipse at 15% 30%, rgba(168, 85, 247, 0.40) 0%, transparent 65%), radial-gradient(ellipse at 85% 85%, rgba(236, 72, 153, 0.38) 0%, transparent 70%)'
        }}
      />

      {/* Floating ambient cosmic stardust clouds with high luminosity */}
      <div 
        className="absolute top-[-10%] left-[-5%] w-[65vw] h-[65vh] rounded-full filter blur-[90px] opacity-75 animate-theme-gradient-cyber"
        style={{
          background: theme === 'liquidglass' 
            ? 'radial-gradient(circle, rgba(20, 184, 166, 0.65) 0%, transparent 70%)'
            : theme === 'midnight'
            ? 'radial-gradient(circle, rgba(6, 182, 212, 0.60) 0%, transparent 70%)'
            : theme === 'forest'
            ? 'radial-gradient(circle, rgba(16, 185, 129, 0.60) 0%, transparent 70%)'
            : theme === 'crimson'
            ? 'radial-gradient(circle, rgba(244, 63, 94, 0.60) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(168, 85, 247, 0.65) 0%, transparent 70%)'
        }}
      />

      <div 
        className="absolute bottom-[-15%] right-[-10%] w-[70vw] h-[70vh] rounded-full filter blur-[100px] opacity-80 animate-theme-gradient-aurora"
        style={{
          background: theme === 'liquidglass'
            ? 'radial-gradient(circle, rgba(6, 182, 212, 0.65) 0%, transparent 70%)'
            : theme === 'midnight'
            ? 'radial-gradient(circle, rgba(37, 99, 235, 0.62) 0%, transparent 70%)'
            : theme === 'forest'
            ? 'radial-gradient(circle, rgba(20, 184, 166, 0.60) 0%, transparent 70%)'
            : theme === 'crimson'
            ? 'radial-gradient(circle, rgba(225, 29, 72, 0.60) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(236, 72, 153, 0.62) 0%, transparent 70%)'
        }}
      />

      {/* HTML5 Canvas */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full block" 
      />
    </div>
  );
}
