import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '../design/components/Chrome';
import { Button } from '../design/elements';
import { detectAR, type ARSupport } from '../lib/three/arSession';
import { createTiltSteer, initialTiltState, type TiltState } from '../lib/tiltSteer';
import { probeDualCamera, startBlinkProbe, type BlinkSample, type DualCamResult } from '../lib/faceProbe';

/* ============================================================
   On-device diagnostics.

   AR and tilt cannot be verified from a laptop: WebXR needs a phone, the
   camera path needs a real camera, and tilt needs a real gyroscope. Rather
   than guess, this page reports exactly what the device supports and what the
   sensors are actually producing, so a screenshot from the phone answers the
   question precisely.

   Not linked from anywhere in the app — reachable only at /diag.
   ============================================================ */

type Row = { label: string; value: string; ok: boolean | null };

function Status({ rows, title }: { title: string; rows: Row[] }) {
  return (
    <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <h2
        style={{
          fontSize: 'var(--f-sm)',
          fontWeight: 800,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--mut)',
          padding: '10px 12px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        {title}
      </h2>
      {rows.map((r) => (
        <div
          key={r.label}
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: '9px 12px',
            borderTop: '1px solid var(--line)',
            fontSize: 'var(--f-sm)',
          }}
        >
          <span style={{ color: 'var(--mut)' }}>{r.label}</span>
          <b
            style={{
              fontWeight: 700,
              textAlign: 'right',
              color: r.ok === null ? 'var(--ink)' : r.ok ? 'var(--green)' : 'var(--hw-r)',
            }}
          >
            {r.value}
          </b>
        </div>
      ))}
    </section>
  );
}

