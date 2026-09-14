import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ARIntro } from '../design/components/ARIntro';

/* ============================================================
   The AR onboarding, without the AR.

   Checking one line of copy or one beat's timing otherwise costs opening the
   camera, and on a desktop it costs not being able to look at it at all. This
   mounts the same component on its own, and remounts it on a press so the
   three beats can be watched again without a reload.

   Deliberately unlinked, like /diag and /preview/result.
   ============================================================ */

export default function IntroPreview() {
  const nav = useNavigate();
  const [run, setRun] = useState(0);

  return (
    <div className="iprevhost">
      <ARIntro key={run} onDone={() => setRun((r) => r + 1)} />

      {/* Not part of the screen being previewed: the thing that makes
          previewing it useful. */}
      <div className="iprev">
        <button type="button" className="iprev__b" onClick={() => setRun((r) => r + 1)}>
          replay
        </button>
        <button type="button" className="iprev__b" onClick={() => nav('/')}>
          close
        </button>
      </div>
    </div>
  );
}
