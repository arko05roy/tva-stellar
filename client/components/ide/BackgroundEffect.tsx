"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function ParticleField() {
    const pointsRef = useRef<THREE.Points>(null);
    const particleCount = 100;

    const [positions, velocities] = useMemo(() => {
        const pos = new Float32Array(particleCount * 3);
        const vel = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            // Spread particles across the view
            pos[i * 3] = (Math.random() - 0.5) * 20;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 10;

            // Slow velocities for gentle movement
            vel[i * 3] = (Math.random() - 0.5) * 0.002;
            vel[i * 3 + 1] = (Math.random() - 0.5) * 0.002;
            vel[i * 3 + 2] = (Math.random() - 0.5) * 0.001;
        }

        return [pos, vel];
    }, []);

    useFrame(() => {
        if (!pointsRef.current) return;

        const positionArray = pointsRef.current.geometry.attributes.position.array as Float32Array;

        for (let i = 0; i < particleCount; i++) {
            positionArray[i * 3] += velocities[i * 3];
            positionArray[i * 3 + 1] += velocities[i * 3 + 1];
            positionArray[i * 3 + 2] += velocities[i * 3 + 2];

            // Wrap around edges
            if (positionArray[i * 3] > 10) positionArray[i * 3] = -10;
            if (positionArray[i * 3] < -10) positionArray[i * 3] = 10;
            if (positionArray[i * 3 + 1] > 10) positionArray[i * 3 + 1] = -10;
            if (positionArray[i * 3 + 1] < -10) positionArray[i * 3 + 1] = 10;
        }

        pointsRef.current.geometry.attributes.position.needsUpdate = true;
    });

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={particleCount}
                    array={positions}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                color="#FFC800"
                size={0.03}
                transparent
                opacity={0.4}
                sizeAttenuation
            />
        </points>
    );
}

function GridLines() {
    const gridRef = useRef<THREE.LineSegments>(null);

    useFrame(({ clock }) => {
        if (gridRef.current) {
            gridRef.current.rotation.x = Math.sin(clock.elapsedTime * 0.05) * 0.02;
            gridRef.current.rotation.y = Math.cos(clock.elapsedTime * 0.03) * 0.02;
        }
    });

    const geometry = useMemo(() => {
        const geo = new THREE.BufferGeometry();
        const positions: number[] = [];
        const gridSize = 20;
        const divisions = 20;
        const step = gridSize / divisions;

        // Create grid lines
        for (let i = 0; i <= divisions; i++) {
            const pos = -gridSize / 2 + i * step;
            // Horizontal lines
            positions.push(-gridSize / 2, pos, 0);
            positions.push(gridSize / 2, pos, 0);
            // Vertical lines
            positions.push(pos, -gridSize / 2, 0);
            positions.push(pos, gridSize / 2, 0);
        }

        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        return geo;
    }, []);

    return (
        <lineSegments ref={gridRef} position={[0, 0, -5]} geometry={geometry}>
            <lineBasicMaterial color="#FFC800" transparent opacity={0.03} />
        </lineSegments>
    );
}

function GlowingOrb() {
    const orbRef = useRef<THREE.Mesh>(null);

    useFrame(({ clock }) => {
        if (orbRef.current) {
            orbRef.current.position.x = Math.sin(clock.elapsedTime * 0.2) * 2;
            orbRef.current.position.y = Math.cos(clock.elapsedTime * 0.15) * 2;
            const scale = 1 + Math.sin(clock.elapsedTime * 0.5) * 0.1;
            orbRef.current.scale.setScalar(scale);
        }
    });

    return (
        <mesh ref={orbRef} position={[3, 2, -3]}>
            <sphereGeometry args={[0.5, 32, 32]} />
            <meshBasicMaterial color="#FFC800" transparent opacity={0.05} />
        </mesh>
    );
}

export default function BackgroundEffect() {
    return (
        <div className="absolute inset-0 pointer-events-none opacity-60">
            <Canvas
                camera={{ position: [0, 0, 10], fov: 60 }}
                gl={{ antialias: true, alpha: true }}
                style={{ background: 'transparent' }}
            >
                <ParticleField />
                <GridLines />
                <GlowingOrb />
            </Canvas>
        </div>
    );
}
