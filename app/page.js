import Hero from '@/components/home/Hero';
import Marquee from '@/components/home/Marquee';
import Steps from '@/components/home/Steps';
import Bento from '@/components/home/Bento';
import Labels from '@/components/home/Labels';
import Close from '@/components/home/Close';

export default function HomePage() {
  return (
    <>
      <Hero />
      <Marquee />
      <Steps />
      <Bento />
      <Labels />
      <Close />
    </>
  );
}
