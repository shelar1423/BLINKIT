import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const nav = useNavigate();
  return (
    <main className="page">
      <div className="empty">
        <p>That page doesn&rsquo;t exist.</p>
        <button className="btn btn--dark" type="button" onClick={() => nav('/')}>Back to home</button>
      </div>
    </main>
  );
}
