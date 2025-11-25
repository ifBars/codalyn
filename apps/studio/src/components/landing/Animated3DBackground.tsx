"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Points, PointMaterial, Stars } from "@react-three/drei";
import * as THREE from "three";

function FloatingParticles({ mouse, introProgress, isEasterEggActive }: { mouse: { x: number; y: number }; introProgress: number; isEasterEggActive: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const originalPositions = useRef<Float32Array | null>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const [positions] = useState(() => {
    const count = 800;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i += 3) {
      pos[i] = (Math.random() - 0.5) * 15;
      pos[i + 1] = (Math.random() - 0.5) * 15;
      pos[i + 2] = (Math.random() - 0.5) * 15;
    }
    return pos;
  });

  useEffect(() => {
    if (ref.current && ref.current.geometry) {
      originalPositions.current = new Float32Array(positions);
      const geometry = ref.current.geometry;
      if (!geometry.attributes.position) {
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      }
    }
  }, [positions]);

  useFrame((state) => {
    if (!ref.current || !originalPositions.current || !ref.current.geometry || !materialRef.current) return;
    
    const geometry = ref.current.geometry;
    const posAttribute = geometry.attributes.position;
    if (!posAttribute) return;
    
    const posArray = posAttribute.array as Float32Array;
    const time = state.clock.elapsedTime;
    
    // Intro animation - fade in and expand from center
    const introScale = THREE.MathUtils.smoothstep(introProgress, 0, 1);
    materialRef.current.opacity = (isEasterEggActive ? 0.8 : 0.4) * introScale;
    materialRef.current.size = isEasterEggActive ? 0.15 : 0.08;
    
    for (let i = 0; i < posArray.length; i += 3) {
      const i3 = i / 3;
      const originalX = originalPositions.current[i];
      const originalY = originalPositions.current[i + 1];
      const originalZ = originalPositions.current[i + 2];
      
      // Intro animation - particles expand from center
      const currentX = originalX * introScale;
      const currentY = originalY * introScale;
      const currentZ = originalZ * introScale;
      
      // Create subtle wave-like motion with pulsing effect
      const pulse = Math.sin(time * 0.5 + i3 * 0.02) * 0.1;
      
      // Easter egg excitement - reduced to be calmer
      const excitement = isEasterEggActive ? 0.5 : 0;
      const speedMult = isEasterEggActive ? 1.5 : 1;

      posArray[i] = currentX + Math.cos(time * 0.2 * speedMult + i3 * 0.01) * (pulse + excitement);
      posArray[i + 1] = currentY + Math.sin(time * 0.3 * speedMult + i3 * 0.01) * (0.2 + pulse + excitement);
      posArray[i + 2] = currentZ + Math.cos(time * 0.2 * speedMult + i3 * 0.01) * (0.15 + pulse + excitement);
      
      if (!isEasterEggActive) {
      // Subtle mouse interaction - particles move away from mouse
      const mouseX = mouse.x * 6;
      const mouseY = mouse.y * 6;
      const dx = posArray[i] - mouseX;
      const dy = posArray[i + 1] - mouseY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 3) {
        const force = (3 - distance) / 3;
        posArray[i] += (dx / distance) * force * 0.05;
        posArray[i + 1] += (dy / distance) * force * 0.05;
      } else {
        // Return to animated position gradually
        posArray[i] += (currentX - posArray[i]) * 0.03;
        posArray[i + 1] += ((currentY + Math.sin(time * 0.3 + i3 * 0.01) * 0.2) - posArray[i + 1]) * 0.03;
        }
      }
    }
    
    posAttribute.needsUpdate = true;
  });

  return (
    <Points ref={ref} positions={positions}>
      <PointMaterial
        ref={materialRef}
        transparent
        color={isEasterEggActive ? "#ffffff" : "#c0c0c0"}
        size={0.08}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0}
      />
    </Points>
  );
}

