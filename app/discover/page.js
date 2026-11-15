import {redirect} from 'next/navigation';
export const metadata={title:'Ideas'};
export default async function DiscoverPage({searchParams}){const sp=await searchParams;const q=typeof sp?.q==='string'?`?q=${encodeURIComponent(sp.q.slice(0,300))}`:'';redirect(`/ideas${q}`);}
