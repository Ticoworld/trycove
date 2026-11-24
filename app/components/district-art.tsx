export const places:Record<string,{x:number;y:number;color:string;kind:number}>={'payments-checkout':{x:110,y:260,color:'#f8cb61',kind:0},'trading-markets':{x:390,y:135,color:'#fb907d',kind:1},'accounts-identity':{x:680,y:210,color:'#b7a8ef',kind:2},'developer-tools':{x:890,y:380,color:'#81d4e4',kind:3},'chain-data-indexing':{x:660,y:475,color:'#f8cb61',kind:4},'funding-community':{x:365,y:435,color:'#f4b39e',kind:5},'contract-safety':{x:115,y:510,color:'#a6d4c5',kind:6},'digital-assets':{x:930,y:120,color:'#d5bce9',kind:7},'cross-chain':{x:550,y:640,color:'#9bcfd5',kind:8}};


export function Landmark({kind}:{kind:number}){switch(kind){

 case 0:return <g><path d="M-100 35H100v20h-200zM-70 55v35m140-35v35M-76 35V5h85v30" fill="#d89c62"/><path d="M-60 5v-40h55V5z" fill="#f8cb61"/><rect x="-50" y="-27" width="35" height="20" rx="2" fill="#fff8e8"/><path d="M-39-17h13M-52 4h39M20 35V-4q0-28 28-28t28 28v39M35-3h26M49-16v26"/><circle cx="48" cy="-4" r="22" fill="#81d4e4"/><path d="M-90 69h180"/></g>;

 case 1:return <g><path d="M-90 48h180v16H-90zM-82 48v-58h112v58" fill="#fb907d"/><path d="M-91-10l18-42h95l17 42z" fill="#fb907d"/><path d="M-60-52v42m34-42v42M-72-7h92v55h-92z" fill="#fff8e8"/><path d="M-65 30h78M-55 30V12h14v18m10 0V5h14v25m10 0V16H7v14M50 50V-2h35v52M44-2h48l-8-26H52z" fill="#f8cb61"/><circle cx="67" cy="18" r="8" fill="#f8cb61"/></g>;

 case 2:return <g><path d="M-80 62V-8q0-65 80-65T80-8v70H43V0q0-37-43-37T-43 0v62z" fill="#b7a8ef"/><path d="M-95 62h190M-60 62v-70q0-50 60-50t60 50v70M-6-57h12v20H-6z"/></g>;

 case 3:return <g><path d="M-90 52h180v15H-90zM-75 52v-70l52-37h85l18 37v70" fill="#81d4e4"/><path d="M-75-18h155M-35-55v37M-52 12h59v40h-59zM-43 22h40M35 52V10h30v42" fill="#fff8e8"/><path d="M-86-35l22 15m-17-25 22 15M40-35h24M48-43v16"/><path d="M-19 10v-15h25v15M-40 20v21m-7-15 7-7 7 7m12-6v21m-5-21h10"/></g>;

 case 4:return <g><path d="M-78 57h156M-52 57V5q0-47 52-47T52 5v52z" fill="#f8cb61"/><path d="M-52 5h104M-22 57V22h44v35M0-42v-27M-30-54l60-22M-7-80l17 14"/><circle cx="30" cy="-76" r="10" fill="#fb907d"/><path d="M-65 57v16h130V57"/></g>;

 case 5:return <g><path d="M-95 40L0 10l95 30-95 30z" fill="#f5b2a4"/><path d="M-72 41L0 19l72 22-72 21z" fill="#fff8e8"/><path d="M-43 27v-36h86v36M-50-9L0-49 50-9z" fill="#f8cb61"/><path d="M-19 27V3h38v24M-74 41l-14 12m162-12 14 12"/><circle cy="-23" r="7" fill="#fb907d"/></g>;

 case 6:return <g><path d="M-87 57h174M-70 57v-71h140v71M-80-14l24-34h112l24 34" fill="#a6d4c5"/><path d="M-39 57V4h78v53M-50-48v34m100-34v34"/></g>;

 case 7:return <g><path d="M-88 56h176M-75 56v-68h150v68M-85-12l20-35h130l20 35" fill="#d5bce9"/><path d="M-53-12v68M53-12v68M-36 12h72v37h-72z" fill="#fff8e8"/><path d="M-54-31h108"/></g>;

 default:return <g><path d="M-105 42h210v15h-210z" fill="#d89c62"/><path d="M-90 42q0-75 90-75t90 75M-70 42v-43m140 43V-1M-35 42v-64m70 64v-64M-105 22h210"/><path d="M-102 73q15-9 30 0t30 0m84 0q15-9 30 0t30 0" stroke="#5aaabb"/></g>;

}}

export function Mechanism({kind}:{kind:number}) {
 const shapes = [
  <g key="receipt"><path d="M-48 5h31v32l-5-4-5 4-5-4-5 4-5-4-6 4z" fill="#fffaf0"/><path d="M-43 13h21m-21 7h18m-18 7h15"/></g>,
  <g key="awning"><path d="M-72-7h92v55h-92z" fill="#e57e6d"/><path d="M-69 4h86m-86 10h86m-86 10h86m-86 10h86"/></g>,
  <g key="lock"><path d="M-39 60V2q0-34 39-34t39 34v58z" fill="#b7a8ef"/><path d="M0-32v92"/><path d="M48 8v-8q0-12 10-12t10 12" fill="none"/><rect x="48" y="8" width="20" height="25" fill="#f8cb61"/><circle cx="58" cy="18" r="3" fill="#29263b"/></g>,
  <g key="tools"><path d="M-52 12h59v40h-59z" fill="#d89c62"/><path d="M-48 22h51m-51 10h51m-51 10h51"/></g>,
  <g key="signal" fill="none"><path d="M43-89q13 13 0 26M52-98q23 22 0 44" stroke="#b14d48"/></g>,
  <g key="proposal"><path d="M-18-34h36v42h-36z" fill="#fffaf0"/><path d="M-11-24h22m-22 8h22m-22 8h15"/></g>,
  <g key="shield"><path d="M0-2l25 9v16q0 17-25 29-25-12-25-29V7z" fill="#fff8e8"/><path d="M-9 21l7 7 13-15"/></g>,
  <g key="art"><path d="M-36 12h72v37h-72z" fill="#fff8e8"/></g>,
  <g key="bridge"><path d="M0 42h105v15H0z" fill="#d89c62"/><path d="M0 22h105M35 22v20m35-20v20"/></g>,
 ];
 return <g className="place-mechanism">{shapes[kind]}</g>;
}