function AnimatedMesh({ 
  mouse, 
  introProgress, 
  onSpinDetected,
  isEasterEggActive,
  easterEggProgress
}: { 
  mouse: { x: number; y: number }; 
  introProgress: number;
  onSpinDetected?: () => void;
  isEasterEggActive: boolean;
  easterEggProgress: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const rotationRef = useRef({ x: 0, y: 0 });
  
  // Spin detection refs
  const spinVelocityMagnitudeRef = useRef(0);
  const fastSpinStartTimeRef = useRef<number | null>(null);
  const cumulativeSpinTimeRef = useRef(0);
  const hasTriggeredRef = useRef(false);
  
  // Thresholds for easter egg trigger
  const FAST_SPIN_THRESHOLD = 3.0; 
  const FAST_SPIN_DURATION = 1.5; 
  const CUMULATIVE_SPIN_THRESHOLD = 6.0;
  
  useFrame((state, delta) => {
    if (!meshRef.current || !materialRef.current) return;
    
    const time = state.clock.elapsedTime;
    const currentTime = state.clock.elapsedTime;
    
    // Intro animation
    const introScale = THREE.MathUtils.smoothstep(introProgress, 0, 1);
    const introRotation = introProgress * Math.PI * 2;
    const pulse = Math.sin(time * 0.8) * 0.05;
    
    // Base appearance
    materialRef.current.opacity = (0.25 + pulse * 0.1) * introScale;
    materialRef.current.emissiveIntensity = (0.4 + Math.sin(time * 1.2) * 0.2) * introScale;
    
    // Easter Egg Effects Overrides
    if (isEasterEggActive) {
        // Smooth transition using sine wave
        const peak = Math.sin(easterEggProgress * Math.PI);
        
        materialRef.current.emissiveIntensity = 0.4 + peak * 1.5; // Brighter but not blinding
        // Subtle blue-ish tint instead of rainbow
        const blueShift = 0.6 + peak * 0.2; 
        materialRef.current.color.setHSL(0.6, 0.5, blueShift);
        materialRef.current.wireframe = true;

        // Elegant rotation - faster than normal but smooth
        meshRef.current.rotation.x += delta * (1 + peak * 2);
        meshRef.current.rotation.y += delta * (2 + peak * 3);
        // No Z rotation addition to keep it cleaner

        // Gentle pulse scale
        const wobble = Math.sin(time * 3) * 0.1 * peak;
        meshRef.current.scale.setScalar(introScale * (1 + wobble));

        return; // Skip normal physics update during easter egg
    } else {
        // Reset color if returning
        materialRef.current.color.set("#a0a0a0");
    }

    // Normal Physics Logic
    const mouseDeltaX = mouse.x - lastMouseRef.current.x;
    const mouseDeltaY = mouse.y - lastMouseRef.current.y;
    const movementSpeed = Math.sqrt(mouseDeltaX * mouseDeltaX + mouseDeltaY * mouseDeltaY);
    
    const baseMomentumStrength = 0.5;
    const speedMultiplier = 1 + movementSpeed * 8;
    const momentumStrength = baseMomentumStrength * speedMultiplier;
    
    velocityRef.current.x += mouseDeltaX * momentumStrength;
    velocityRef.current.y += mouseDeltaY * momentumStrength;
    
    const baseFriction = 0.92;
    const velocityMagnitude = Math.sqrt(velocityRef.current.x * velocityRef.current.x + velocityRef.current.y * velocityRef.current.y);
    const dynamicFriction = baseFriction + Math.min(velocityMagnitude * 0.03, 0.05);
    velocityRef.current.x *= dynamicFriction;
    velocityRef.current.y *= dynamicFriction;
    
    const rotationSpeed = 1.5 + velocityMagnitude * 2;
    rotationRef.current.x += velocityRef.current.y * delta * rotationSpeed;
    rotationRef.current.y += velocityRef.current.x * delta * rotationSpeed;
    
    // Spin detection
    const rotationDeltaX = Math.abs(velocityRef.current.y * delta * rotationSpeed);
    const rotationDeltaY = Math.abs(velocityRef.current.x * delta * rotationSpeed);
    spinVelocityMagnitudeRef.current = Math.sqrt(rotationDeltaX * rotationDeltaX + rotationDeltaY * rotationDeltaY) / delta;
    
    if (!hasTriggeredRef.current && introProgress >= 0.9) {
      if (spinVelocityMagnitudeRef.current > FAST_SPIN_THRESHOLD) {
        if (fastSpinStartTimeRef.current === null) fastSpinStartTimeRef.current = currentTime;
        else if (currentTime - fastSpinStartTimeRef.current >= FAST_SPIN_DURATION) {
            hasTriggeredRef.current = true;
            onSpinDetected?.();
        }
        cumulativeSpinTimeRef.current += delta;
        if (cumulativeSpinTimeRef.current >= CUMULATIVE_SPIN_THRESHOLD) {
          hasTriggeredRef.current = true;
          onSpinDetected?.();
        }
      } else {
        fastSpinStartTimeRef.current = null;
      }
    }
    
    // Apply normal rotation
    meshRef.current.rotation.x = rotationRef.current.x + Math.sin(time * 0.1) * 0.1 + introRotation * 0.2;
    meshRef.current.rotation.y = rotationRef.current.y + introRotation * 0.3 + Math.cos(time * 0.12) * 0.08;
    meshRef.current.rotation.z += 0.0005 + Math.cos(time * 0.15) * 0.0002;
    
    lastMouseRef.current.x = mouse.x;
    lastMouseRef.current.y = mouse.y;
    
    const mouseDistance = Math.sqrt(mouse.x * mouse.x + mouse.y * mouse.y);
    const baseScale = introScale * (0.8 + introProgress * 0.2);
    const scalePulse = 1 + pulse * 0.3;
    meshRef.current.scale.setScalar(baseScale * scalePulse * (1 + mouseDistance * 0.1));
  });

  // Reset hasTriggered when easter egg ends
  useEffect(() => {
    if (!isEasterEggActive) {
       hasTriggeredRef.current = false;
       cumulativeSpinTimeRef.current = 0;
       // Reset velocity to prevent immediate re-triggering
       velocityRef.current = { x: 0, y: 0 };
       
       // Reset rotation ref to current mesh rotation to prevent snap
       if (meshRef.current) {
           rotationRef.current.x = meshRef.current.rotation.x;
           rotationRef.current.y = meshRef.current.rotation.y;
       }
    }
  }, [isEasterEggActive]);

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <torusGeometry args={[2, 0.5, 16, 100]} />
      <meshStandardMaterial
        ref={materialRef}
        color="#a0a0a0"
        emissive="#c0c0c0"
        emissiveIntensity={0.4}
        wireframe
        transparent
        opacity={0}
      />
    </mesh>
  );
}

