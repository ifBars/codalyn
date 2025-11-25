"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Text3D, Center } from "@react-three/drei";
import { useRef, useState, Suspense, Component, type ReactNode } from "react";
import * as THREE from "three";
import type { MeshPhysicalMaterial } from "three";

interface SpinningCLogoProps {
    font: string;
    size?: number;
    isHovered: boolean;
}

function SpinningCLogo({ font, size = 2.5, isHovered }: SpinningCLogoProps) {
    const groupRef = useRef<THREE.Group>(null);
    const materialRef = useRef<MeshPhysicalMaterial>(null);
    const shimmerLightRef = useRef<THREE.DirectionalLight>(null);
    const orbitLightRef = useRef<THREE.DirectionalLight>(null);
    const shimmerProgress = useRef(0);
    const orbitProgress = useRef(0);

    useFrame((state, delta) => {
        if (!groupRef.current || !materialRef.current) return;

        const time = state.clock.getElapsedTime();

        // Continuous rotation on Y axis
        groupRef.current.rotation.y += delta * 0.5;

        // Subtle pulsing glow effect
        const glowIntensity = 0.25 + Math.sin(time * 2) * 0.15;
        materialRef.current.emissiveIntensity = glowIntensity;

        // Subtle bobbing motion for depth (reduced to prevent clipping)
        groupRef.current.position.y = Math.sin(time * 0.8) * 0.05;

        // Hover effects: enhanced metallic shine
        if (isHovered) {
            // Increase metalness and emissive for extra shine
            materialRef.current.metalness = Math.min(1, 0.9 + Math.sin(time * 3) * 0.1);
            materialRef.current.emissiveIntensity = 0.4 + Math.sin(time * 4) * 0.2;

            // Animate shimmer sweep across the logo
            shimmerProgress.current += delta * 1.2;
            if (shimmerProgress.current > Math.PI * 2) {
                shimmerProgress.current = 0;
            }

            // Move shimmer light in a sweeping motion
            if (shimmerLightRef.current) {
                const sweepX = Math.sin(shimmerProgress.current) * 6;
                const sweepY = Math.cos(shimmerProgress.current * 0.5) * 3;
                shimmerLightRef.current.position.set(sweepX, sweepY, 5);
                shimmerLightRef.current.intensity = 3 + Math.sin(shimmerProgress.current * 2) * 1.5;
            }

            // Animate orbiting point light
            orbitProgress.current += delta * 2; // Faster orbit
            if (orbitLightRef.current) {
                const orbitRadius = 3;
                const orbitX = Math.cos(orbitProgress.current) * orbitRadius;
                const orbitZ = Math.sin(orbitProgress.current) * orbitRadius;
                const orbitY = Math.sin(orbitProgress.current * 2) * 1.5; // Figure-8 pattern
                orbitLightRef.current.position.set(orbitX, orbitY, orbitZ);
                orbitLightRef.current.intensity = THREE.MathUtils.lerp(
                    orbitLightRef.current.intensity,
                    4,
                    delta * 5
                );
            }
        } else {
            // Reset to normal values when not hovered
            materialRef.current.metalness = THREE.MathUtils.lerp(
                materialRef.current.metalness,
                0.9,
                delta * 5
            );
            if (shimmerLightRef.current) {
                shimmerLightRef.current.intensity = THREE.MathUtils.lerp(
                    shimmerLightRef.current.intensity,
                    0,
                    delta * 3
                );
            }
            if (orbitLightRef.current) {
                orbitLightRef.current.intensity = THREE.MathUtils.lerp(
                    orbitLightRef.current.intensity,
                    0,
                    delta * 5
                );
            }
        }
    });

    // Metallic silver-gray color matching the logo
    const silverColor = "#b0b0b0"; // Medium silver-gray

    return (
        <group ref={groupRef}>
            {/* Shimmer light for glimmer effect */}
            <directionalLight
                ref={shimmerLightRef}
                color="#ffffff"
                intensity={0}
                castShadow={false}
            />
            {/* Orbiting point light */}
            <directionalLight
                ref={orbitLightRef}
                color="#ffffff"
                intensity={1}
            />
            <Center>
                <Text3D
                    font={font}
                    size={size}
                    height={size * 0.16}
                    curveSegments={24}
                    bevelEnabled
                    bevelThickness={size * 0.02}
                    bevelSize={size * 0.008}
                    bevelOffset={0}
                    bevelSegments={12}
                >
                    C
                    <meshPhysicalMaterial
                        ref={materialRef}
                        color={silverColor}
                        metalness={0.9}
                        roughness={0.1}
                        emissive={silverColor}
                        emissiveIntensity={0.25}
                        clearcoat={1}
                        clearcoatRoughness={0.05}
                    />
                </Text3D>
            </Center>
        </group>
    );
}

