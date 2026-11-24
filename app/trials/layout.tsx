import {Fraunces,Geist} from 'next/font/google';
import './trials-ui.css';
const display=Fraunces({subsets:['latin'],style:['normal','italic'],variable:'--trial-display',display:'swap'});
const ui=Geist({subsets:['latin'],variable:'--trial-ui',display:'swap'});
export default function TrialsLayout({children}:{children:React.ReactNode}){return <div className={`trials-surface ${display.variable} ${ui.variable}`}>{children}</div>}
