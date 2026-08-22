import { Canvas } from '@react-three/fiber';
import { useState } from 'react';
import * as THREE from 'three';
import EarthScene from './EarthScene';
import styles from'./ThreeEarth.module.css';

export default function ThreeEarth() {
  const [controlElement, setControlElement] = useState(null);

  return (
    <div className={styles.threeEarthBox}>
      <Canvas
        className={styles.threeEarthCanvas}
        eventSource={document.getElementById('root')}
        eventPrefix="client"
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
        }}
        gl={{
          toneMapping: THREE.ACESFilmicToneMapping,
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
      >
        <EarthScene controlElement={controlElement} />
      </Canvas>
      <div ref={setControlElement} className={styles.earthControlArea} />
    </div>
  );
}
