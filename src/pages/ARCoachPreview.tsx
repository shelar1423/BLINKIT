import { useNavigate } from 'react-router-dom';
import { RaceCoach } from '../design/components/RaceCoach';

/* The AR briefing needs a placed camera track to appear. This unlinked preview
   shows the same card over the supplied room and circuit art on desktops. */
export default function ARCoachPreview() {
  const nav = useNavigate();

  return (
    <div className="coachprev">
      <img className="coachprev__room" src="/howto/surface.webp" alt="" />
      <img className="coachprev__track" src="/howto/circuit.webp" alt="" />
      <RaceCoach mode="ar" onDone={() => nav('/preview/intro')} />
    </div>
  );
}
