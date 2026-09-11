/**
 * WebXR Spatial Capability Detector for Race It Home: Room Rally
 *
 * Honest capability detection:
 * - full_spatial: mesh-detection + hit-test (and optionally depth-sensing)
 * - depth_approx: depth-sensing + hit-test without mesh-detection
 * - plane_only: plane-detection + hit-test
 * - camera_mode: iOS Safari / camera fallback with device gyro orientation
 * - unsupported: no camera and no WebXR
 */

export type SpatialCapabilityMode =
  | 'full_spatial'
  | 'depth_approx'
  | 'plane_only'
  | 'camera_mode'
  | 'unsupported';

export type SpatialSupportReport = {
  mode: SpatialCapabilityMode;
  canWebXR: boolean;
  hasMeshDetection: boolean;
  hasDepthSensing: boolean;
  hasPlaneDetection: boolean;
  hasHitTest: boolean;
  title: string;
  badge: string;
  description: string;
  actionText: string;
  needsFallbackTo3D: boolean;
};

function hasCamera() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

export async function detectSpatialCapabilities(): Promise<SpatialSupportReport> {
  if (typeof window === 'undefined' || !window.isSecureContext) {
    return {
      mode: 'unsupported',
      canWebXR: false,
      hasMeshDetection: false,
      hasDepthSensing: false,
      hasPlaneDetection: false,
      hasHitTest: false,
      title: 'Browser Not Supported',
      badge: '3D Mode',
      description: 'AR requires a secure context (HTTPS) on a supported device.',
      actionText: 'Play in 3D',
      needsFallbackTo3D: true,
    };
  }

  const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
  if (!xr || typeof xr.isSessionSupported !== 'function') {
    if (hasCamera()) {
      return {
        mode: 'camera_mode',
        canWebXR: false,
        hasMeshDetection: false,
        hasDepthSensing: false,
        hasPlaneDetection: false,
        hasHitTest: false,
        title: 'Camera AR Mode (iOS)',
        badge: 'Camera AR',
        description: 'Opens live camera on your iPhone to place and race Hot Wheels on your desk or floor.',
        actionText: 'Start Camera AR',
        needsFallbackTo3D: false,
      };
    }
    return {
      mode: 'unsupported',
      canWebXR: false,
      hasMeshDetection: false,
      hasDepthSensing: false,
      hasPlaneDetection: false,
      hasHitTest: false,
      title: 'Scene-Aware AR Unavailable',
      badge: '3D Mode',
      description:
        'Standard iOS Safari and unsupported browsers do not expose WebXR scene understanding. Play the high-speed 3D browser race instead.',
      actionText: 'Play in 3D',
      needsFallbackTo3D: true,
    };
  }

  try {
    const isArSupported = await xr.isSessionSupported('immersive-ar');
    if (!isArSupported) {
      if (hasCamera()) {
        return {
          mode: 'camera_mode',
          canWebXR: false,
          hasMeshDetection: false,
          hasDepthSensing: false,
          hasPlaneDetection: false,
          hasHitTest: false,
          title: 'Camera AR Mode (iOS)',
          badge: 'Camera AR',
          description: 'Opens live camera on your iPhone to place and race Hot Wheels in your space.',
          actionText: 'Start Camera AR',
          needsFallbackTo3D: false,
        };
      }
      return {
        mode: 'unsupported',
        canWebXR: false,
        hasMeshDetection: false,
        hasDepthSensing: false,
        hasPlaneDetection: false,
        hasHitTest: false,
        title: 'Immersive AR Unavailable',
        badge: '3D Mode',
        description: 'Immersive AR is not supported by this browser. Play in 3D instead.',
        actionText: 'Play in 3D',
        needsFallbackTo3D: true,
      };
    }
  } catch {
    if (hasCamera()) {
      return {
        mode: 'camera_mode',
        canWebXR: false,
        hasMeshDetection: false,
        hasDepthSensing: false,
        hasPlaneDetection: false,
        hasHitTest: false,
        title: 'Camera AR Mode (iOS)',
        badge: 'Camera AR',
        description: 'Opens live camera on your iPhone to place and race Hot Wheels in your space.',
        actionText: 'Start Camera AR',
        needsFallbackTo3D: false,
      };
    }
    return {
      mode: 'unsupported',
      canWebXR: false,
      hasMeshDetection: false,
      hasDepthSensing: false,
      hasPlaneDetection: false,
      hasHitTest: false,
      title: 'AR Not Available',
      badge: '3D Mode',
      description: 'Unable to initialize WebXR. Enjoy the full 3D browser race.',
      actionText: 'Play in 3D',
      needsFallbackTo3D: true,
    };
  }

  // Check feature interfaces where available
  const hasMeshDetection = typeof (window as unknown as { XRMesh?: unknown }).XRMesh !== 'undefined';
  const hasPlaneDetection = typeof (window as unknown as { XRPlane?: unknown }).XRPlane !== 'undefined';
  const hasDepthSensing = typeof (window as unknown as { XRCPUDepthInformation?: unknown }).XRCPUDepthInformation !== 'undefined';

  if (hasMeshDetection) {
    return {
      mode: 'full_spatial',
      canWebXR: true,
      hasMeshDetection: true,
      hasDepthSensing,
      hasPlaneDetection,
      hasHitTest: true,
      title: 'Full Room Rally',
      badge: 'Full Spatial AR',
      description:
        'Your room becomes the track! Real bottles, laptops, walls, and furniture physically block the car.',
      actionText: 'Scan Room & Race',
      needsFallbackTo3D: false,
    };
  }

  if (hasDepthSensing) {
    return {
      mode: 'depth_approx',
      canWebXR: true,
      hasMeshDetection: false,
      hasDepthSensing: true,
      hasPlaneDetection,
      hasHitTest: true,
      title: 'Depth Scene AR',
      badge: 'Depth Mode',
      description:
        'Real-world depth sensing detected. Nearby physical obstacles will slow or deflect your car.',
      actionText: 'Start Depth AR',
      needsFallbackTo3D: false,
    };
  }

  return {
    mode: 'plane_only',
    canWebXR: true,
    hasMeshDetection: false,
    hasDepthSensing: false,
    hasPlaneDetection,
    hasHitTest: true,
    title: 'Surface AR Mode',
    badge: 'Surface AR',
    description:
      'Surface detection active. The car drives on your table or floor within detected bounds; complex 3D obstacles are limited.',
    actionText: 'Start Surface AR',
    needsFallbackTo3D: false,
  };
}
