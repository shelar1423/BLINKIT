/**
 * The wait between "Place track here" and the track appearing.
 *
 * Thin white line work straight over the camera, no card: the circuit draws
 * itself in perspective on a pulsing patch of floor while a car laps it, so a
 * slow build reads as something being laid down rather than a frozen screen.
 * Placing a single car (View mode) draws an outlined box instead.
 *
 * Pure SVG and CSS: it runs while the device is busiest building the scene.
 */

/* The circuit as seen lying on the floor: the far straight is shorter than the
   near one, so it reads as flat ground rather than a badge. */
const CIRCUIT =
  'M30 36 H66 C80 36 89 44 89 54 C89 66 79 74 63 74 H33 C17 74 7 66 7 54 C7 44 16 36 30 36 Z';
const LANE =
  'M33 45 H63 C73 45 79 49 79 55 C79 61.5 72 65 62 65 H34 C24 65 17 61.5 17 55 C17 49 23 45 33 45 Z';

export function PlaceLoader({ car = false }: { car?: boolean }) {
  return (
    <div className="placeload" role="status" aria-live="polite">
      <svg className="placeload__art" viewBox="0 0 96 96" aria-hidden="true">
        {/* the patch of floor it is landing on */}
        <ellipse className="placeload__floor" cx="48" cy="56" rx="46" ry="22" />
        {car ? (
          <g className="placeload__box" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
            <path className="placeload__edge e1" pathLength={100} d="M48 20 L70 31 L48 42 L26 31 Z" />
            <path className="placeload__edge e2" pathLength={100} d="M26 31 V55 L48 66 V42" />
            <path className="placeload__edge e3" pathLength={100} d="M70 31 V55 L48 66" />
          </g>
        ) : (
          <g fill="none" stroke="#fff" strokeLinejoin="round" strokeLinecap="round">
            <path d={CIRCUIT} strokeWidth="1.6" opacity="0.18" />
            <path className="placeload__lay" d={CIRCUIT} pathLength={100} strokeWidth="1.8" />
            <path className="placeload__lay placeload__lay--in" d={LANE} pathLength={100} strokeWidth="1" />
            {/* the start line */}
            <path className="placeload__start" d="M46 31.5 V40.5 M50 31.5 V40.5" strokeWidth="1.4" />
            {/* a car lapping the circuit once it is down */}
            <circle className="placeload__car" r="2.6" fill="#fff" stroke="none">
              <animateMotion dur="1.8s" repeatCount="indefinite" path={CIRCUIT} rotate="auto" />
            </circle>
          </g>
        )}
      </svg>
      <p>
        {car ? 'Placing your car…' : 'Building your track…'}
        <small>{car ? 'Bringing it into your room' : 'Laying the circuit on your floor'}</small>
      </p>
    </div>
  );
}

/**
 * The two things the camera cannot fix by itself: a room too dark to see the
 * floor in, and no connection to load the track over. Same line work as the
 * placing loader, so every AR state reads as one family.
 */
export function ARNotice({ kind }: { kind: 'dark' | 'offline' }) {
  const dark = kind === 'dark';
  return (
    <div className="placeload placeload--notice" role="status" aria-live="polite">
      <svg className="placeload__art" viewBox="0 0 96 96" aria-hidden="true">
        <g fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {dark ? (
            <>
              <path className="placeload__edge e1" pathLength={100} d="M48 22 C36 22 28 31 28 42 C28 50 33 55 37 60 C39 62 40 65 40 68 H56 C56 65 57 62 59 60 C63 55 68 50 68 42 C68 31 60 22 48 22 Z" />
              <path className="placeload__edge e2" pathLength={100} d="M41 75 H55 M43 81 H53" />
              <g className="placeload__rays" strokeWidth="1.4">
                <path d="M48 10 V15 M25 19 L28.5 22.5 M71 19 L67.5 22.5 M16 42 H21 M80 42 H75" />
              </g>
            </>
          ) : (
            <>
              <path className="placeload__edge e1" pathLength={100} d="M22 46 C38 32 58 32 74 46" />
              <path className="placeload__edge e2" pathLength={100} d="M31 55 C41 47 55 47 65 55" />
              <path className="placeload__edge e3" pathLength={100} d="M40 64 C45 60 51 60 56 64" />
              <circle cx="48" cy="72" r="2.4" fill="#fff" stroke="none" />
              <path className="placeload__slash" pathLength={100} d="M26 24 L70 78" strokeWidth="2" />
            </>
          )}
        </g>
      </svg>
      <p>
        {dark ? 'It’s too dark in here' : 'You’re offline'}
        <small>
          {dark
            ? 'Turn on a light or move somewhere brighter.'
            : 'Reconnect to load your track.'}
        </small>
      </p>
    </div>
  );
}