function OrbitingSphere({ 
  index, 
  total, 
  introProgress,
  orbitAngleRef,
  orbitSpeedRef,
  isEasterEggActive
}: { 
  index: number; 
  total: number; 
  introProgress: number;
  orbitAngleRef: React.MutableRefObject<number>;
  orbitSpeedRef: React.MutableRefObject<number>;
  isEasterEggActive: boolean;
}) {
  const sphereRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  useFrame((state) => {
    if (!materialRef.current || !sphereRef.current) return;
    
    const time = state.clock.elapsedTime;
    const delay = index / total;
    const sphereIntroProgress = Math.max(0, (introProgress - delay * 0.3) / 0.7);
    const introScale = THREE.MathUtils.smoothstep(sphereIntroProgress, 0, 1);
    
    const pulse = Math.sin(time * 1.5 + index) * 0.15;
    
    if (isEasterEggActive) {
        materialRef.current.opacity = 0.8;
        materialRef.current.emissiveIntensity = 0.8 + Math.sin(time * 2) * 0.3;
        // Keep a consistent tech blue/white theme
        materialRef.current.color.setHSL(0.6, 0.2, 0.8);
        
        // Gentler wild orbit
        const wildAngle = orbitAngleRef.current + (index / total) * Math.PI * 2;
        const wildRadius = 3 + Math.sin(time * 1.5 + index) * 0.5;
        sphereRef.current.position.x = Math.cos(wildAngle) * wildRadius;
        sphereRef.current.position.y = Math.sin(wildAngle * 1.5) * wildRadius * 0.5;
        sphereRef.current.position.z = Math.sin(wildAngle) * wildRadius;
        sphereRef.current.scale.setScalar(introScale * (1.2 + pulse));
    } else {
    materialRef.current.opacity = (0.4 + pulse * 0.2) * introScale;
    materialRef.current.emissiveIntensity = (0.6 + Math.sin(time * 2 + index) * 0.3) * introScale;
        materialRef.current.color.set("#b4b4b4");
    
    const scalePulse = 1 + pulse * 0.2;
    sphereRef.current.scale.setScalar(introScale * scalePulse);
    
        const torusRadius = 2;
        const torusTube = 0.5;
    const baseAngle = (index / total) * Math.PI * 2;
        const u = baseAngle + orbitAngleRef.current;
    const v = (time * 0.8 + index * 0.5) % (Math.PI * 2);
    
    const R = torusRadius;
    const r = torusTube;
    sphereRef.current.position.x = (R + r * Math.cos(v)) * Math.cos(u);
    sphereRef.current.position.y = (R + r * Math.cos(v)) * Math.sin(u);
    sphereRef.current.position.z = r * Math.sin(v);
    }
  });
  
  return (
    <mesh ref={sphereRef}>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshStandardMaterial
        ref={materialRef}
        color="#b4b4b4"
        emissive="#c0c0c0"
        emissiveIntensity={0.6}
        transparent
        opacity={0}
      />
    </mesh>
  );
}

