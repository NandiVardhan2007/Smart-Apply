import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function AnimatedBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);
  const orb3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!orb1Ref.current || !orb2Ref.current || !orb3Ref.current) return;

    // Subtle floating animations for background orbs
    const tl1 = gsap.timeline({ repeat: -1, yoyo: true });
    tl1.to(orb1Ref.current, {
      x: '10vw',
      y: '15vh',
      rotation: 45,
      duration: 20,
      ease: 'sine.inOut',
    });

    const tl2 = gsap.timeline({ repeat: -1, yoyo: true });
    tl2.to(orb2Ref.current, {
      x: '-15vw',
      y: '10vh',
      rotation: -30,
      duration: 25,
      ease: 'sine.inOut',
    });

    const tl3 = gsap.timeline({ repeat: -1, yoyo: true });
    tl3.to(orb3Ref.current, {
      x: '5vw',
      y: '-20vh',
      rotation: 90,
      duration: 22,
      ease: 'sine.inOut',
    });

    return () => {
      tl1.kill();
      tl2.kill();
      tl3.kill();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        overflow: 'hidden',
        pointerEvents: 'none',
        background: 'var(--bg-primary)',
      }}
    >
      <div
        ref={orb1Ref}
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-10%',
          width: '50vw',
          height: '50vw',
          background: 'radial-gradient(circle, rgba(0, 112, 243, 0.15) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%',
          filter: 'blur(60px)',
        }}
      />
      <div
        ref={orb2Ref}
        style={{
          position: 'absolute',
          top: '40%',
          right: '-10%',
          width: '60vw',
          height: '60vw',
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.1) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%',
          filter: 'blur(80px)',
        }}
      />
      <div
        ref={orb3Ref}
        style={{
          position: 'absolute',
          bottom: '-20%',
          left: '20%',
          width: '70vw',
          height: '70vw',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(0,0,0,0) 70%)',
          borderRadius: '50%',
          filter: 'blur(90px)',
        }}
      />
    </div>
  );
}
