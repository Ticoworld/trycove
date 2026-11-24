import Link from 'next/link';
import '../final-ui.css';

const chapters = [
  {href:'/projects', title:'Discover', text:'Find useful CKB products.', number:'01', color:'#F8CB61'},
  {href:'/opportunities', title:'Connect', text:'Explore documented needs and possible collaborations.', number:'02', color:'#FB907D'},
  {href:'/trials', title:'Try', text:'Explore applications through guided tasks.', number:'03', color:'#81D4E4'},
  {href:'/results', title:'Follow through', text:'See shared feedback and recorded outcomes.', number:'04', color:'#A6D4C5'},
] as const;

function AtlasScene(){return <svg className="about-scene" viewBox="0 0 440 250" aria-hidden="true">
  <path d="M32 190C90 166 101 115 158 132S233 194 286 145s70-46 122-52" fill="none" stroke="#29263b" strokeWidth="3" strokeDasharray="5 9" strokeLinecap="round"/>
  <g transform="translate(33 50) rotate(-8 60 60)"><path d="M8 25L103 9l20 115-95 17z" fill="#fffaf0" stroke="#29263b" strokeWidth="3"/><path d="M25 48l62-11M28 61l48-9M31 75l59-11" stroke="#29263b" strokeWidth="3" strokeLinecap="round"/><circle cx="91" cy="105" r="17" fill="#fb907d" stroke="#29263b" strokeWidth="3"/></g>
  <g transform="translate(147 18) rotate(7 70 70)"><path d="M8 27h122v116H8z" fill="#81d4e4" stroke="#29263b" strokeWidth="3"/><path d="M8 27h122v24H8z" fill="#fffaf0" stroke="#29263b" strokeWidth="3"/><circle cx="24" cy="39" r="3" fill="#29263b"/><circle cx="35" cy="39" r="3" fill="#29263b"/><path d="M35 109l19-19 17 13 31-32" fill="none" stroke="#29263b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><circle cx="102" cy="71" r="6" fill="#f8cb61" stroke="#29263b" strokeWidth="3"/></g>
  <g transform="translate(298 89) rotate(-5 52 52)"><path d="M8 23h90v70H8z" fill="#fffaf0" stroke="#29263b" strokeWidth="3"/><path d="M8 23l45 33 45-33" fill="#a6d4c5" stroke="#29263b" strokeWidth="3" strokeLinejoin="round"/><path d="M25 80l18-14M81 80L63 66" fill="none" stroke="#29263b" strokeWidth="3"/></g>
  <path d="M132 31l5-13M143 35l11-8M274 18l4-13M286 25l11-7" stroke="#29263b" strokeWidth="3" strokeLinecap="round"/>
 </svg>}
export default function Page(){return <div className="final-page about-page"><section className="about-intro"><div className="about-intro-copy"><h1>Good things happen when builders connect.</h1><p>Trycove helps people find CKB products, explore opportunities to collaborate and learn from real testing.</p></div><AtlasScene/></section><div className="about-steps">{chapters.map(chapter=><Link href={chapter.href} key={chapter.href} style={{'--chapter-color':chapter.color} as React.CSSProperties}><span className="about-step-number">{chapter.number}</span><strong>{chapter.title}</strong><span>{chapter.text}</span></Link>)}</div></div>}