function OrbitingSpheres({ mouse, introProgress, isEasterEggActive }: { mouse: { x: number; y: number }; introProgress: number; isEasterEggActive: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const orbitAngleRef = useRef(0);
  const orbitSpeedRef = useRef(0);
  
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    const time = state.clock.elapsedTime;
    const introScale = THREE.MathUtils.smoothstep(introProgress, 0, 1);
    const pulse = Math.sin(time * 0.6) * 0.05;
    
    groupRef.current.scale.setScalar(introScale * (1 + pulse));
    
    if (isEasterEggActive) {
        orbitSpeedRef.current = 1.5; // Moderate orbit speed
    } else {
    const baseSpeed = introProgress * 0.3;
    const mouseInfluence = Math.sqrt(mouse.x * mouse.x + mouse.y * mouse.y) * 0.1;
    const speedVariation = Math.sin(time * 0.3) * 0.05;
    orbitSpeedRef.current = baseSpeed + mouseInfluence + speedVariation;
    
    groupRef.current.rotation.x = time * 0.05 + mouse.y * 0.1;
    groupRef.current.rotation.y = time * 0.08 + mouse.x * 0.1;
    groupRef.current.rotation.z = Math.sin(time * 0.15) * 0.05;
    }
    
    orbitAngleRef.current += orbitSpeedRef.current * delta;
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: 6 }).map((_, i) => (
        <OrbitingSphere
          key={i}
          index={i}
          total={6}
          introProgress={introProgress}
          orbitAngleRef={orbitAngleRef}
          orbitSpeedRef={orbitSpeedRef}
          isEasterEggActive={isEasterEggActive}
        />
      ))}
    </group>
  );
}