interface SceneProps {
    textSize?: number;
    isHovered: boolean;
}

function Scene({ textSize = 2.5, isHovered }: SceneProps) {
    const fontUrl = "/fonts/helvetiker_bold.typeface.json";

    return (
        <group>
            <SpinningCLogo font={fontUrl} size={textSize} isHovered={isHovered} />
        </group>
    );
}

// Error boundary for font loading errors
class FontErrorBoundary extends Component<
    { children: ReactNode },
    { hasError: boolean }
> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: Error) {
        console.error("Font loading error:", error);
    }

    render() {
        if (this.state.hasError) {
            return (
                <group>
                    <Center>
                        <mesh>
                            <boxGeometry args={[2, 2, 0.1]} />
                            <meshBasicMaterial color="#666" transparent opacity={0.3} />
                        </mesh>
                    </Center>
                </group>
            );
        }

        return this.props.children;
    }
}

interface SpinningLogoProps {
    className?: string;
    size?: number;
    showBackground?: boolean;
}

export function SpinningLogo({ className = "", size, showBackground = false }: SpinningLogoProps) {
    const [isHovered, setIsHovered] = useState(false);

    // Calculate text size based on className or use default
    // Default sizes: h-24 w-24 = 96px -> size ~1.8, h-14 w-14 = 56px -> size ~1.0, h-12 w-12 = 48px -> size ~0.9, etc.
    let textSize = size;
    if (!textSize) {
        // Try to infer from className
        if (className.includes("h-24") || className.includes("w-24")) {
            textSize = 1.8;
        } else if (className.includes("h-14") || className.includes("w-14")) {
            textSize = 1.0;
        } else if (className.includes("h-12") || className.includes("w-12")) {
            textSize = 0.9;
        } else if (className.includes("h-11") || className.includes("w-11")) {
            textSize = 0.85;
        } else if (className.includes("h-8") || className.includes("w-8")) {
            textSize = 0.6;
        } else if (className.includes("h-48") || className.includes("w-48")) {
            textSize = 3.5;
        } else {
            textSize = 2.5; // Default
        }
    }

    // Adjust camera based on text size to prevent clipping
    const cameraDistance = Math.max(5, textSize * 2.2);
    const cameraFov = textSize < 1.5 ? 55 : 50;

    const containerStyle = showBackground
        ? {
            background: "radial-gradient(circle at center, #e0e0e0 0%, #a0a0a0 100%)",
        }
        : {};

    return (
        <div
            className={`relative ${className}`}
            style={containerStyle}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <Canvas
                camera={{ position: [0, 0, cameraDistance], fov: cameraFov }}
                gl={{ antialias: true, alpha: true }}
                style={{ width: '100%', height: '100%', display: 'block' }}
            >
                {/* Enhanced lighting for metallic materials with silver glow */}
                <ambientLight intensity={0.5} color="#ffffff" />
                <directionalLight position={[5, 5, 5]} intensity={1.2} color="#ffffff" />
                <directionalLight position={[-5, 5, -5]} intensity={0.8} color="#c0c0c0" />

                <Suspense fallback={null}>
                    <FontErrorBoundary>
                        <Scene textSize={textSize} isHovered={isHovered} />
                    </FontErrorBoundary>
                </Suspense>
            </Canvas>
        </div>
    );
}
