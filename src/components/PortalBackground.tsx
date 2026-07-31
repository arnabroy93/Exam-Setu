import React, { useMemo } from 'react';
import { motion } from 'motion/react';

interface PortalBackgroundProps {
  children?: React.ReactNode;
}

export const PortalBackground: React.FC<PortalBackgroundProps> = ({ children }) => {
  // Floating live background particles configuration
  const particles = useMemo(() => {
    return Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      size: Math.random() * 10 + 5, // 5px to 15px
      initialX: Math.random() * 100, // percentage based
      initialY: Math.random() * 100, // percentage based
      duration: Math.random() * 10 + 15, // 15s to 25s
      delay: Math.random() * -20, // negative delay so they start pre-dispersed
    }));
  }, []);

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-gradient-to-br from-teal-50/50 via-white to-teal-100/30 flex flex-col">
      {/* Dynamic Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0">
        
        {/* Animated Gradient Orb 1 */}
        <motion.div
          animate={{
            x: [0, 60, -30, 0],
            y: [0, -40, 40, 0],
            scale: [1, 1.12, 0.92, 1],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -top-32 -left-32 w-[400px] h-[400px] rounded-full bg-teal-200/35 blur-3xl"
        />
        
        {/* Animated Gradient Orb 2 */}
        <motion.div
          animate={{
            x: [0, -70, 50, 0],
            y: [0, 60, -50, 0],
            scale: [1, 0.88, 1.08, 1],
          }}
          transition={{
            duration: 28,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -bottom-32 -right-32 w-[450px] h-[450px] rounded-full bg-teal-300/20 blur-3xl"
        />

        {/* Animated Gradient Orb 3 */}
        <motion.div
          animate={{
            scale: [0.92, 1.08, 0.96, 0.92],
            opacity: [0.25, 0.45, 0.35, 0.25],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/3 left-1/4 w-[300px] h-[300px] rounded-full bg-teal-100/40 blur-3xl"
        />

        {/* Dynamic Sweeping Ambient Light Beam */}
        <motion.div
          animate={{
            x: ['-100%', '100%'],
            y: ['-20%', '20%'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute inset-0 bg-gradient-to-tr from-transparent via-teal-400/5 to-transparent -rotate-45 scale-150 pointer-events-none"
        />

        {/* Sophisticated SVG Grid Pattern */}
        <div 
          className="absolute inset-0 bg-[linear-gradient(to_right,#0d948806_1px,transparent_1px),linear-gradient(to_bottom,#0d948806_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]"
        />

        {/* Animated Parallax Liquid Waves at the Bottom */}
        <div className="absolute bottom-0 left-0 right-0 w-full h-[240px] overflow-hidden opacity-30 select-none">
          {/* Wave 1 */}
          <motion.svg
            className="absolute bottom-0 left-0 w-[200%] h-full text-teal-400/8 fill-current"
            viewBox="0 0 1440 320"
            preserveAspectRatio="none"
            animate={{
              x: [0, -1440],
              y: [0, 6, -4, 0],
            }}
            transition={{
              x: { duration: 30, repeat: Infinity, ease: "linear" },
              y: { duration: 12, repeat: Infinity, ease: "easeInOut" }
            }}
          >
            <path d="M0,160 C320,300 480,120 720,220 C960,320 1120,100 1440,180 C1760,260 1920,140 2160,200 C2400,260 2560,120 2880,180 L2880,320 L0,320 Z" />
          </motion.svg>

          {/* Wave 2 */}
          <motion.svg
            className="absolute bottom-0 left-0 w-[200%] h-full text-emerald-400/5 fill-current"
            viewBox="0 0 1440 320"
            preserveAspectRatio="none"
            animate={{
              x: [-1440, 0],
              y: [0, -10, 5, 0],
            }}
            transition={{
              x: { duration: 40, repeat: Infinity, ease: "linear" },
              y: { duration: 16, repeat: Infinity, ease: "easeInOut" }
            }}
          >
            <path d="M0,120 C240,240 480,80 720,180 C960,280 1200,100 1440,140 C1680,180 1920,80 2160,160 C2400,240 2640,120 2880,140 L2880,320 L0,320 Z" />
          </motion.svg>
        </div>

        {/* Floating Live Background Particles */}
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-gradient-to-r from-teal-400/15 to-emerald-400/10 blur-[1px]"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.initialX}%`,
              top: `${p.initialY}%`,
            }}
            animate={{
              y: [0, -600],
              x: [0, Math.sin(p.id) * 50, -Math.sin(p.id) * 50, 0],
              opacity: [0, 0.6, 0.3, 0],
              scale: [0.8, 1.25, 0.9, 0.8],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: "linear",
            }}
          />
        ))}
      </div>

      {/* Content Layer */}
      <div className="relative z-10 w-full min-h-screen flex flex-col flex-1">
        {children}
      </div>
    </div>
  );
};
