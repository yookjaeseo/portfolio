const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Reveal elements.
const revealItems = document.querySelectorAll('.reveal');
if (reduceMotion) revealItems.forEach(el => el.classList.add('is-visible'));
else {
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => { if(entry.isIntersecting){ entry.target.classList.add('is-visible'); obs.unobserve(entry.target); } });
  }, {threshold:0.12});
  revealItems.forEach(el => observer.observe(el));
}

// Softer inertial scroll. The only deliberate pause is just before large color transitions.
let currentY = window.scrollY, targetY = currentY, raf = 0, pauseTimer = null, braking = false, lastDir = 1;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const panelPoints=()=>[...document.querySelectorAll('[data-panel]')].map(el=>Math.round(el.getBoundingClientRect().top+window.scrollY)).filter(p=>p>40);
function tick(){
  const d=targetY-currentY;
  currentY += d*(braking?0.13:0.20);
  if(Math.abs(d)<0.45) currentY=targetY;
  window.scrollTo(0,currentY);
  if(Math.abs(targetY-currentY)>0.45) raf=requestAnimationFrame(tick); else raf=0;
}
function start(){if(!raf)raf=requestAnimationFrame(tick)}
window.addEventListener('wheel',e=>{
  if(reduceMotion||e.ctrlKey||document.body.style.overflow==='hidden')return;
  e.preventDefault();
  const maxY=document.documentElement.scrollHeight-innerHeight;
  const raw=e.deltaMode===1?e.deltaY*18:e.deltaY;
  const dir=Math.sign(raw)||lastDir; lastDir=dir;
  const step=clamp(Math.abs(raw)*0.9,30,innerHeight*0.34)*dir;
  const proposed=clamp(targetY+step,0,maxY);
  const points=panelPoints();
  const boundary=dir>0?points.find(p=>p>currentY+30):points.filter(p=>p<currentY-30).pop();
  if(boundary!==undefined){
    const gap=dir>0?boundary-currentY:currentY-boundary;
    if(gap<140 && gap>12 && !braking){
      braking=true; targetY=dir>0?Math.max(currentY,boundary-42):Math.min(currentY,boundary+42); start();
      clearTimeout(pauseTimer); pauseTimer=setTimeout(()=>{braking=false;targetY=clamp(boundary+(dir>0?3:-3),0,maxY);start()},120);
      return;
    }
  }
  targetY=proposed;start();
},{passive:false});
window.addEventListener('scroll',()=>{if(!raf&&!braking){currentY=window.scrollY;targetY=currentY}},{passive:true});

