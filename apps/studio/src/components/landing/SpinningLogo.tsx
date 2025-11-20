"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Text3D, Center } from "@react-three/drei";
import { useRef, Suspense, Component, type ReactNode } from "react";
import * as THREE from "three";
import type { MeshPhysicalMaterial } from "three";

interface SpinningCLogoProps {
    font: string;
    size?: number;
}

function SpinningCLogo({ font, size = 2.5 }: SpinningCLogoProps) {
    const groupRef = useRef<THREE.Group>(null);
    const materialRef = useRef<MeshPhysicalMaterial>(null);

    useFrame((state, delta) => {
        if (!groupRef.current || !materialRef.current) return;

        const time = state.clock.getElapsedTime();

        // Continuous rotation on Y axis
        groupRef.current.rotation.y += delta * 0.5;

        // Subtle pulsing glow effect
        const glowIntensity = 0.25 + Math.sin(time * 2) * 0.15;
        materialRef.current.emissiveIntensity = glowIntensity;

        // Subtle bobbing motion for depth
        groupRef.current.position.y = Math.sin(time * 0.8) * 0.1;
    });

    // Metallic silver-gray color matching the logo
    const silverColor = "#b0b0b0"; // Medium silver-gray

    return (
        <group ref={groupRef}>
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
}

function Scene({ textSize = 2.5 }: SceneProps) {
    const fontUrl = "/fonts/helvetiker_bold.typeface.json";

    return (
        <group>
            <SpinningCLogo font={fontUrl} size={textSize} />
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
    // Calculate text size based on className or use default
    // Default sizes: h-24 w-24 = 96px -> size ~1.8, h-12 w-12 = 48px -> size ~0.9, etc.
    let textSize = size;
    if (!textSize) {
        // Try to infer from className
        if (className.includes("h-24") || className.includes("w-24")) {
            textSize = 1.8;
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

    const containerStyle = showBackground
        ? {
              background: "radial-gradient(circle at center, #e0e0e0 0%, #a0a0a0 100%)",
          }
        : {};

    return (
        <div className={`relative ${className}`} style={containerStyle}>
            <Canvas
                camera={{ position: [0, 0, 5], fov: 45 }}
            >
                {/* Enhanced lighting for metallic materials with silver glow */}
                <ambientLight intensity={0.5} color="#ffffff" />
                <directionalLight position={[5, 5, 5]} intensity={1.2} color="#ffffff" />
                <directionalLight position={[-5, 5, -5]} intensity={0.8} color="#c0c0c0" />
                <pointLight position={[0, 0, 3]} intensity={1.5} color="#ffffff" />
                <pointLight position={[-2, -2, -2]} intensity={0.6} color="#a0a0a0" />

                <Suspense fallback={null}>
                    <FontErrorBoundary>
                        <Scene textSize={textSize} />
                    </FontErrorBoundary>
                </Suspense>
            </Canvas>
        </div>
    );
}

