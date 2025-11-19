"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Text3D, Center } from "@react-three/drei";
import { useEffect, useRef, useState, Suspense, Component, type ReactNode } from "react";
import * as THREE from "three";
import type { Mesh, MeshPhysicalMaterial } from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";

const words = [
    // Creation / Production vibes
    { text: "build", color: "#a0a0a0" }, // Darker Silver
    { text: "make", color: "#9c9c9c" }, // Dark Metallic Silver
    { text: "forge", color: "#a8a8a8" }, // Medium-Dark Silver
    { text: "craft", color: "#c8c8c8" }, // Lighter Silver
    { text: "form", color: "#acacac" }, // Medium Silver
    { text: "draft", color: "#bcbcbc" }, // Mid Silver
    
    // Start / Initiate vibes
    { text: "start", color: "#b4b4b4" }, // Mid Silver
    { text: "begin", color: "#a6a6a6" }, // Medium-Dark Silver
    { text: "spark", color: "#c0c0c0" }, // Lighter Silver
    
    // Change / Modify vibes
    { text: "edit", color: "#aaaaaa" }, // Medium Silver
    { text: "tune", color: "#a2a2a2" }, // Medium-Dark Silver
    
    // Tech / Dev flavored
    { text: "code", color: "#989898" }, // Darker Metallic Silver
    { text: "ship", color: "#d0d0d0" }, // Brightish Silver
    { text: "push", color: "#9c9c9c" }, // Dark Metallic Silver
    
    // Abstract but energetic
    { text: "lift", color: "#a8a8a8" }, // Medium-Dark Silver
    { text: "fuse", color: "#b8b8b8" }, // Mid-Light Silver
    { text: "link", color: "#9a9a9a" }, // Darker Metallic Silver
    
    // Scale / Growth
    { text: "scale", color: "#989898" }, // Darker Metallic Silver
];

interface RotatingWordProps {
    word: { text: string; color: string };
    index: number;
    currentIndex: number;
    font: string;
}

function RotatingWord({ word, index, currentIndex, font }: RotatingWordProps) {
    const groupRef = useRef<THREE.Group>(null);
    const materialRef = useRef<MeshPhysicalMaterial>(null);

    const isCurrent = index === currentIndex;
    const isPrev = index === (currentIndex - 1 + words.length) % words.length;

    useFrame((state, delta) => {
        if (!groupRef.current || !materialRef.current) return;

        const speed = 4;
        const time = state.clock.getElapsedTime();

        if (isCurrent) {
            // Rotate from -90 (bottom) to 0 (center)
            groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0, delta * speed);
            materialRef.current.opacity = THREE.MathUtils.lerp(materialRef.current.opacity, 1, delta * speed);
            groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, 0, delta * speed);

            // Animate glow intensity with pulsing effect
            const glowIntensity = 0.3 + Math.sin(time * 2.5) * 0.2;
            materialRef.current.emissiveIntensity = glowIntensity;

            // Subtle rotation for depth
            groupRef.current.rotation.z = Math.sin(time * 0.5) * 0.05;
        } else if (isPrev) {
            // Rotate from 0 (center) to 90 (top)
            groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, Math.PI / 2, delta * speed);
            materialRef.current.opacity = THREE.MathUtils.lerp(materialRef.current.opacity, 0, delta * speed);
            groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, 1.5, delta * speed);
            materialRef.current.emissiveIntensity = THREE.MathUtils.lerp(materialRef.current.emissiveIntensity, 0, delta * speed);
            groupRef.current.rotation.z = 0;
        } else {
            // Reset others to start position (bottom)
            groupRef.current.rotation.x = -Math.PI / 2;
            materialRef.current.opacity = 0;
            groupRef.current.position.y = -1.5;
            materialRef.current.emissiveIntensity = 0;
            groupRef.current.rotation.z = 0;
        }
    });

    // Only render current and previous to reduce initialization
    const shouldRender = isCurrent || isPrev;

    if (!shouldRender) {
        return null;
    }

    return (
        <group ref={groupRef}>
            <Center>
                <Text3D
                    font={font}
                    size={1.7}
                    height={0.35}
                    curveSegments={16}
                    bevelEnabled
                    bevelThickness={0.03}
                    bevelSize={0.015}
                    bevelOffset={0}
                    bevelSegments={8}
                >
                    {word.text}
                    <meshPhysicalMaterial
                        ref={materialRef}
                        color={word.color}
                        metalness={0.8}
                        roughness={0.15}
                        emissive={word.color}
                        emissiveIntensity={0.3}
                        clearcoat={1}
                        clearcoatRoughness={0.1}
                        transparent
                        opacity={isCurrent ? 1 : 0}
                    />
                </Text3D>
            </Center>
        </group>
    );
}

function Scene() {
    const [index, setIndex] = useState(0);
    const fontUrl = "/fonts/helvetiker_bold.typeface.json";

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % words.length);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    // Only render current and previous to minimize initialization
    const currentIndex = index;
    const prevIndex = (currentIndex - 1 + words.length) % words.length;
    const wordsToRender = [
        { word: words[prevIndex], index: prevIndex },
        { word: words[currentIndex], index: currentIndex },
    ];

    return (
        <group>
            {wordsToRender.map(({ word, index: i }) => (
                <RotatingWord
                    key={`${word.text}-${i}`}
                    word={word}
                    index={i}
                    currentIndex={currentIndex}
                    font={fontUrl}
                />
            ))}
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
                            <boxGeometry args={[3, 0.5, 0.1]} />
                            <meshBasicMaterial color="#666" transparent opacity={0.3} />
                        </mesh>
                    </Center>
                </group>
            );
        }

        return this.props.children;
    }
}

export function RotatingText() {
    return (
        <div className="h-[125px] w-[190px] relative">
            <Canvas
                camera={{ position: [0, 0, 5], fov: 45 }}
            // Removed explicit gl prop to use defaults and avoid potential undefined constant issues
            >
                {/* Enhanced lighting for metallic materials with silver glow */}
                <ambientLight intensity={0.4} color="#ffffff" />
                <directionalLight position={[5, 5, 5]} intensity={1.0} color="#ffffff" />
                <directionalLight position={[-5, 5, -5]} intensity={1.0} color="#c0c0c0" />
                <pointLight position={[-1, 0, -1]} intensity={2.0} color="#c0c0c0" />

                <Suspense fallback={null}>
                    <FontErrorBoundary>
                        <Scene />
                    </FontErrorBoundary>
                </Suspense>
            </Canvas>
        </div>
    );
}