// Heart-shaped black voxel field. On small screens every quantity is derived from
// the heart's own radius, so the field keeps the same visual density, particle
// weight and motion as the desktop view — just proportionally smaller.
const canvas=document.querySelector('.heart-particles');
const ctx=canvas.getContext('2d'); let particles=[],cw=0,ch=0,dpr=1,mob=false,k=1;
const REF_SCALE=238;      // heart radius on a typical 1440x900 desktop
const DENSITY=0.0913;     // particles per radius² — matches the desktop field
function insideHeart(x,y){const a=x*x+y*y-1;return a*a*a-x*x*y*y*y}
function resize(){dpr=Math.min(devicePixelRatio||1,2);cw=canvas.clientWidth;ch=canvas.clientHeight;canvas.width=cw*dpr;canvas.height=ch*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);mob=cw<=680;seed()}
function seed(){
  particles=[];
  const cx=cw*.5;
  let cy=ch*.545,scale=Math.min(ch*.265,cw*(cw<720?.335:.205));
  if(mob){
    // Fit the heart into the free band between the intro copy and the link dock,
    // so its tip never collides with the buttons on short screens.
    const hero=canvas.getBoundingClientRect();
    const copy=document.querySelector('.hero-copy'),dock=document.querySelector('.dock');
    const top=copy?copy.getBoundingClientRect().bottom-hero.top+16:ch*.3;
    const bottom=dock?dock.getBoundingClientRect().top-hero.top-16:ch-150;
    const band=Math.max(bottom-top,170);
    cy=top+band*.5;
    scale=Math.min(band/2.42,cw*.375);
  }
  k=mob?Math.min(scale/REF_SCALE,1):1;   // size / motion ratio vs the desktop field
  // The heart's lobes carry more ink than its tip, so the field's optical centre
  // sits about a quarter of a radius above cy (measured from the rendered canvas).
  // On mobile the name is pinned there instead of to the middle of the hero.
  const nameEl=document.querySelector('.hero-name');
  if(nameEl)nameEl.style.top=mob?`${Math.round(cy-scale*.25)}px`:'';
  const target=mob
    ?Math.round(clamp(scale*scale*DENSITY,900,4200))
    :Math.round(clamp(cw*ch/250,2400,5600));
  let tries=0;
  while(particles.length<target&&tries<target*16){
    tries++;
    const x=Math.random()*3-1.5,y=Math.random()*3-1.5;
    const f=insideHeart(x,y);
    if(f>0)continue;
    const depth=Math.min(1,Math.pow(-f,.30));              // 0 at the outline, 1 deep inside
    if(Math.random()>.56+.44*depth)continue;              // dissolve toward the edge
    const jx=(1-depth)*(Math.random()-.5)*.26,jy=(1-depth)*(Math.random()-.5)*.26;
    particles.push({x:cx+(x+jx)*scale,y:cy-(y+jy)*scale,
      size:(3.5+Math.random()*(3+7.5*depth))*k,phase:Math.random()*6.28,
      speed:.55+Math.random()*1.7,theta:Math.random()*6.28,
      burst:Math.random()<.14+.3*(1-depth)});
  }
  const amb=Math.round(clamp(cw*ch/5200,mob?40:180,420));
  for(let i=0;i<amb;i++)particles.push({x:Math.random()*cw,y:Math.random()*ch,
    size:(2.5+Math.random()*8)*k,phase:Math.random()*6.28,speed:.35+Math.random()*1.3,
    theta:Math.random()*6.28,burst:true});
}
function draw(ms){
  ctx.clearRect(0,0,cw,ch);
  ctx.fillStyle='#07090c';
  const t=ms*.001,minSize=mob?1:2;
  for(const p of particles){
    let x=p.x+Math.sin(t*p.speed*3+p.phase)*3.8*k,y=p.y+Math.cos(t*p.speed*2.5+p.phase)*3*k;
    if(p.burst){const q=(Math.sin(t*1.3+p.phase)+1)/2;x+=Math.cos(p.theta)*(5+24*q)*k;y+=Math.sin(p.theta)*(4+20*q)*k}
    const s=Math.max(minSize,p.size+Math.sin(t*2+p.phase)*1.2*k);
    ctx.fillRect(Math.round(x),Math.round(y),Math.round(s),Math.round(s));
  }
  if(!reduceMotion)requestAnimationFrame(draw);
}
let resizeTimer=0;
window.addEventListener('resize',()=>{
  // Mobile browsers fire resize whenever the address bar collapses. Ignore those
  // small height changes so the heart doesn't visibly re-scatter mid-scroll.
  const dw=Math.abs(canvas.clientWidth-cw),dh=Math.abs(canvas.clientHeight-ch);
  if(dw<2&&dh<130)return;
  clearTimeout(resizeTimer);resizeTimer=setTimeout(resize,150);
},{passive:true});
resize();draw(0);

