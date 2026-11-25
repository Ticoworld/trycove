import './loading.css';
export function LoadingScene({label='Opening Trycove'}: {label?: string}) {
 return <section className="loading-scene" role="status" aria-live="polite"><svg viewBox="0 0 180 130" aria-hidden="true"><path d="M19 99C42 70 60 112 90 70s48-20 70-35" fill="none" stroke="#29263b" strokeWidth="3" strokeDasharray="5 7"/><path d="M42 34h76v59H42z" fill="#fffaf0" stroke="#29263b" strokeWidth="3"/><path d="M42 34l15-16h46l15 16" fill="#f8cb61" stroke="#29263b" strokeWidth="3" strokeLinejoin="round"/><path d="M60 93V53h40v40M70 65h20" fill="none" stroke="#29263b" strokeWidth="3"/><circle cx="145" cy="43" r="11" fill="#fb907d" stroke="#29263b" strokeWidth="3"/></svg><div><strong>{label}</strong><p>Getting things ready for you.</p></div></section>;
}
