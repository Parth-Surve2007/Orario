import { useContext } from 'react';
import { AppContext } from '../App';

export default function ParticleBackground() {
  const { theme } = useContext(AppContext);
  const isDark = theme === 'dark';
  const dotColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)';
  const svgEncoded = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="1" cy="1" r="1.2" fill="${dotColor}"/></svg>`
  );
  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ backgroundImage: `url("data:image/svg+xml,${svgEncoded}")`, backgroundSize: '28px 28px', zIndex: 1 }}
    />
  );
}