export default function Diag() {
  const [ar, setAr] = useState<ARSupport | null>(null);
  const [tiltState, setTiltState] = useState<TiltState>(() => initialTiltState());
  const [live, setLive] = useState<{ steer: number; samples: number }>({ steer: 0, samples: 0 });
  const [raw, setRaw] = useState<{ beta: number | null; gamma: number | null } | null>(null);
  const [cam, setCam] = useState<string>('not requested');
  const [dual, setDual] = useState<DualCamResult | null>(null);
  const [dualBusy, setDualBusy] = useState(false);
  const [blink, setBlink] = useState<BlinkSample | null>(null);
  const [blinkErr, setBlinkErr] = useState<string | null>(null);
  const [blinkBusy, setBlinkBusy] = useState(false);
  /* A ref does not re-render, and the button label and status both depend on
     whether the probe is running — so the flag is state and the teardown
     function is the ref. */
  const [blinkOn, setBlinkOn] = useState(false);
  const stopBlink = useRef<(() => void) | null>(null);
  const tilt = useRef<ReturnType<typeof createTiltSteer> | null>(null);
  const count = useRef(0);

  useEffect(() => {
    detectAR().then(setAr);
  }, []);

  useEffect(() => {
    const onOrient = (e: DeviceOrientationEvent) => setRaw({ beta: e.beta, gamma: e.gamma });
    window.addEventListener('deviceorientation', onOrient);
    return () => window.removeEventListener('deviceorientation', onOrient);
  }, []);

  const startTilt = async () => {
    const t = createTiltSteer({
      onSteer: (v) => {
        count.current += 1;
        setLive({ steer: v, samples: count.current });
      },
      onStateChange: setTiltState,
    });
    tilt.current = t;
    const s = await t.enable();
    if (s === 'active') t.start();
  };

  const testCamera = async () => {
    setCam('requesting…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      const track = stream.getVideoTracks()[0];
      const s = track.getSettings();
      setCam(`ok · ${s.width}×${s.height} ${s.facingMode ?? ''}`);
      stream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      setCam(e instanceof Error ? `failed · ${e.name}` : 'failed');
    }
  };

  // never leave a camera running behind the page
  useEffect(() => () => stopBlink.current?.(), []);

  const runDual = async () => {
    setDualBusy(true);
    setDual(null);
    setDual(await probeDualCamera());
    setDualBusy(false);
  };

  const runBlink = async () => {
    if (stopBlink.current) {
      stopBlink.current();
      stopBlink.current = null;
      setBlinkOn(false);
      setBlink(null);
      return;
    }
    setBlinkBusy(true);
    setBlinkErr(null);
    try {
      stopBlink.current = await startBlinkProbe(setBlink);
      setBlinkOn(true);
    } catch (e) {
      setBlinkErr(e instanceof Error ? e.message : 'failed to load');
    }
    setBlinkBusy(false);
  };

  const angle = (typeof screen !== 'undefined' && screen.orientation?.angle) ?? 0;

  return (
    <>
      <PageHeader title="Device diagnostics" subtitle="Not linked from the app, /diag only" />
      <main className="page" style={{ background: 'var(--appbase)' }}>
        <div className="shell" style={{ display: 'grid', gap: 10, paddingTop: 12, paddingBottom: 24 }}>
          <Status
            title="Environment"
            rows={[
              { label: 'Secure context (HTTPS)', value: String(window.isSecureContext), ok: window.isSecureContext },
              { label: 'Origin', value: window.location.origin.replace(/^https?:\/\//, ''), ok: null },
              { label: 'Screen orientation', value: `${angle}°`, ok: null },
              { label: 'Viewport', value: `${window.innerWidth}×${window.innerHeight}`, ok: null },
              { label: 'Touch points', value: String(navigator.maxTouchPoints ?? 0), ok: (navigator.maxTouchPoints ?? 0) > 0 },
            ]}
          />

          <Status
            title="AR support"
            rows={[
              { label: 'detectAR()', value: ar ? ar.kind : 'checking…', ok: ar ? ar.kind === 'webxr' || ar.kind === 'camera' : null },
              { label: 'Reason', value: ar && 'reason' in ar ? String(ar.reason ?? '-') : '-', ok: null },
              { label: 'WebXR object', value: String('xr' in navigator), ok: 'xr' in navigator },
              { label: 'getUserMedia', value: String(!!navigator.mediaDevices?.getUserMedia), ok: !!navigator.mediaDevices?.getUserMedia },
              { label: 'Camera test', value: cam, ok: cam.startsWith('ok') ? true : cam.startsWith('failed') ? false : null },
            ]}
          />

          <Button variant="outline" block onClick={testCamera}>
            Test camera
          </Button>

          <Status
            title="Blink It: can both cameras run at once?"
            rows={[
              {
                label: 'Rear + front together',
                value: dual ? (dual.ok ? 'YES' : 'NO') : dualBusy ? 'testing…' : 'not run',
                ok: dual ? dual.ok : null,
              },
              { label: 'Front camera opened', value: dual ? String(dual.frontOpened) : '-', ok: dual ? dual.frontOpened : null },
              { label: 'Rear kept running for', value: dual ? `${dual.rearFramesAfter}s` : '-', ok: null },
              { label: 'Detail', value: dual ? dual.detail : '-', ok: null },
            ]}
          />

          <Button variant="outline" block onClick={runDual} disabled={dualBusy}>
            {dualBusy ? 'Testing both cameras…' : 'Test dual camera'}
          </Button>

          <Status
            title="Blink It: face tracking"
            rows={[
              { label: 'Landmarker', value: blinkErr ? 'failed' : blinkOn ? 'running' : blinkBusy ? 'loading…' : 'not run', ok: blinkErr ? false : blinkOn ? true : null },
              { label: 'Face detected', value: blink ? String(blink.faceSeen) : '-', ok: blink ? blink.faceSeen : null },
              { label: 'Frame rate', value: blink ? `${blink.fps} fps` : '-', ok: blink ? blink.fps >= 15 : null },
              { label: 'Eyes closed (live)', value: blink ? blink.blink.toFixed(2) : '-', ok: null },
              { label: 'Blinks counted', value: blink ? String(blink.blinks) : '-', ok: blink ? blink.blinks > 0 : null },
              ...(blinkErr ? [{ label: 'Error', value: blinkErr, ok: false }] : []),
            ]}
          />

          <Button variant="flame" block onClick={runBlink} disabled={blinkBusy}>
            {blinkBusy ? 'Loading face model…' : blinkOn ? 'Stop blink test' : 'Test blink detection'}
          </Button>

          <Status
            title="Tilt steering"
            rows={[
              { label: 'State', value: tiltState, ok: tiltState === 'active' ? true : tiltState === 'needs-permission' ? null : false },
              { label: 'Raw gamma', value: raw?.gamma == null ? 'no events' : raw.gamma.toFixed(1) + '°', ok: raw?.gamma != null },
              { label: 'Raw beta', value: raw?.beta == null ? 'no events' : raw.beta.toFixed(1) + '°', ok: raw?.beta != null },
              { label: 'Steer output', value: live.steer.toFixed(3), ok: null },
              { label: 'Samples received', value: String(live.samples), ok: live.samples > 0 },
            ]}
          />

          <Button variant="flame" block onClick={startTilt}>
            Enable &amp; test tilt
          </Button>

          <p className="t-xs" style={{ lineHeight: 1.6 }}>
            Run <b>Test dual camera</b> first. That one answers whether the blink
            can live inside the AR race or has to replace it. Then <b>Test blink
            detection</b> and blink a few times deliberately; &ldquo;Blinks counted&rdquo;
            should climb and the frame rate should stay above 15. Screenshot the
            page either way.
          </p>
          <p className="t-xs" style={{ lineHeight: 1.6 }}>
            Tap both tilt buttons, tilt the phone left and right, then screenshot this
            page. &ldquo;Samples received&rdquo; climbing and &ldquo;Steer output&rdquo; swinging between
            &minus;1 and 1 means tilt steering is working on this device.
          </p>
        </div>
      </main>
    </>
  );
}
