'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
const links=[['/map','Problem Map'],['/projects','Explore'],['/opportunities','Connect'],['/trials','Try'],['/results','Results'],['/about','About'],['/account','Account']] as const;
export function SiteNav(){const path=usePathname();return <nav className="shell site-nav" aria-label="Main navigation"><Link className="brand" href="/">trycove<span>●</span></Link><div className="site-links">{links.map(([href,label])=><Link href={href} key={href} aria-current={path===href||path.startsWith(href+'/')?'page':undefined}>{label}</Link>)}</div></nav>}
