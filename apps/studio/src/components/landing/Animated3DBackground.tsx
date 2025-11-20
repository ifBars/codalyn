"use client";

import { useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Points, PointMaterial, Stars, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function FloatingParticles({ mouse, introProgress }: { mouse: { x: number; y: number }; introProgress: number }) {
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
    materialRef.current.opacity = 0.4 * introScale;
    
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
      posArray[i] = currentX + Math.cos(time * 0.2 + i3 * 0.01) * pulse;
      posArray[i + 1] = currentY + Math.sin(time * 0.3 + i3 * 0.01) * (0.2 + pulse);
      posArray[i + 2] = currentZ + Math.cos(time * 0.2 + i3 * 0.01) * (0.15 + pulse);
      
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
    
    posAttribute.needsUpdate = true;
  });

  return (
    <Points ref={ref} positions={positions}>
      <PointMaterial
        ref={materialRef}
        transparent
        color="#c0c0c0"
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
  onSpinDetected 
}: { 
  mouse: { x: number; y: number }; 
  introProgress: number;
  onSpinDetected?: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const rotationRef = useRef({ x: 0, y: 0 });
  const lastUpdateTimeRef = useRef(0);
  
  // Spin detection refs
  const spinVelocityMagnitudeRef = useRef(0);
  const fastSpinStartTimeRef = useRef<number | null>(null);
  const cumulativeSpinTimeRef = useRef(0);
  const lastSpinCheckTimeRef = useRef(0);
  const hasTriggeredRef = useRef(false);
  
  // Thresholds for easter egg trigger
  const FAST_SPIN_THRESHOLD = 3.0; // Velocity magnitude threshold
  const FAST_SPIN_DURATION = 2.0; // Seconds of continuous fast spinning
  const CUMULATIVE_SPIN_THRESHOLD = 8.0; // Total seconds spinning above threshold
  
  useFrame((state, delta) => {
    if (!meshRef.current || !materialRef.current) return;
    
    const time = state.clock.elapsedTime;
    const currentTime = state.clock.elapsedTime;
    
    // Intro animation - scale in and rotate with cool effect
    const introScale = THREE.MathUtils.smoothstep(introProgress, 0, 1);
    const introRotation = introProgress * Math.PI * 2;
    const pulse = Math.sin(time * 0.8) * 0.05;
    materialRef.current.opacity = (0.25 + pulse * 0.1) * introScale;
    materialRef.current.emissiveIntensity = (0.4 + Math.sin(time * 1.2) * 0.2) * introScale;
    
    // Calculate mouse velocity (delta movement)
    const mouseDeltaX = mouse.x - lastMouseRef.current.x;
    const mouseDeltaY = mouse.y - lastMouseRef.current.y;
    
    // Calculate movement speed (magnitude of delta)
    const movementSpeed = Math.sqrt(mouseDeltaX * mouseDeltaX + mouseDeltaY * mouseDeltaY);
    
    // Dynamic momentum strength - stronger for quick movements
    // Quick movements get exponentially more momentum
    const baseMomentumStrength = 0.5;
    const speedMultiplier = 1 + movementSpeed * 8; // Amplify quick movements
    const momentumStrength = baseMomentumStrength * speedMultiplier;
    
    // Add momentum based on mouse movement speed and direction
    velocityRef.current.x += mouseDeltaX * momentumStrength;
    velocityRef.current.y += mouseDeltaY * momentumStrength;
    
    // Apply friction/damping to gradually slow down
    // Less friction when velocity is high (spins longer with momentum)
    const baseFriction = 0.92;
    const velocityMagnitude = Math.sqrt(velocityRef.current.x * velocityRef.current.x + velocityRef.current.y * velocityRef.current.y);
    const dynamicFriction = baseFriction + Math.min(velocityMagnitude * 0.03, 0.05); // Less friction when spinning fast
    velocityRef.current.x *= dynamicFriction;
    velocityRef.current.y *= dynamicFriction;
    
    // Update rotation based on accumulated velocity with momentum
    // The faster the velocity, the more rotation per frame
    const rotationSpeed = 1.5 + velocityMagnitude * 2; // Speed up rotation when momentum is high
    rotationRef.current.x += velocityRef.current.y * delta * rotationSpeed;
    rotationRef.current.y += velocityRef.current.x * delta * rotationSpeed;
    
    // Calculate spin velocity magnitude (rotation speed)
    const rotationDeltaX = Math.abs(velocityRef.current.y * delta * rotationSpeed);
    const rotationDeltaY = Math.abs(velocityRef.current.x * delta * rotationSpeed);
    spinVelocityMagnitudeRef.current = Math.sqrt(rotationDeltaX * rotationDeltaX + rotationDeltaY * rotationDeltaY) / delta;
    
    // Spin detection logic
    if (!hasTriggeredRef.current && introProgress >= 0.9) {
      const isSpinningFast = spinVelocityMagnitudeRef.current > FAST_SPIN_THRESHOLD;
      
      if (isSpinningFast) {
        // Track continuous fast spin
        if (fastSpinStartTimeRef.current === null) {
          fastSpinStartTimeRef.current = currentTime;
        } else {
          const fastSpinDuration = currentTime - fastSpinStartTimeRef.current;
          if (fastSpinDuration >= FAST_SPIN_DURATION) {
            hasTriggeredRef.current = true;
            onSpinDetected?.();
            return;
          }
        }
        
        // Track cumulative spin time
        cumulativeSpinTimeRef.current += delta;
        
        // Check cumulative threshold
        if (cumulativeSpinTimeRef.current >= CUMULATIVE_SPIN_THRESHOLD) {
          hasTriggeredRef.current = true;
          onSpinDetected?.();
          return;
        }
      } else {
        // Reset fast spin timer if not spinning fast
        fastSpinStartTimeRef.current = null;
      }
    }
    
    // Apply rotation with intro animation
    meshRef.current.rotation.x = rotationRef.current.x + Math.sin(time * 0.1) * 0.1 + introRotation * 0.2;
    meshRef.current.rotation.y = rotationRef.current.y + introRotation * 0.3 + Math.cos(time * 0.12) * 0.08;
    
    // Add very subtle animation with pulsing
    meshRef.current.rotation.z += 0.0005 + Math.cos(time * 0.15) * 0.0002;
    
    // Update last mouse position
    lastMouseRef.current.x = mouse.x;
    lastMouseRef.current.y = mouse.y;
    lastUpdateTimeRef.current = currentTime;
    
    // Intro scale + subtle scale based on mouse distance from center with pulse
    const mouseDistance = Math.sqrt(mouse.x * mouse.x + mouse.y * mouse.y);
    const baseScale = introScale * (0.8 + introProgress * 0.2);
    const scalePulse = 1 + pulse * 0.3;
    meshRef.current.scale.setScalar(baseScale * scalePulse * (1 + mouseDistance * 0.1));
  });

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
  mouse, 
  introProgress,
  orbitAngleRef,
  orbitSpeedRef
}: { 
  index: number; 
  total: number; 
  mouse: { x: number; y: number }; 
  introProgress: number;
  orbitAngleRef: React.MutableRefObject<number>;
  orbitSpeedRef: React.MutableRefObject<number>;
}) {
  const sphereRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  // Torus parameters: radius=2, tube=0.5, so inner edge is at radius 1.5
  const torusRadius = 2;
  const torusTube = 0.5;
  const innerEdgeRadius = torusRadius - torusTube; // 1.5
  
  useFrame((state) => {
    if (!materialRef.current || !sphereRef.current) return;
    
    const time = state.clock.elapsedTime;
    
    // Intro animation - fade in with delay based on index
    const delay = index / total;
    const sphereIntroProgress = Math.max(0, (introProgress - delay * 0.3) / 0.7);
    const introScale = THREE.MathUtils.smoothstep(sphereIntroProgress, 0, 1);
    
    // Pulsing effect
    const pulse = Math.sin(time * 1.5 + index) * 0.15;
    materialRef.current.opacity = (0.4 + pulse * 0.2) * introScale;
    materialRef.current.emissiveIntensity = (0.6 + Math.sin(time * 2 + index) * 0.3) * introScale;
    
    // Scale with pulse
    const scalePulse = 1 + pulse * 0.2;
    sphereRef.current.scale.setScalar(introScale * scalePulse);
    
    // Calculate position along the inner edge of the torus
    // Each sphere has a base angle offset, plus orbital motion
    const baseAngle = (index / total) * Math.PI * 2;
    const currentAngle = baseAngle + orbitAngleRef.current;
    
    // Position along the inner edge of the torus (circular path)
    // Add slight vertical variation for more natural atom-like appearance
    const verticalOffset = Math.sin(currentAngle * 2 + index) * 0.2;
    
    sphereRef.current.position.x = Math.cos(currentAngle) * innerEdgeRadius;
    sphereRef.current.position.y = Math.sin(currentAngle) * innerEdgeRadius + verticalOffset;
    sphereRef.current.position.z = Math.cos(currentAngle * 1.5 + index) * 0.3; // Slight depth variation
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

// Science Visualization Components for Easter Egg - Reusing existing components with transformations

// Camera controller for easter egg animations
function EasterEggCamera({ progress }: { progress: number }) {
  const { camera } = useThree();
  
  useFrame(() => {
    // Smooth camera movement through scenes
    if (progress < 0.33) {
      // Atom scene - closer, rotating around
      const atomProgress = progress / 0.33;
      const angle = atomProgress * Math.PI * 2;
      camera.position.x = Math.cos(angle) * 4;
      camera.position.y = Math.sin(angle * 0.5) * 2;
      camera.position.z = 5 + Math.sin(angle) * 1;
      camera.lookAt(0, 0, 0);
    } else if (progress < 0.66) {
      // Neutron scene - pull back, dramatic angle
      const neutronProgress = (progress - 0.33) / 0.33;
      camera.position.x = Math.sin(neutronProgress * Math.PI) * 3;
      camera.position.y = 2 + Math.cos(neutronProgress * Math.PI) * 2;
      camera.position.z = 6 + neutronProgress * 2;
      camera.lookAt(0, 0, 0);
    } else {
      // Planet scene - wide orbit
      const planetProgress = (progress - 0.66) / 0.34;
      const angle = planetProgress * Math.PI * 2;
      camera.position.x = Math.cos(angle) * 8;
      camera.position.y = 3;
      camera.position.z = Math.sin(angle) * 8;
      camera.lookAt(0, 0, 0);
    }
  });
  
  return null;
}

// Atom Scene - Transforms torus into nucleus, particles into electron shells
function AtomScene({ progress }: { progress: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const nucleusRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const particlesPositionsRef = useRef<Float32Array | null>(null);
  const originalPositionsRef = useRef<Float32Array | null>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  
  // Fade in/out based on progress (0-0.33)
  const sceneProgress = Math.max(0, Math.min(1, progress / 0.33));
  const fadeIn = THREE.MathUtils.smoothstep(sceneProgress, 0, 0.2);
  const fadeOut = THREE.MathUtils.smoothstep(sceneProgress, 0.8, 1);
  const opacity = fadeIn * (1 - fadeOut);
  
  // Initialize particles in electron shell configuration
  useEffect(() => {
    if (!particlesRef.current) return;
    
    const count = 200; // More particles for electron clouds
    const positions = new Float32Array(count * 3);
    const originalPositions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Distribute particles in spherical shells (electron probability clouds)
      const shell = Math.floor(Math.random() * 3) + 1; // 3 shells
      const radius = shell * 1.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      
      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);
      
      originalPositions[i3] = positions[i3];
      originalPositions[i3 + 1] = positions[i3 + 1];
      originalPositions[i3 + 2] = positions[i3 + 2];
    }
    
    particlesPositionsRef.current = positions;
    originalPositionsRef.current = originalPositions;
    
    const geometry = particlesRef.current.geometry;
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  }, []);
  
  useFrame((state) => {
    if (!groupRef.current || !nucleusRef.current || !particlesRef.current || !materialRef.current) return;
    
    const time = state.clock.elapsedTime;
    
    // Rotate entire atom
    groupRef.current.rotation.y = time * 0.3;
    groupRef.current.rotation.x = Math.sin(time * 0.2) * 0.2;
    
    // Pulse nucleus (torus transformed into sphere)
    const pulse = 1 + Math.sin(time * 2.5) * 0.15;
    nucleusRef.current.scale.setScalar(pulse * opacity);
    
    // Animate electron cloud particles
    if (particlesRef.current.geometry && particlesPositionsRef.current && originalPositionsRef.current) {
      const posAttribute = particlesRef.current.geometry.attributes.position;
      if (posAttribute) {
        const posArray = posAttribute.array as Float32Array;
        for (let i = 0; i < posArray.length; i += 3) {
          const i3 = i / 3;
          const originalX = originalPositionsRef.current[i];
          const originalY = originalPositionsRef.current[i + 1];
          const originalZ = originalPositionsRef.current[i + 2];
          
          // Quantum cloud effect - particles move in probability waves
          const wave1 = Math.sin(time * 1.5 + i3 * 0.05) * 0.3;
          const wave2 = Math.cos(time * 1.2 + i3 * 0.03) * 0.2;
          const wave3 = Math.sin(time * 0.8 + i3 * 0.07) * 0.15;
          
          posArray[i] = originalX + wave1;
          posArray[i + 1] = originalY + wave2;
          posArray[i + 2] = originalZ + wave3;
        }
        posAttribute.needsUpdate = true;
      }
    }
    
    materialRef.current.opacity = 0.6 * opacity;
  });
  
  if (opacity < 0.01) return null;
  
  return (
    <group ref={groupRef}>
      {/* Nucleus - transformed torus into pulsing sphere */}
      <mesh ref={nucleusRef}>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial
          color="#a0a0a0"
          emissive="#c0c0c0"
          emissiveIntensity={0.8 * opacity}
          wireframe={false}
          transparent
          opacity={opacity}
        />
      </mesh>
      
      {/* Electron cloud - transformed particles */}
      <Points ref={particlesRef}>
        <PointMaterial
          ref={materialRef}
          transparent
          color="#c0c0c0"
          size={0.12}
          sizeAttenuation={true}
          depthWrite={false}
          opacity={0}
        />
      </Points>
    </group>
  );
}

// Neutron Scene - Transforms torus into particle accelerator, particles swarm around
function NeutronScene({ progress }: { progress: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const acceleratorRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const particlesPositionsRef = useRef<Float32Array | null>(null);
  const originalPositionsRef = useRef<Float32Array | null>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const acceleratorMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  // Fade in/out based on progress (0.33-0.66)
  const sceneProgress = Math.max(0, Math.min(1, (progress - 0.33) / 0.33));
  const fadeIn = THREE.MathUtils.smoothstep(sceneProgress, 0, 0.2);
  const fadeOut = THREE.MathUtils.smoothstep(sceneProgress, 0.8, 1);
  const opacity = fadeIn * (1 - fadeOut);
  
  // Initialize particles in dense swarm configuration
  useEffect(() => {
    if (!particlesRef.current) return;
    
    const count = 400; // Dense particle swarm
    const positions = new Float32Array(count * 3);
    const originalPositions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Particles swarm around accelerator ring
      const angle = Math.random() * Math.PI * 2;
      const radius = 2.5 + Math.random() * 1.5;
      const height = (Math.random() - 0.5) * 2;
      
      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = height;
      positions[i3 + 2] = Math.sin(angle) * radius;
      
      originalPositions[i3] = positions[i3];
      originalPositions[i3 + 1] = positions[i3 + 1];
      originalPositions[i3 + 2] = positions[i3 + 2];
    }
    
    particlesPositionsRef.current = positions;
    originalPositionsRef.current = originalPositions;
    
    const geometry = particlesRef.current.geometry;
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  }, []);
  
  useFrame((state) => {
    if (!groupRef.current || !acceleratorRef.current || !particlesRef.current || !materialRef.current || !acceleratorMaterialRef.current) return;
    
    const time = state.clock.elapsedTime;
    
    // Rotate accelerator ring (torus) fast
    acceleratorRef.current.rotation.x = time * 1.5;
    acceleratorRef.current.rotation.y = time * 0.8;
    acceleratorRef.current.rotation.z = time * 0.5;
    
    // Pulse accelerator with energy
    const pulse = 1 + Math.sin(time * 4) * 0.1;
    acceleratorRef.current.scale.setScalar(pulse * opacity);
    
    // Intense emissive glow
    acceleratorMaterialRef.current.emissiveIntensity = (0.8 + Math.sin(time * 3) * 0.3) * opacity;
    acceleratorMaterialRef.current.opacity = opacity;
    
    // Animate particles swirling around accelerator
    if (particlesRef.current.geometry && particlesPositionsRef.current && originalPositionsRef.current) {
      const posAttribute = particlesRef.current.geometry.attributes.position;
      if (posAttribute) {
        const posArray = posAttribute.array as Float32Array;
        for (let i = 0; i < posArray.length; i += 3) {
          const i3 = i / 3;
          const originalX = originalPositionsRef.current[i];
          const originalY = originalPositionsRef.current[i + 1];
          const originalZ = originalPositionsRef.current[i + 2];
          
          // Swirl particles around accelerator ring
          const angle = Math.atan2(originalZ, originalX) + time * 2 + i3 * 0.01;
          const radius = Math.sqrt(originalX * originalX + originalZ * originalZ);
          const swirl = Math.sin(time * 1.5 + i3 * 0.05) * 0.2;
          
          posArray[i] = Math.cos(angle) * radius;
          posArray[i + 1] = originalY + swirl;
          posArray[i + 2] = Math.sin(angle) * radius;
        }
        posAttribute.needsUpdate = true;
      }
    }
    
    materialRef.current.opacity = 0.7 * opacity;
  });
  
  if (opacity < 0.01) return null;
  
  return (
    <group ref={groupRef}>
      {/* Particle Accelerator - transformed torus */}
      <mesh ref={acceleratorRef}>
        <torusGeometry args={[2.5, 0.6, 16, 100]} />
        <meshStandardMaterial
          ref={acceleratorMaterialRef}
          color="#a0a0a0"
          emissive="#c0c0c0"
          emissiveIntensity={0.8}
          wireframe={true}
          transparent
          opacity={0}
        />
      </mesh>
      
      {/* Swarming particles */}
      <Points ref={particlesRef}>
        <PointMaterial
          ref={materialRef}
          transparent
          color="#c0c0c0"
          size={0.1}
          sizeAttenuation={true}
          depthWrite={false}
          opacity={0}
        />
      </Points>
    </group>
  );
}

// Planet Scene - Transforms spheres into planets, particles into starfield, torus becomes orbital rings
function PlanetScene({ progress }: { progress: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const sunRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const particlesMaterialRef = useRef<THREE.PointsMaterial>(null);
  const orbitalRingRef = useRef<THREE.Mesh>(null);
  const orbitalMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  // Fade in/out based on progress (0.66-1.0)
  const sceneProgress = Math.max(0, Math.min(1, (progress - 0.66) / 0.34));
  const fadeIn = THREE.MathUtils.smoothstep(sceneProgress, 0, 0.2);
  const fadeOut = THREE.MathUtils.smoothstep(sceneProgress, 0.8, 1);
  const opacity = fadeIn * (1 - fadeOut);
  
  // Initialize particles as starfield
  useEffect(() => {
    if (!particlesRef.current) return;
    
    const count = 500; // Dense starfield
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Distribute stars in deep space
      const radius = 10 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      
      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);
    }
    
    const geometry = particlesRef.current.geometry;
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  }, []);
  
  useFrame((state) => {
    if (!groupRef.current || !sunRef.current || !particlesRef.current || !particlesMaterialRef.current) return;
    
    const time = state.clock.elapsedTime;
    
    // Rotate starfield slowly
    if (particlesRef.current) {
      particlesRef.current.rotation.y = time * 0.03;
    }
    
    // Pulse sun
    const pulse = 1 + Math.sin(time * 1.2) * 0.1;
    sunRef.current.scale.setScalar(pulse * opacity);
    
    // Animate orbital ring (torus) slowly rotating
    if (orbitalRingRef.current && orbitalMaterialRef.current) {
      orbitalRingRef.current.rotation.y = time * 0.2;
      orbitalRingRef.current.rotation.x = Math.sin(time * 0.1) * 0.1;
      orbitalMaterialRef.current.opacity = 0.3 * opacity;
    }
    
    particlesMaterialRef.current.opacity = 0.9 * opacity;
  });
  
  if (opacity < 0.01) return null;
  
  // Planet data: [radius, orbitRadius, speed] - using codalyn colors
  const planets = [
    [0.2, 3.0, 0.25],
    [0.25, 4.5, 0.18],
    [0.22, 6.0, 0.12],
    [0.3, 7.5, 0.08],
  ];
  
  return (
    <group ref={groupRef}>
      {/* Starfield background - transformed particles */}
      <Points ref={particlesRef}>
        <PointMaterial
          ref={particlesMaterialRef}
          transparent
          color="#c0c0c0"
          size={0.03}
          sizeAttenuation={true}
          depthWrite={false}
          opacity={0}
        />
      </Points>
      
      {/* Orbital ring - transformed torus */}
      <mesh ref={orbitalRingRef} position={[0, 0, 0]}>
        <torusGeometry args={[5, 0.1, 8, 100]} />
        <meshStandardMaterial
          ref={orbitalMaterialRef}
          color="#a0a0a0"
          emissive="#c0c0c0"
          emissiveIntensity={0.3}
          wireframe={false}
          transparent
          opacity={0}
        />
      </mesh>
      
      {/* Sun - center sphere */}
      <mesh ref={sunRef} position={[0, 0, 0]}>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshStandardMaterial
          color="#a0a0a0"
          emissive="#c0c0c0"
          emissiveIntensity={1.0 * opacity}
          transparent
          opacity={opacity}
        />
      </mesh>
      
      {/* Planets - transformed orbiting spheres */}
      {planets.map((planet, i) => {
        const [radius, orbitRadius, speed] = planet;
        return (
          <EasterEggPlanet
            key={i}
            radius={radius}
            orbitRadius={orbitRadius}
            speed={speed}
            opacity={opacity}
          />
        );
      })}
    </group>
  );
}

function EasterEggPlanet({
  radius,
  orbitRadius,
  speed,
  opacity,
}: {
  radius: number;
  orbitRadius: number;
  speed: number;
  opacity: number;
}) {
  const planetRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const orbitAngleRef = useRef(Math.random() * Math.PI * 2);
  
  useFrame((state, delta) => {
    if (!planetRef.current || !materialRef.current) return;
    
    orbitAngleRef.current += speed * delta;
    
    // Orbital motion
    planetRef.current.position.x = Math.cos(orbitAngleRef.current) * orbitRadius;
    planetRef.current.position.z = Math.sin(orbitAngleRef.current) * orbitRadius;
    planetRef.current.position.y = Math.sin(orbitAngleRef.current * 0.5) * 0.3;
    
    // Rotate planet
    planetRef.current.rotation.y += delta * 1.5;
    
    // Subtle pulsing glow
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 2 + orbitAngleRef.current) * 0.05;
    materialRef.current.emissiveIntensity = (0.5 + Math.sin(state.clock.elapsedTime * 1.5) * 0.2) * opacity;
    materialRef.current.opacity = opacity;
  });
  
  return (
    <mesh ref={planetRef}>
      <sphereGeometry args={[radius, 24, 24]} />
      <meshStandardMaterial
        ref={materialRef}
        color="#b4b4b4"
        emissive="#c0c0c0"
        emissiveIntensity={0.5}
        transparent
        opacity={0}
      />
    </mesh>
  );
}