function EasterEggEffects({ isActive, progress }: { isActive: boolean; progress: number }) {
    const { camera } = useThree();
    const starsRef = useRef<any>(null);

    useFrame((state) => {
        if (!isActive) {
            // Reset camera smoothly if needed
            camera.position.lerp(new THREE.Vector3(0, 0, 5), 0.05);
            camera.lookAt(0, 0, 0);
            return;
        }

        const time = state.clock.elapsedTime;
        
        // Smooth, slow orbit around
        const orbitSpeed = 0.2;
        const radius = 6;
        
        // Orbit around slowly
        camera.position.x = Math.sin(time * orbitSpeed) * radius;
        camera.position.z = Math.cos(time * orbitSpeed) * radius;
        camera.position.y = Math.sin(time * 0.2) * 1.5;
        camera.lookAt(0, 0, 0);

        if (starsRef.current) {
            starsRef.current.rotation.y += 0.0005;
        }
    });

    if (!isActive) return null;

    return (
        <group>
            <Stars ref={starsRef} radius={50} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
            <pointLight position={[0, 0, 0]} intensity={1.5} color="#ffffff" distance={10} />
            <ambientLight intensity={0.5} />
    </group>
  );
}

export function Animated3DBackground({ 
  onEasterEggChange 
}: { 
  onEasterEggChange?: (state: { isActive: boolean }) => void;
}) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [introProgress, setIntroProgress] = useState(0);
  const [isEasterEggActive, setIsEasterEggActive] = useState(false);
  const [easterEggProgress, setEasterEggProgress] = useState(0);
  const mouseRef = useRef({ x: 0, y: 0 });
  const easterEggStartTimeRef = useRef<number | null>(null);
  const easterEggDuration = 8000; // 8 seconds duration

  useEffect(() => {
    const startTime = Date.now();
    const duration = 2000;
    
    const animateIntro = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setIntroProgress(eased);
      
      if (progress < 1) {
        requestAnimationFrame(animateIntro);
      }
    };
    
    requestAnimationFrame(animateIntro);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      mouseRef.current = { x, y };
      setMouse({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleSpinDetected = () => {
    if (!isEasterEggActive) {
      setIsEasterEggActive(true);
      easterEggStartTimeRef.current = Date.now();
      setEasterEggProgress(0);
      onEasterEggChange?.({ isActive: true });
    }
  };

  useEffect(() => {
    if (!isEasterEggActive) return;
    
    const animateEasterEgg = () => {
      if (!easterEggStartTimeRef.current) return;
      
      const elapsed = Date.now() - easterEggStartTimeRef.current;
      const progress = Math.min(elapsed / easterEggDuration, 1);
      
      setEasterEggProgress(progress);
      
      if (progress < 1) {
        requestAnimationFrame(animateEasterEgg);
      } else {
        setIsEasterEggActive(false);
        setEasterEggProgress(0);
        easterEggStartTimeRef.current = null;
        onEasterEggChange?.({ isActive: false });
      }
    };
    
    requestAnimationFrame(animateEasterEgg);
  }, [isEasterEggActive, onEasterEggChange]);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none w-screen h-screen">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 75 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        style={{ width: '100%', height: '100%', background: 'transparent', display: 'block' }}
      >
        <ambientLight intensity={0.4} color="#ffffff" />
        <pointLight position={[10, 10, 10]} intensity={0.6} color="#ffffff" />
        <pointLight position={[-10, -10, -10]} intensity={0.4} color="#c0c0c0" />
        <pointLight position={[0, 0, 10]} intensity={0.3} color="#c0c0c0" />
        <directionalLight position={[5, 5, 5]} intensity={0.3} color="#ffffff" />
        <directionalLight position={[-5, -5, -5]} intensity={0.2} color="#c0c0c0" />
        
        <FloatingParticles 
          mouse={mouse} 
          introProgress={introProgress} 
          isEasterEggActive={isEasterEggActive} 
        />
        
        <AnimatedMesh 
          mouse={mouse} 
          introProgress={introProgress} 
          onSpinDetected={handleSpinDetected}
          isEasterEggActive={isEasterEggActive}
          easterEggProgress={easterEggProgress}
        />
        
        <OrbitingSpheres 
          mouse={mouse} 
          introProgress={introProgress} 
          isEasterEggActive={isEasterEggActive}
        />

        <EasterEggEffects 
          isActive={isEasterEggActive} 
          progress={easterEggProgress} 
        />
      </Canvas>
    </div>
  );
}
