import { useNavigate } from 'react-router-dom';
import { Button } from '../design/elements';
import { IconFlag } from '../design/elements/Icons';

/**
 * A wrong turn, said in the campaign's own voice.
 *
 * The old one was a bare sentence and a dark button on an otherwise empty page —
 * correct, and the only screen in the build with no design on it at all. A 404
 * is still a screen someone lands on, and on a campaign it is a chance to point
 * them back at the thing the campaign is for rather than just at home.
 */
export default function NotFound() {
  const nav = useNavigate();
  return (
    <main className="page nf">
      <span className="nf__flag" aria-hidden="true">
        <IconFlag size={30} />
      </span>
      <h1 className="nf__t">Wrong turn</h1>
      <p className="nf__s">
        That page isn&rsquo;t part of the drop. The cars are still where you left them.
      </p>
      <div className="nf__go">
        <Button variant="primary" type="button" onClick={() => nav('/hot-wheels')}>
          Shop the drop
        </Button>
        <Button variant="outline" type="button" onClick={() => nav('/')}>
          Back to home
        </Button>
      </div>
    </main>
  );
}
