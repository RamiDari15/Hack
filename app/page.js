import Hero from '@/components/home/Hero';
import Marquee from '@/components/home/Marquee';
import Steps from '@/components/home/Steps';
import Bento from '@/components/home/Bento';
import Labels from '@/components/home/Labels';
import Close from '@/components/home/Close';
import Terminal from '@/components/home/Terminal';
import Intro from '@/components/home/Intro';

export default function HomePage() {
  return (
    <>
      <Intro />
      <Hero />
      <Marquee />
      <Steps />
      <Terminal />
      <Bento />
      <Labels />
      <Close />
    </>
  );
}
