import "./athlete-plan.css";

interface AthleteStubPanelProps {
  title: string;
  message: string;
  onBack: () => void;
}

export function AthleteStubPanel({ title, message, onBack }: AthleteStubPanelProps) {
  return (
    <div className="athlete-overlay-screen">
      <header className="athlete-overlay-screen__header">
        <button type="button" className="athlete-overlay-screen__back" onClick={onBack}>
          ← Назад
        </button>
        <h1 className="athlete-overlay-screen__title">{title}</h1>
      </header>
      <section className="athlete-stub glass glass--panel">
        <p className="athlete-stub__message text-secondary">{message}</p>
      </section>
    </div>
  );
}
