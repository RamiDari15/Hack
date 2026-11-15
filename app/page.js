import Scene from '@/components/home/Scene';
import Labels from '@/components/home/Labels';
import Close from '@/components/home/Close';

// Three parts only: the bulb scene (hero and how it works), the four labels, and the event types.
// Everything else lives on its own page.
export default function HomePage() {
  return (
    <>
      <Scene />
      <Labels />
      <Close />
    </>
  );
}