function OrbitingSpheres({ mouse, introProgress }: { mouse: { x: number; y: number }; introProgress: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const orbitAngleRef = useRef(0);
  const orbitSpeedRef = useRef(0);
  
  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    const time = state.clock.elapsedTime;
    
    // Intro animation - scale in and start orbiting with cool effect
    const introScale = THREE.MathUtils.smoothstep(introProgress, 0, 1);
    const pulse = Math.sin(time * 0.6) * 0.05;
    groupRef.current.scale.setScalar(introScale * (1 + pulse));
    
    // Calculate orbital speed - faster as intro progresses, influenced by mouse
    const baseSpeed = introProgress * 0.3;
    const mouseInfluence = Math.sqrt(mouse.x * mouse.x + mouse.y * mouse.y) * 0.1;
    const speedVariation = Math.sin(time * 0.3) * 0.05;
    orbitSpeedRef.current = baseSpeed + mouseInfluence + speedVariation;
    
    // Update orbital angle
    orbitAngleRef.current += orbitSpeedRef.current * delta;
    
    // Subtle group rotation for more dynamic movement (like atom nucleus rotation)
    groupRef.current.rotation.x = time * 0.05 + mouse.y * 0.1;
    groupRef.current.rotation.y = time * 0.08 + mouse.x * 0.1;
    groupRef.current.rotation.z = Math.sin(time * 0.15) * 0.05;
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: 6 }).map((_, i) => (
        <OrbitingSphere
          key={i}
          index={i}
          total={6}
          mouse={mouse}
          introProgress={introProgress}
          orbitAngleRef={orbitAngleRef}
          orbitSpeedRef={orbitSpeedRef}
        />
      ))}
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
  const easterEggDuration = 10000; // 10 seconds total

  useEffect(() => {
    // Intro animation - animate from 0 to 1 over 2 seconds
    const startTime = Date.now();
    const duration = 2000; // 2 seconds
    
    const animateIntro = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
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
      // Throttle state updates for better performance
      setMouse({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Handle easter egg trigger
  const handleSpinDetected = () => {
    if (!isEasterEggActive) {
      setIsEasterEggActive(true);
      easterEggStartTimeRef.current = Date.now();
      setEasterEggProgress(0);
      onEasterEggChange?.({ isActive: true });
    }
  };

  // Animate easter egg progress
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
        // Easter egg complete
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
        
        {!isEasterEggActive ? (
          <>
            <FloatingParticles mouse={mouse} introProgress={introProgress} />
            <AnimatedMesh mouse={mouse} introProgress={introProgress} onSpinDetected={handleSpinDetected} />
            <OrbitingSpheres mouse={mouse} introProgress={introProgress} />
          </>
        ) : (
          <>
            <EasterEggCamera progress={easterEggProgress} />
            <Stars radius={100} depth={50} count={1000} factor={4} saturation={0.5} fade speed={0.5} />
            <AtomScene progress={easterEggProgress} />
            <NeutronScene progress={easterEggProgress} />
            <PlanetScene progress={easterEggProgress} />
          </>
        )}
      </Canvas>
    </div>
  );
}

