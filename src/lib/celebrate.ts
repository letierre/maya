// Efeito visual de "conquista" ao concluir uma atividade.
// Dispara uma suave explosão de partículas coloridas a partir de um ponto
// (ou do centro da tela, se nenhuma coordenada for passada).
// Partículas menores, mais lentas e levemente escalonadas — para dar prazer
// visual sem assustar.

const COLORS = ["#7C5CFF", "#5EEAD4", "#F59E0B", "#FF9F43", "#A78BFA", "#FFFFFF"];

export function celebrate(x?: number, y?: number) {
  if (typeof window === "undefined") return;
  const px = x ?? window.innerWidth / 2;
  const py = y ?? window.innerHeight / 2.2;
  const count = 12;

  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const dist = 30 + Math.random() * 34;
    const size = 3 + Math.random() * 4;

    p.style.position = "fixed";
    p.style.left = `${px}px`;
    p.style.top = `${py}px`;
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.borderRadius = "50%";
    p.style.background = COLORS[i % COLORS.length];
    p.style.pointerEvents = "none";
    p.style.zIndex = "9999";
    p.style.transform = "translate(-50%, -50%)";
    p.style.opacity = "0.95";
    p.style.transition = "transform 0.8s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.8s ease";
    p.style.transitionDelay = `${(i % 4) * 0.05}s`;

    document.body.appendChild(p);
    requestAnimationFrame(() => {
      p.style.transform = `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(0)`;
      p.style.opacity = "0";
    });
    setTimeout(() => p.remove(), 1050);
  }
}
