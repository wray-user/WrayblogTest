import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Suspense } from 'react'
import Light from './Light';
import Earth from './Earth';
import * as THREE from 'three';

type EarthSceneProps = {
    controlElement: HTMLElement | null;
};

const EarthScene = ({ controlElement }: EarthSceneProps) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const fov = 75;
    const aspect = w / h;
    const near = 0.1;
    const far = 1000;

    return (
        <>
            <PerspectiveCamera makeDefault position={[0, 0, 5]} {...{ fov, aspect, near, far }} />
            <Light />
            <OrbitControls 
                makeDefault
                domElement={controlElement ?? undefined}
                enabled={Boolean(controlElement)}
                enableDamping={false}
                enableZoom 
                rotateSpeed={1.5}
                zoomSpeed={1.2} 
                enablePan={false}
                mouseButtons={{
                    LEFT: THREE.MOUSE.ROTATE,
                    MIDDLE: THREE.MOUSE.DOLLY,
                    RIGHT: THREE.MOUSE.ROTATE,
                }}
                maxDistance={100}
                minDistance={2}
                target={new THREE.Vector3(0,0,0)}
            />            
            
            <Suspense fallback={null}>
                <Earth />
            </Suspense>
        </>
    )
}

export default EarthScene