// Project modal content.
const projects=[
 {kicker:'01 / Growth · Marketing',
  title:'Delivery Full-Funnel Growth',
  period:'2025.07 — 2026.05',
  role:'Growth Marketer',
  overview:'I ran a full-funnel marketing strategy for in-house food brands inside the major delivery ecosystems, optimizing the whole customer journey — from first brand exposure and click-through to conversion and long-term retention. Managing operational testing across 30+ pilot stores, I built data-driven experiments: A/B tests on thumbnail visuals, store badges, promotional tiers and digital menu structures to isolate the high-converting variables and push advertising efficiency.',
  images:['assets/career1.jpg'],
  alts:['Full-funnel marketing performance dashboard'],
  results:[['12%','Marketing cost savings'],['+25%','First-order rate'],['+10%','Reorder retention']]},

 {kicker:'02 / BTL · Partnership',
  title:'Donuimun Market',
  period:'2024',
  role:'Project Lead',
  overview:'I led the end-to-end planning and execution of Donuimun Market, a BTL flagship project built to grow a collaboration pool of craft creators — from the initial proposal and venue scouting through to on-site operation. A targeted viral campaign on X (Twitter) drew more than 50,000 visitors, a tenfold jump over average foot traffic, and the project secured a long-term pool of 60+ creative teams with a 100% re-participation rate.',
  images:['assets/career2-1.jpg','assets/career2-2.jpg','assets/career2-3.jpg','assets/career2-4.jpg'],
  alts:['Visitors browsing creator booths at Donuimun Market','Visitors in hanbok at the market','Performers in period costume on site','Donuimun Market entrance banner and booths'],
  results:[['50,000+','Total visitors (10× peak)'],['100%','Re-participation rate'],['60+','Creative teams in pool']]},

 {kicker:'03 / Public · Program',
  title:"Seniors' Second Acts",
  period:'2025',
  role:'Program Planner',
  overview:'A nationwide non-profit initiative supporting career transitions and social vitality for the middle-aged and senior population. I owned the full lifecycle of program planning and execution across 30 cultural spaces, keeping the content close to what beneficiaries actually needed. Running 776 sessions, I passed the initial participation goal by 14% and reached 8,828 individuals — large-scale public-interest delivery with high engagement and tight resource efficiency.',
  images:['assets/career3-1.jpg','assets/career3-2.jpg','assets/career3-3.jpg','assets/career3-4.jpg'],
  alts:['Participants in a senior culture program workshop','Participant collage and life-story worksheet','Program audience at a theatre session','Program banner at the Seoul West Senior Center'],
  results:[['114%','KPI achievement (8,828 / 7,750)'],['776','Sessions operated'],['30+','Cultural spaces']]}
];
const modal=document.getElementById('projectModal');
const modalTitle=document.getElementById('modalTitle'),modalPeriod=document.getElementById('modalPeriod'),modalRole=document.getElementById('modalRole'),modalOverview=document.getElementById('modalOverview'),modalKicker=document.getElementById('modalKicker'),modalPhoto=document.getElementById('modalPhoto'),modalResults=document.getElementById('modalResults'),modalStrip=document.getElementById('modalStrip');
let lastFocus=null;

function openProject(i){
  const p=projects[i];
  lastFocus=document.activeElement;
  modalKicker.textContent=p.kicker;
  modalTitle.textContent=p.title;
  modalPeriod.textContent=p.period;
  modalRole.textContent=p.role;
  modalOverview.textContent=p.overview;
  const imgs=p.images;
  modalPhoto.style.backgroundImage=`url('${imgs[0]}')`;
  modalPhoto.setAttribute('role','img');
  modalPhoto.setAttribute('aria-label',(p.alts&&p.alts[0])||p.title);
  modalStrip.hidden=imgs.length<2;
  modalStrip.style.gridTemplateColumns=`repeat(${Math.max(imgs.length,1)},1fr)`;
  modalStrip.innerHTML=imgs.map((src,n)=>`<button type="button" style="background-image:url('${src}')" aria-label="${(p.alts&&p.alts[n])||`View image ${n+1}`}" aria-current="${n===0}"></button>`).join('');
  [...modalStrip.children].forEach((btn,n)=>btn.addEventListener('click',()=>{
    modalPhoto.style.backgroundImage=`url('${imgs[n]}')`;
    modalPhoto.setAttribute('aria-label',(p.alts&&p.alts[n])||p.title);
    [...modalStrip.children].forEach((b,m)=>b.setAttribute('aria-current',String(m===n)));
  }));
  modalResults.innerHTML=p.results.map((r,n)=>`<div class="result result-${n}"><strong>${r[0]}</strong><span>${r[1]}</span></div>`).join('');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
  modal.querySelector('.modal-close').focus();
}
function closeProject(){
  if(!modal.classList.contains('open'))return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
  document.body.style.overflow='';
  if(lastFocus)lastFocus.focus();
}
document.querySelectorAll('[data-project]').forEach(el=>el.addEventListener('click',()=>openProject(Number(el.dataset.project))));
document.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',closeProject));
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeProject()});
