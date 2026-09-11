import { useNavigate } from 'react-router-dom';
import { Button } from '../design/elements';

export default function NotFound() {
  const nav = useNavigate();
  return (
    <main className="page">
      <div className="empty">
        <p>That page doesn&rsquo;t exist.</p>
        <Button variant="dark" type="button" onClick={() => nav('/')}>Back to home</Button>
      </div>
    </main>
  );
}
