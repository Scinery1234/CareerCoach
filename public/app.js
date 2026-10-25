(() => {
/* ================= content ================= */
const STEPS=[
  {key:"values",label:"Values"},
  {key:"identity",label:"Who I am"},
  {key:"north",label:"North Star"},
  {key:"needs",label:"What I need"},
  {key:"strengths",label:"Strengths"},
  {key:"mix",label:"Mix ideas"},
  {key:"choose",label:"Choose"},
  {key:"plan",label:"Plan"},
  {key:"actions",label:"First steps"},
  {key:"calendar",label:"Calendar"},
];
const VALUES=["Achievement","Adventure","Balance","Beauty","Belonging","Calm","Care","Community","Courage","Creativity","Culture","Curiosity","Faith","Fairness","Family","Freedom","Friendship","Fun","Growth","Health","Home","Honesty","Hope","Humour","Independence","Joy","Justice","Kindness","Learning","Love","Loyalty","Making a difference","Money","Nature","Peace","Purpose","Respect","Security","Simplicity","Spirituality","Stability","Success","Teamwork","Trust","Wisdom"];
const INTROS={
  values:"Let's start with what matters most to you. Pick the values that feel like you, then put them in order. If you're stuck between two, tell me about them here and I'll ask a few questions.",
  identity:"Now write some **I am a / I am an** statements. They can be who you've been, who you are now, or who you'd like to be. Not just work: all of you. Then put them in order of what feels most true for you today.",
  north:"Your North Star is the most exciting picture of your **#1 value** being lived by your **#1 I am**. It can be about any part of life. Work is there to support it. The words are yours. If you'd like, start telling me about it here and I'll ask questions to help you find them.",
  needs:"Now the practical bit: what you need from work. These are the things a job has to have for it to work in your life.",
  strengths:"Let's map your strengths in three groups: things you **know**, things you **can do**, and things you **love**. Aim for at least three in each.",
  mix:"Time to play. You'll see 10 mixes of one thing you know, one you can do and one you love. For each, ask: what job or kind of work could bring these together? Add the ideas you already had too. Claude can suggest a few more when you're ready.",
  choose:"Look over your ideas and notice which ones light you up. Put them in order. Your top one becomes your top pick, and the next one your second. I'm happy to help you think it through.",
  plan:"Let's sketch a path toward your direction: what you could do now, over the next few months, and further out. A few sentences each is plenty.",
  actions:"Now three small first steps you can take in the next two weeks. Each one should take under two hours and start with a doing word, like call, write or sign up.",
  calendar:"Last step: give each first step a time in your calendar so it actually happens.",
};
const CRISIS_KEYWORDS=["suicide","suicidal","kill myself","end my life","take my life","want to die","don't want to live","dont want to live","no reason to live","better off dead","end it all","can't go on","cant go on","not worth living","self-harm","self harm","hurt myself","cut myself","cutting myself","overdose","starve myself","harm myself"];
const RESOURCES=[{name:"Lifeline",number:"13 11 14",desc:"24/7 crisis support"},{name:"Beyond Blue",number:"1300 22 4636",desc:"Mental health support"},{name:"Emergency",number:"000",desc:"Immediate danger"},{name:"SANE Australia",number:"1800 18 7263",desc:"Mental illness support"},{name:"13YARN",number:"13 92 76",desc:"Aboriginal & Torres Strait Islander"}];
const STORE_KEY="purposefields_wayfinder_v3", GOAL_KEY="purposefields_goals", CONSENT_KEY="purposefields_consent_v1";
const TZ=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||"Australia/Sydney"}catch{return "Australia/Sydney"}})();

/* ================= server API ================= */
// The guide prompt and suggestion prompts live on the server (see lib/prompts.js).
const api={
  async suggest(kind,data){
    let res;
    try{res=await fetch(`/api/suggest/${kind}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data})});}
    catch{throw {code:"connection"};}
    const body=await res.json().catch(()=>({}));
    if(!res.ok)throw {code:body.error||"error"};
    return body;
  },
  // Streams a reply; calls onText({text}) with the full text so far. Resolves {text}.
  async chat(turns,{signal,onText}={}){
    let res;
    try{res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({turns}),signal});}
    catch(e){throw {code:e?.name==="AbortError"?"cancelled":"connection"};}
    if(!res.ok){const body=await res.json().catch(()=>({}));throw {code:body.error||"error"};}
    const reader=res.body.getReader(),dec=new TextDecoder();let buf="",text="";
    try{
      for(;;){
        const {value,done}=await reader.read();if(done)break;
        buf+=dec.decode(value,{stream:true});let nl;
        while((nl=buf.indexOf("\n"))>=0){
          const line=buf.slice(0,nl).trim();buf=buf.slice(nl+1);if(!line)continue;
          let o;try{o=JSON.parse(line);}catch{continue;}
          if(o.error)throw {code:o.error,text:o.text||""};
          if(typeof o.text==="string"){text=o.text;onText?.({text});}
          if(o.done)return {text};
        }
      }
    }catch(e){if(e?.name==="AbortError")throw {code:"cancelled",text};throw e?.code?e:{code:"connection",text};}
    throw {code:"connection",text};
  },
};
// What the server needs to build suggestion prompts.
function profile(){return{values:S.values.ranked,iAm:S.identity.items.map(x=>x.text),north:S.north,needs:S.needs,strengths:S.strengths,first:S.choose.first,second:S.choose.second,ideas:S.mix.ideas.map(d=>d.title)};}
function download(name,data,type="text/calendar"){const url=URL.createObjectURL(new Blob([data],{type}));const a=h("a",{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}

/* ================= helpers ================= */
const $=id=>document.getElementById(id);
const store={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}},del(k){try{localStorage.removeItem(k)}catch{}}};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const rich=t=>esc(t).replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>");
function h(tag,attrs={},...kids){const el=document.createElement(tag);for(const[k,v]of Object.entries(attrs||{})){if(k.startsWith("on")&&typeof v==="function")el.addEventListener(k.slice(2),v);else if(v===false||v==null)continue;else if(k==="text")el.textContent=v;else el.setAttribute(k,v===true?"":v);}for(const k of kids.flat(3))if(k!=null&&k!==false)el.append(k);return el;}
const words=s=>String(s||"").split(/\s+/).filter(Boolean).length;
const today=()=>new Date().toLocaleDateString("en-CA");
const addDays=(d,n)=>{const[y,m,dd]=d.split("-").map(Number);return new Date(Date.UTC(y,m-1,dd+n)).toISOString().slice(0,10);};
const fmtDay=d=>{const[y,m,dd]=d.split("-").map(Number);return new Date(Date.UTC(y,m-1,dd)).toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short",timeZone:"UTC"});};
const addMin=(t,m)=>{const[a,b]=(t||"10:00").split(":").map(Number);const x=Math.min(a*60+b+Number(m||0),23*60+59);return String(Math.floor(x/60)).padStart(2,"0")+":"+String(x%60).padStart(2,"0");};
const fmtMoney=n=>n===""||n==null?"":"$"+Number(n).toLocaleString("en-AU");
const iam=s=>{s=String(s||"").trim().replace(/^i\s*am\s*/i,"").trim();if(!s)return"";if(/^(a|an)\s/i.test(s))return "I am "+s.replace(/^(a|an)\s+/i,m=>m.toLowerCase());return "I am "+(/^[aeiou]/i.test(s)?"an ":"a ")+s;};
const ckey=t=>`${t.know}|${t.do}|${t.love}`;
function makeTrios(G,seen){
  const all=[];for(const k of G.know)for(const d of G.do)for(const l of G.love)all.push({know:k,do:d,love:l});
  let pool=all.filter(t=>!seen.includes(ckey(t)));if(pool.length<Math.min(10,all.length))pool=all;
  const use={},out=[];const sc=t=>(use[t.know]||0)+(use[t.do]||0)+(use[t.love]||0);
  pool=pool.sort(()=>Math.random()-.5);
  while(out.length<10&&pool.length){let best=0;for(let j=1;j<pool.length;j++)if(sc(pool[j])<sc(pool[best]))best=j;const t=pool.splice(best,1)[0];out.push({...t,idea:"",added:[]});[t.know,t.do,t.love].forEach(x=>use[x]=(use[x]||0)+1);}
  return out;
}

/* ================= state ================= */
const blank=()=>({
  step:0,reached:0,done:false,
  values:{stage:"pick",picked:[],ranked:[],custom:""},
  identity:{stage:"write",items:[],inp:""},
  north:"",
  needs:{pay:"",hours:"",stress:"",mode:"",location:"",other:""},
  strengths:{know:[],do:[],love:[],other:[]},sInp:{know:"",do:"",love:"",other:""},
  mix:{trios:[],seen:[],had:"",ideas:[],suggestions:[]},
  choose:{first:"",second:""},
  plan:{now:"",building:"",move:"",longer:""},
  actions:["","",""],
  sched:null,
});
let S=blank(), turns=[];
let aiOn=false, busy=false, ctl=null, sortables=[];
function save(){store.set(STORE_KEY,JSON.stringify({S,turns}));}
function load(){try{const d=JSON.parse(store.get(STORE_KEY)||"null");if(d&&d.S){S=Object.assign(blank(),d.S);S.mix=Object.assign(blank().mix,S.mix||{});if(!Array.isArray(S.mix.trios))S.mix.trios=[];if(!Array.isArray(S.mix.seen))S.mix.seen=[];S.mix.trios.forEach(t=>{if(!Array.isArray(t.added))t.added=[];});turns=Array.isArray(d.turns)?d.turns:[];return true;}}catch{}return false;}
const topValue=()=>S.values.ranked[0]||"";
const topIam=()=>S.identity.items[0]?.text||"";

/* ================= step strip ================= */
function renderSteps(){
  const nav=$("steps");nav.innerHTML="";
  STEPS.forEach((st,i)=>{const done=i<S.reached||(S.done&&i<=S.reached);
    const b=h("button",{type:"button",class:(done?"done ":"")+(i===S.step?"now":""),disabled:i>S.reached,"aria-current":i===S.step?"step":null,onclick:()=>{S.step=i;save();renderAll();}},h("i",{text:done?"✓":String(i+1)}),st.label);
    nav.append(b);});
  nav.querySelector(".now")?.scrollIntoView({block:"nearest",inline:"nearest"});
}

/* ================= finishing a step ================= */
function finish(i){
  if(i>=STEPS.length-1){S.done=true;S.reached=STEPS.length-1;saveGoals();}
  else{S.reached=Math.max(S.reached,i+1);S.step=i+1;const k=STEPS[i+1].key;if(!turns.some(t=>t.intro===k)){turns.push({role:"assistant",content:INTROS[k],intro:k});addMsg("divider",STEPS[i+1].label);addMsg("ai",INTROS[k]);}}
  save();renderAll();$("wscroll").scrollTop=0;
}
function saveGoals(){
  let goals=[];try{goals=JSON.parse(store.get(GOAL_KEY)||"[]");}catch{}
  const date=new Date().toLocaleDateString("en-AU");
  S.actions.forEach((a,i)=>{if(a&&!goals.some(g=>g.text===a))goals.push({text:a,source:"Wayfinder",date,scheduled:S.sched?.[i]?.date||null});});
  store.set(GOAL_KEY,JSON.stringify(goals));
}

/* ================= ranking list ================= */
function rankList(arr,label,onChange,extra){
  const ul=h("ol",{class:"rank","aria-label":label});
  arr.forEach((item,i)=>{
    const text=typeof item==="string"?item:(item.text??item.title??"");
    const move=d=>{const j=i+d;if(j<0||j>=arr.length)return;[arr[i],arr[j]]=[arr[j],arr[i]];onChange();};
    ul.append(h("li",{"data-i":i},h("span",{class:"n",text:String(i+1)}),h("span",{class:"t"},text,extra?extra(item,i):null),
      h("span",{class:"ctl"},h("button",{type:"button","aria-label":`Move ${text} up`,disabled:i===0,onclick:()=>move(-1)},"↑"),h("button",{type:"button","aria-label":`Move ${text} down`,disabled:i===arr.length-1,onclick:()=>move(1)},"↓"),h("button",{type:"button",class:"grip","aria-hidden":"true",tabindex:"-1",title:"Drag to reorder"},"⋮⋮"))));
  });
  if(window.Sortable)sortables.push(new Sortable(ul,{handle:".grip",animation:150,onEnd:()=>{const order=[...ul.children].map(li=>arr[+li.dataset.i]);arr.splice(0,arr.length,...order);onChange();}}));
  return ul;
}

/* ================= workspace ================= */
function setBar(hint,buttons){const hb=$("barhint");hb.textContent=hint||"";hb.classList.remove("warn");const b=$("barbtns");b.innerHTML="";buttons.filter(Boolean).forEach(x=>b.append(x));}
// A button that's always pressable; if something is missing it says what, instead of being greyed out.
function needBtn(label,missing,action){return h("button",{class:"primary",type:"button",onclick:()=>{const m=missing().filter(Boolean);if(m.length){const hb=$("barhint");hb.textContent="Still needed: "+m.join(" · ");hb.classList.add("warn");return;}action();}},label);}
function aiErr(e){return e?.code==="unavailable"?"Suggestions aren't switched on for this site.":e?.code==="rate_limited"?"Too many requests just now. Try again in a moment.":e?.code==="connection"?"Couldn't reach the server. Check your connection and try again.":"That didn't work. Try again.";}
function heading(i,title,lead){return[h("span",{class:"kicker",text:`Step ${i+1} of ${STEPS.length}`}),h("h2",{text:title}),lead?h("p",{class:"lead",text:lead}):null];}
const rr=()=>{save();renderWork();};

function renderWork(){
  sortables.forEach(s=>{try{s.destroy()}catch{}});sortables=[];
  const w=$("wbody");w.innerHTML="";const i=S.step;const key=STEPS[i].key;
  if(S.done&&i===STEPS.length-1){renderSummary(w);return;}
  ({values:stepValues,identity:stepIdentity,north:stepNorth,needs:stepNeeds,strengths:stepStrengths,mix:stepMix,choose:stepChoose,plan:stepPlan,actions:stepActions,calendar:stepCalendar})[key](w,i);
}

function stepValues(w,i){
  const V=S.values;
  if(V.stage==="pick"){
    const n=V.picked.length;
    w.append(...heading(i,"What matters most to you?","Tap the values that feel most like you. Choose between 5 and 10."));
    w.append(h("div",{class:"chips"},[...VALUES,...V.picked.filter(v=>!VALUES.includes(v))].map(v=>{const sel=V.picked.includes(v);return h("button",{class:"chip",type:"button","aria-pressed":String(sel),disabled:!sel&&n>=10,onclick:()=>{V.picked=sel?V.picked.filter(x=>x!==v):[...V.picked,v];rr();}},v);})));
    const add=()=>{const v=V.custom.trim();if(!v||V.picked.includes(v)||n>=10)return;V.picked.push(v);V.custom="";rr();$("vCustom")?.focus();};
    w.append(h("div",{class:"field"},h("label",{class:"flabel",for:"vCustom",text:"Missing one? Add your own"}),h("div",{class:"addrow"},h("input",{class:"text",id:"vCustom",value:V.custom,placeholder:"Type a value",oninput:e=>{V.custom=e.target.value;save();},onkeydown:e=>{if(e.key==="Enter"){e.preventDefault();add();}}}),h("button",{class:"small",type:"button",onclick:add},"Add"))));
    setBar(`${n} chosen${n<5?" · choose at least 5":n>=10?" · that's the most":""}`,[needBtn("Next: put them in order",()=>[n<5&&`choose ${5-n} more value${5-n===1?"":"s"}`],()=>{V.ranked=[...V.ranked.filter(x=>V.picked.includes(x)),...V.picked.filter(x=>!V.ranked.includes(x))];V.stage="rank";rr();})]);
  } else {
    w.append(...heading(i,"Put your values in order","Drag them, or use the arrows. The one at the top is your #1 value."));
    w.append(rankList(V.ranked,"Your values in order",rr));
    setBar(V.ranked[0]?`Your #1 value: ${V.ranked[0]}`:"",[h("button",{class:"secondary",type:"button",onclick:()=>{V.stage="pick";rr();}},"Back"),h("button",{class:"primary",type:"button",onclick:()=>finish(i)},"Save my values")]);
  }
}

function stepIdentity(w,i){
  const I=S.identity;
  if(I.stage==="write"){
    w.append(...heading(i,"Who are you?"));
    w.append(h("ul",{class:"leadlist"},h("li",{text:"Write some \"I am a…\" or \"I am an…\" statements."}),h("li",{text:"They can be who you've been, who you are now, or who you'd love to be."}),h("li",{text:"Think about all of your life, not just work."})));
    const add=()=>{const t=iam(I.inp);if(!t)return;I.items.push({text:t});I.inp="";rr();$("iInp")?.focus();};
    w.append(h("div",{class:"card"},
      h("div",{class:"field"},h("label",{class:"flabel",for:"iInp",text:"Type the word or words that finish the sentence"}),h("div",{class:"addrow iamrow"},h("span",{class:"iampre",text:"I am a/an"}),h("input",{class:"text",id:"iInp",value:I.inp,placeholder:"e.g. mum, gardener, artist, teacher",oninput:e=>{I.inp=e.target.value;save();},onkeydown:e=>{if(e.key==="Enter"){e.preventDefault();add();}}}),h("button",{class:"small",type:"button",onclick:add},"Add")))));
    w.append(I.items.length?h("div",{class:"tags"},I.items.map((it,j)=>h("span",{class:"tag"},it.text,h("button",{class:"x",type:"button","aria-label":`Remove ${it.text}`,onclick:()=>{I.items.splice(j,1);rr();}},"×")))):h("p",{class:"empty",text:"Your statements will show up here. Aim for at least five."}));
    const n=I.items.length;
    setBar(`${n} written${n<3?" · write at least 3":""}`,[needBtn("Next: put them in order",()=>[n<3&&`write ${3-n} more "I am" statement${3-n===1?"":"s"}`],()=>{I.stage="rank";rr();})]);
  } else {
    w.append(...heading(i,"Which feels most true today?","Put your \"I am\" statements in order of what resonates with you most right now. The top one is your #1."));
    w.append(rankList(I.items,"Your I am statements in order",rr));
    setBar(I.items[0]?`Your #1: ${I.items[0].text}`:"",[h("button",{class:"secondary",type:"button",onclick:()=>{I.stage="write";rr();}},"Back"),h("button",{class:"primary",type:"button",onclick:()=>finish(i)},"Save")]);
  }
}

function stepNorth(w,i){
  w.append(...heading(i,"Your North Star","Picture your #1 value fully lived by your #1 \"I am\". Describe the most exciting version you can imagine. It can be about any part of your life. Work is there to support it."));
  w.append(h("div",{class:"anchor"},h("div",{},h("span",{text:"#1 value"}),h("b",{text:topValue()||"—"})),h("div",{},h("span",{text:"#1 I am"}),h("b",{text:topIam()||"—"}))));
  w.append(h("ul",{class:"prompts"},h("li",{text:"Where are you, and who's with you?"}),h("li",{text:"What does an ordinary day look like?"}),h("li",{text:"What are you doing, making or giving?"}),h("li",{text:"How does it feel?"})));
  const wc=h("div",{class:"wc",text:`${words(S.north)} words`});
  const ta=h("textarea",{class:"text",id:"nsText",rows:9,placeholder:"Write in your own words…","aria-label":"Your North Star",oninput:e=>{S.north=e.target.value;wc.textContent=`${words(S.north)} words`;save();}});ta.value=S.north;
  const btn=needBtn("Save my North Star",()=>[words(S.north)<15&&"a few more sentences (at least 15 words)"],()=>finish(i));
  w.append(ta,wc);
  setBar("Write at least a few sentences. Stuck? Talk it through in the chat.",[btn]);
}

function stepNeeds(w,i){
  const N=S.needs;
  w.append(...heading(i,"What do you need from work?","The practical things a job has to have for it to work in your life."));
  const live=()=>save();
  const btn=needBtn("Save",()=>[N.pay===""&&"lowest pay",!N.hours&&"hours a week",!N.stress&&"how much stress is OK",!N.mode&&"where you want to work"],()=>finish(i));
  w.append(h("div",{class:"grid2"},
    h("div",{class:"field"},h("label",{class:"flabel",for:"nPay",text:"Lowest pay I can accept (per year, before tax)"}),h("input",{class:"text",id:"nPay",type:"number",min:0,step:1000,inputmode:"numeric",value:N.pay,placeholder:"e.g. 75000",oninput:e=>{N.pay=e.target.value;live();}})),
    h("div",{class:"field"},h("label",{class:"flabel",for:"nHrs",text:"Most hours I want to work a week"}),h("input",{class:"text",id:"nHrs",type:"number",min:1,max:80,inputmode:"numeric",value:N.hours,placeholder:"e.g. 38",oninput:e=>{N.hours=e.target.value;live();}}))));
  w.append(h("div",{class:"field"},h("span",{class:"flabel",text:"How much stress is OK?"}),h("div",{class:"opts"},["Low","Some","A lot is fine"].map(v=>h("button",{class:"opt",type:"button","aria-pressed":String(N.stress===v),onclick:()=>{N.stress=v;rr();}},v)))));
  w.append(h("div",{class:"field"},h("span",{class:"flabel",text:"Where do you want to work?"}),h("div",{class:"opts"},["From home","Mix of home and on-site","On-site","Don't mind"].map(v=>h("button",{class:"opt",type:"button","aria-pressed":String(N.mode===v),onclick:()=>{N.mode=v;rr();}},v)))));
  w.append(h("div",{class:"field"},h("label",{class:"flabel",for:"nLoc",text:"Location (optional)"}),h("input",{class:"text",id:"nLoc",value:N.location,placeholder:"e.g. Gold Coast or Tweed, no long drives",oninput:e=>{N.location=e.target.value;save();}})));
  w.append(h("div",{class:"field"},h("label",{class:"flabel",for:"nOther",text:"Anything else that has to be true? (optional)"}),h("textarea",{class:"text",id:"nOther",rows:2,placeholder:"e.g. School pick-up on Wednesdays",oninput:e=>{N.other=e.target.value;save();}},N.other)));
  live();
  setBar("Pay, hours, stress and where you work are needed.",[btn]);
}

function stepStrengths(w,i){
  const G=S.strengths,I=S.sInp;
  w.append(...heading(i,"Your strengths","Three groups: what you know, what you can do, and what you love. At least three in each. More is better."));
  const cats=[["know","Things I know","Topics, places, cultures, industries, life experience","e.g. Gardening, NDIS, Tamil culture"],["do","Things I can do","Skills, practical or people-based","e.g. Calm people down, fix bikes, write"],["love","Things I love","What makes your heart sing, or your blood boil","e.g. Kids' wellbeing, live music, fairness"],["other","Other things I bring (optional)","People you know, places you can access, things you own","e.g. A big local network, a ute"]];
  const g=h("div",{class:"grid2"});
  for(const[k,label,hint,ph]of cats){
    const list=G[k];const add=()=>{const v=I[k].trim();if(!v)return;list.push(v);I[k]="";rr();$("s-"+k)?.focus();};
    g.append(h("div",{class:"card"},h("h3",{},label,k!=="other"?h("small",{class:list.length>=3?"met":"",text:`${list.length}/3`}):null),h("span",{class:"hint",text:hint}),
      list.length?h("div",{class:"tags"},list.map((v,j)=>h("span",{class:"tag"},v,h("button",{class:"x",type:"button","aria-label":`Remove ${v}`,onclick:()=>{list.splice(j,1);rr();}},"×")))):null,
      h("div",{class:"addrow"},h("input",{class:"text",id:"s-"+k,value:I[k],placeholder:ph,oninput:e=>{I[k]=e.target.value;save();},onkeydown:e=>{if(e.key==="Enter"){e.preventDefault();add();}}}),h("button",{class:"small",type:"button",onclick:add},"Add"))));
  }
  w.append(g);
  const ok=G.know.length>=3&&G.do.length>=3&&G.love.length>=3;
  setBar(ok?"Ready to mix":"At least 3 in each of the first three groups",[needBtn("Save my strengths",()=>[G.know.length<3&&`${3-G.know.length} more thing${3-G.know.length===1?"":"s"} you know`,G.do.length<3&&`${3-G.do.length} more thing${3-G.do.length===1?"":"s"} you can do`,G.love.length<3&&`${3-G.love.length} more thing${3-G.love.length===1?"":"s"} you love`],()=>finish(i))]);
}

function stepMix(w,i){
  const M=S.mix,G=S.strengths;
  w.append(...heading(i,"Mix and match","Here are 10 mixes of one thing you know, one you can do and one you love. For each one, ask: what job or kind of work could bring these together? Write an idea for as many as you can. Skip any that don't spark anything."));
  if(M.trios.some(t=>!G.know.includes(t.know)||!G.do.includes(t.do)||!G.love.includes(t.love)))M.trios=[];
  if(!M.trios.length){M.trios=makeTrios(G,M.seen);M.seen.push(...M.trios.map(ckey));save();}
  const answered=M.trios.filter(t=>t.added.length).length;
  w.append(h("div",{class:"sugg"},M.trios.map((t,j)=>{
    const id="trio"+j;
    const add=()=>{const v=t.idea.trim();if(!v)return;M.ideas.push({title:v,source:"Your mix",trio:[t.know,t.do,t.love]});t.added.push(v);t.idea="";save();renderWork();setTimeout(()=>$(id)?.focus(),0);};
    return h("div",{class:"card mixcard"},
      h("div",{class:"trio"},h("span",{class:"pl",text:String(j+1)}),h("span",{class:"slot on",text:t.know}),h("span",{class:"pl",text:"+"}),h("span",{class:"slot on",text:t.do}),h("span",{class:"pl",text:"+"}),h("span",{class:"slot on",text:t.love})),
      t.added.length?h("div",{class:"tags"},t.added.map(v=>h("span",{class:"tag got",text:"✓ "+v}))):null,
      aiOn?h("button",{class:"mini",type:"button",onclick:async ev=>{const b=ev.currentTarget;b.disabled=true;b.textContent="Thinking…";
        try{const r=await api.suggest("mixIdea",{know:t.know,do:t.do,love:t.love,avoid:[...t.added,...M.ideas.map(d=>d.title)]});
          if(typeof r?.idea==="string"&&r.idea.trim()){t.idea=r.idea.trim();save();const inp=$(id);if(inp){inp.value=t.idea;inp.focus();}}b.textContent="Suggest another";}
        catch(e){b.textContent=aiErr(e);}b.disabled=false;}},"Suggest an idea for this mix"):null,
      h("div",{class:"addrow"},h("input",{class:"text",id,value:t.idea,placeholder:t.added.length?"Another idea?":"What job or work could this be?","aria-label":`Idea for mix ${j+1}`,oninput:e=>{t.idea=e.target.value;save();},onkeydown:e=>{if(e.key==="Enter"){e.preventDefault();add();}}}),h("button",{class:"small",type:"button",onclick:add},"Add")));
  })));
  w.append(h("div",{class:"addrow",style:"align-items:center;flex-wrap:wrap"},h("span",{class:"hint",text:`${answered} of ${M.trios.length} mixes answered.`}),h("button",{class:"small alt",type:"button",onclick:()=>{M.trios=makeTrios(G,M.seen);M.seen.push(...M.trios.map(ckey));save();renderWork();$("wscroll").scrollTop=0;}},"Remix: 10 new mixes")));
  const addHad=()=>{const t=M.had.trim();if(!t)return;M.ideas.push({title:t,source:"Already had"});M.had="";rr();$("mHad")?.focus();};
  w.append(h("div",{class:"card"},h("h3",{text:"Ideas you already had"}),h("span",{class:"hint",text:"Any job or career you've thought about before, even years ago."}),
    h("div",{class:"addrow"},h("input",{class:"text",id:"mHad",value:M.had,placeholder:"e.g. Paramedic, opening a café",oninput:e=>{M.had=e.target.value;save();},onkeydown:e=>{if(e.key==="Enter"){e.preventDefault();addHad();}}}),h("button",{class:"small",type:"button",onclick:addHad},"Add"))));
  // Claude suggestions
  const sbox=h("div",{class:"card"},h("h3",{text:"More ideas from Claude"}),h("span",{class:"hint",text:"Claude mixes your strengths into a few more ideas. Keep the ones you like."}));
  const status=h("span",{class:"hint"});
  const sBtn=h("button",{class:"small alt",type:"button",disabled:!aiOn,onclick:()=>suggest(sBtn,status)},M.suggestions.length?"Suggest a few more":"Suggest ideas");
  sbox.append(h("div",{class:"addrow",style:"align-items:center"},sBtn,status));
  if(!aiOn)status.textContent="Not switched on for this site.";
  if(M.suggestions.length)sbox.append(h("div",{class:"sugg"},M.suggestions.map((s,j)=>h("div",{class:"idea"},h("b",{text:s.title}),h("button",{class:"small alt",type:"button",onclick:()=>{M.ideas.push({title:s.title,source:"Suggested",trio:[s.know,s.do,s.love],why:s.why});M.suggestions.splice(j,1);rr();}},"Keep"),h("span",{class:"why",text:[s.know,s.do,s.love].filter(Boolean).join(" + ")+(s.why?` · ${s.why}`:"")})))));
  w.append(sbox);
  // list
  w.append(h("div",{class:"card"},h("h3",{},"My ideas",h("small",{text:String(M.ideas.length)})),M.ideas.length?h("div",{class:"sugg"},M.ideas.map((d,j)=>h("div",{class:"idea"},h("b",{text:d.title}),h("button",{class:"x",type:"button","aria-label":`Remove ${d.title}`,onclick:()=>{M.ideas.splice(j,1);rr();}},"×"),h("span",{class:"why"},h("span",{class:"src",text:d.source.toUpperCase()}),d.trio?" · "+d.trio.join(" + "):"")))):h("p",{class:"empty",text:"Your ideas will collect here."})));
  const n=M.ideas.length;
  setBar(`${n} idea${n===1?"":"s"}${n<2?" · add at least 2":""}`,[needBtn("Next: choose",()=>[n<2&&`add ${2-n} more idea${2-n===1?"":"s"} (press Add next to your idea)`],()=>finish(i))]);
}

async function suggest(btn,status){
  if(!aiOn)return;btn.disabled=true;status.textContent="Thinking…";
  try{
    const {ideas:list=[]}=await api.suggest("ideas",profile());
    S.mix.suggestions=[...S.mix.suggestions,...list];status.textContent=list.length?"":"No ideas came back. Try again.";save();renderWork();
  }catch(e){status.textContent=aiErr(e);btn.disabled=false;}
}

function stepChoose(w,i){
  const C=S.choose,ideas=S.mix.ideas;
  w.append(...heading(i,"Which ideas light you up?","Put your ideas in order. Drag them, or use the arrows. The top one becomes your top pick and the next one your second."));
  w.append(h("div",{class:"anchor"},h("div",{},h("span",{text:"#1 value"}),h("b",{text:topValue()||"—"})),h("div",{},h("span",{text:"#1 I am"}),h("b",{text:topIam()||"—"}))));
  if(S.north)w.append(h("p",{class:"ns",text:S.north}));
  const sync=()=>{C.first=ideas[0]?.title||"";C.second=ideas[1]?.title||"";};
  sync();
  w.append(rankList(ideas,"Your ideas in order",()=>{sync();rr();},(d,j)=>[j===0?h("span",{class:"badge",text:"Top pick"}):j===1?h("span",{class:"badge b2",text:"Second"}):null,d.trio?h("span",{class:"hint",style:"display:block",text:d.trio.join(" + ")}):null]));
  setBar(C.first?`Top pick: ${C.first}`:"Add some ideas first",[needBtn("Save my order",()=>[!ideas.length&&"some ideas (go back to Mix ideas)"],()=>{sync();finish(i);})]);
}

// A small "suggest" control: two taps if it would replace something they've written.
function aiControl(label,againLabel,hasWork,run){
  const status=h("span",{class:"hint"});let armed=false,used=false;
  const btn=h("button",{class:"small alt",type:"button",onclick:async()=>{
    if(!aiOn){status.textContent="Not switched on for this site.";return;}
    if(hasWork()&&!armed){armed=true;btn.textContent="Tap again to replace what's here";setTimeout(()=>{if(armed){armed=false;btn.textContent=used?againLabel:label;}},3500);return;}
    armed=false;btn.disabled=true;status.textContent="Thinking…";
    try{await run();used=true;status.textContent="Change anything you like.";}catch(e){status.textContent=aiErr(e);}
    btn.disabled=false;btn.textContent=used?againLabel:label;}},label);
  return h("div",{class:"airow"},h("span",{class:"hint",text:"Drawing a blank?"}),btn,status);
}

function stepPlan(w,i){
  const P=S.plan;
  w.append(...heading(i,`A path toward ${S.choose.first||"your direction"}`,"A few sentences for each stage. It's a rough sketch, not a promise."));
  const stages=[["now","Now (next 3 months)","What could you start doing or learning straight away?"],["building","Building (3 to 9 months)","What will you build up: skills, people, experience?"],["move","Making the move (9 to 18 months)","What does the shift look like?"],["longer","Longer term (18 months and beyond)","Where is this heading?"]];
  const tas={};
  w.append(aiControl("Suggest a path","Try another path",()=>stages.some(([k])=>P[k].trim()),async()=>{
    const r=await api.suggest("plan",profile());
    for(const[k]of stages){if(typeof r?.[k]==="string"&&r[k]){P[k]=r[k];if(tas[k])tas[k].value=P[k];}}
    save();
  }));
  stages.forEach(([k,l,ph])=>{
    const ta=h("textarea",{class:"text",id:"p-"+k,rows:3,placeholder:ph,oninput:e=>{P[k]=e.target.value;save();}});ta.value=P[k];tas[k]=ta;
    w.append(h("div",{class:"field"},h("label",{class:"flabel",for:"p-"+k,text:l}),ta));
  });
  setBar("Start with Now. The rest can be rough.",[needBtn("Save my plan",()=>[!P.now.trim()&&"something for Now (next 3 months)"],()=>finish(i))]);
}

function goalCard(){
  return h("div",{class:"goal"},h("span",{text:"Working towards"}),h("b",{text:S.choose.first||"Your top pick"}),
    S.plan.now.trim()?h("p",{},h("strong",{text:"Now: "}),S.plan.now.trim()):null,
    topValue()?h("p",{text:`Living my #1 value, ${topValue()}${topIam()?`, as ${topIam().replace(/^I am /,"")}`:""}.`}):null);
}
function stepActions(w,i){
  const A=S.actions;
  w.append(...heading(i,"Three small first steps","Things you can do in the next two weeks. Each under two hours. Start with a doing word."));
  w.append(goalCard());
  const ins=[];
  w.append(aiControl("Suggest 3 steps","Try 3 different steps",()=>A.some(a=>a.trim()),async()=>{
    const {steps:list=[]}=await api.suggest("steps",{...profile(),planNow:S.plan.now});
    if(!list.length)throw {code:"empty"};
    list.forEach((x,j)=>{A[j]=x.trim();if(ins[j])ins[j].value=A[j];});save();
  }));
  const eg=["e.g. Call Sam to ask what her job is really like","e.g. Sign up for the free short course","e.g. Write a list of 5 places I'd love to work"];
  [0,1,2].forEach(j=>{const inp=h("input",{class:"text",id:"a"+j,value:A[j],placeholder:eg[j],oninput:e=>{A[j]=e.target.value;save();}});ins[j]=inp;w.append(h("div",{class:"field"},h("label",{class:"flabel",for:"a"+j,text:`Step ${j+1}`}),inp));});
  setBar("Three small steps.",[needBtn("Save my steps",()=>A.map((a,j)=>!a.trim()&&`step ${j+1}`),()=>finish(i))]);
}

function calLinks(date){
  const [y,m,d]=(date||today()).split("-").map(Number);
  return h("div",{class:"card"},h("h3",{text:"Check your calendar"}),h("span",{class:"hint",text:"Open your calendar in a new tab to see when you're free."}),
    h("div",{class:"acts"},
      h("a",{href:`https://calendar.google.com/calendar/r/week/${y}/${m}/${d}`,target:"_blank",rel:"noopener noreferrer"},"Google Calendar"),
      h("a",{href:"https://outlook.live.com/calendar/0/view/week",target:"_blank",rel:"noopener noreferrer"},"Outlook"),
      h("a",{href:"https://outlook.office.com/calendar/view/week",target:"_blank",rel:"noopener noreferrer"},"Outlook (work or school)"),
      h("a",{href:"https://www.icloud.com/calendar/",target:"_blank",rel:"noopener noreferrer"},"Apple iCloud")));
}
function stepCalendar(w,i){
  if(!S.sched||S.sched.length!==3)S.sched=[1,4,8].map(d=>({date:addDays(today(),d),start:"10:00",dur:60}));
  const days=[];for(let d=0;d<=14;d++)days.push(addDays(today(),d));
  S.sched.forEach(s=>{if(!days.includes(s.date))s.date=days[1];});
  w.append(...heading(i,"Put them in your calendar","Pick a day and time in the next two weeks for each step."));
  w.append(goalCard());
  w.append(calLinks(S.sched[0]?.date));
  S.actions.forEach((a,j)=>{const s=S.sched[j];
    w.append(h("div",{class:"card"},h("h3",{text:a}),h("div",{class:"slotrow"},
      h("select",{class:"text","aria-label":`Day for step ${j+1}`,onchange:e=>{s.date=e.target.value;save();}},days.map(d=>h("option",{value:d,selected:s.date===d},d===today()?"Today":fmtDay(d)))),
      h("input",{class:"text",type:"time","aria-label":`Start time for step ${j+1}`,value:s.start,step:900,onchange:e=>{s.start=e.target.value||"10:00";save();}}),
      h("select",{class:"text","aria-label":`How long for step ${j+1}`,onchange:e=>{s.dur=Number(e.target.value);save();}},[30,45,60,90,120].map(m=>h("option",{value:m,selected:Number(s.dur)===m},m<60?`${m} min`:m===60?"1 hour":m===90?"1½ hours":"2 hours"))))));});
  setBar("You'll get calendar links on the next screen.",[h("button",{class:"primary",type:"button",onclick:()=>finish(i)},"Lock it in")]);
}

/* ================= summary ================= */
function evt(j){const s=S.sched[j],a=S.actions[j];return{title:`Wayfinder: ${a}`,details:`Toward: ${S.choose.first}\nMy North Star: ${S.north}`.slice(0,1500),date:s.date,start:s.start,end:addMin(s.start,s.dur)};}
function gcal(e){const d=e.date.replace(/-/g,"");return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(e.title)}&dates=${d}T${e.start.replace(":","")}00/${d}T${e.end.replace(":","")}00&ctz=${encodeURIComponent(TZ)}&details=${encodeURIComponent(e.details)}`;}
function ics(list){
  const x=s=>String(s).replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\n/g,"\\n");
  const stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d+/,"");
  const L=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Purposefields//Wayfinder//EN","CALSCALE:GREGORIAN"];
  list.forEach((e,k)=>{const d=e.date.replace(/-/g,"");L.push("BEGIN:VEVENT",`UID:${Date.now()}-${k}@purposefields`,`DTSTAMP:${stamp}`,`DTSTART;TZID=${TZ}:${d}T${e.start.replace(":","")}00`,`DTEND;TZID=${TZ}:${d}T${e.end.replace(":","")}00`,`SUMMARY:${x(e.title)}`,`DESCRIPTION:${x(e.details)}`,"BEGIN:VALARM","ACTION:DISPLAY","TRIGGER:-PT15M",`DESCRIPTION:${x(e.title)}`,"END:VALARM","END:VEVENT");});
  L.push("END:VCALENDAR");return L.join("\r\n");
}
async function copyText(t,btn){const old=btn.textContent;try{await navigator.clipboard.writeText(t);btn.textContent="Copied";}catch{btn.textContent="Couldn't copy";}setTimeout(()=>{btn.textContent=old;},1600);}
function saveFile(name,data,btn){const old=btn.textContent;try{download(name,data);btn.textContent="Saved";}catch{btn.textContent="Couldn't save";}setTimeout(()=>{btn.textContent=old;},1600);}
function summaryText(){
  const L=[`MY WAYFINDER MAP`,``,`Values (in order): ${S.values.ranked.join(", ")}`,``,`I am (in order):`,...S.identity.items.map((x,k)=>`${k+1}. ${x.text}`),``,`My North Star:`,S.north,``,`What I need from work: at least ${fmtMoney(S.needs.pay)} a year, up to ${S.needs.hours} hours a week, ${S.needs.stress.toLowerCase()} stress, ${S.needs.mode.toLowerCase()}${S.needs.location?`, ${S.needs.location}`:""}${S.needs.other?`. ${S.needs.other}`:""}`,``,`I know: ${S.strengths.know.join(", ")}`,`I can do: ${S.strengths.do.join(", ")}`,`I love: ${S.strengths.love.join(", ")}`,...(S.strengths.other.length?[`I also bring: ${S.strengths.other.join(", ")}`]:[]),``,`My ideas: ${S.mix.ideas.map(d=>d.title).join(", ")}`,``,`Top pick: ${S.choose.first}${S.choose.second?`\nSecond: ${S.choose.second}`:""}`,``,`Plan`,`Now: ${S.plan.now}`,`Building: ${S.plan.building}`,`Making the move: ${S.plan.move}`,`Longer term: ${S.plan.longer}`,``,`First steps`,...S.actions.map((a,k)=>`${k+1}. ${a} — ${fmtDay(S.sched[k].date)}, ${S.sched[k].start}`)];
  return L.join("\n");
}
function renderSummary(w){
  w.append(h("span",{class:"kicker",text:"Done"}),h("h2",{text:"Your Wayfinder map"}),h("p",{class:"lead",text:"Everything you worked out, in one place. Your first steps are ready to add to your calendar."}));
  const sec=(t,...kids)=>h("div",{class:"sum"},h("h3",{text:t}),...kids);
  const evts=S.actions.map((_,j)=>evt(j));
  w.append(sec("First steps",...S.actions.map((a,j)=>{const e=evts[j];return h("div",{class:"card"},h("b",{text:a}),h("span",{class:"when",text:`${fmtDay(e.date)} · ${e.start}–${e.end}`}),h("div",{class:"acts"},h("a",{href:gcal(e),target:"_blank",rel:"noopener noreferrer"},"Add to Google Calendar"),h("button",{type:"button",onclick:ev=>saveFile(`wayfinder-step-${j+1}.ics`,ics([e]),ev.currentTarget)},"Download for other calendars")));}),
    h("div",{class:"acts"},h("button",{type:"button",onclick:ev=>saveFile("wayfinder-first-steps.ics",ics(evts),ev.currentTarget)},"Download all three"))));
  w.append(sec("Top pick",h("p",{style:"font-size:20px;font-weight:600",text:S.choose.first}),S.choose.second?h("p",{class:"hint",text:`Second: ${S.choose.second}`}):null));
  w.append(sec("North Star",h("p",{class:"ns",text:S.north})));
  w.append(sec("Values",h("p",{text:S.values.ranked.map((v,k)=>`${k+1}. ${v}`).join("   ")})));
  w.append(sec("I am",h("p",{text:S.identity.items.map((x,k)=>`${k+1}. ${x.text}`).join("\n"),style:"white-space:pre-line"})));
  w.append(sec("Plan",...[["Now",S.plan.now],["Building",S.plan.building],["Making the move",S.plan.move],["Longer term",S.plan.longer]].filter(([,v])=>v).map(([k,v])=>h("p",{},h("b",{text:k+": "}),v))));
  w.append(sec("Strengths",h("p",{},h("b",{text:"I know: "}),S.strengths.know.join(", ")),h("p",{},h("b",{text:"I can do: "}),S.strengths.do.join(", ")),h("p",{},h("b",{text:"I love: "}),S.strengths.love.join(", "))));
  setBar("Edit any step from the strip at the top.",[h("button",{class:"primary",type:"button",onclick:ev=>copyText(summaryText(),ev.currentTarget)},"Copy my map")]);
}

/* ================= chat ================= */
function addMsg(role,text){
  if(role==="divider"){const d=h("div",{class:"divider",text});$("log").append(d);return{};}
  const b=h("div",{class:"bubble"});if(role==="me")b.textContent=text;else b.innerHTML=rich(text);
  const m=h("div",{class:"msg"+(role==="me"?" me":"")},b);$("log").append(m);scrollDown();return{m,b};
}
function scrollDown(){const s=$("chatlog");s.scrollTop=s.scrollHeight;}
function context(){
  const st=STEPS[S.step];
  const snap={values_in_order:S.values.ranked.length?S.values.ranked:S.values.picked,i_am_in_order:S.identity.items.map(x=>x.text),north_star:S.north,needs:S.needs,strengths:S.strengths,ideas:S.mix.ideas.map(d=>d.title),top_pick:S.choose.first,second:S.choose.second,plan:S.plan,first_steps:S.actions};
  return `[Where they are] Step ${S.step+1} of ${STEPS.length}: ${st.label}. ${INTROS[st.key].replace(/\*\*/g,"")}\nTheir answers so far: ${JSON.stringify(snap)}`;
}
const ERR={unavailable:"Chat isn't switched on for this site.",rate_limited:"Too many messages just now. Wait a moment, then try again.",overloaded:"Claude is very busy right now. Try again in a minute.",connection:"Couldn't reach the server. Check your connection and send again.",refused:"Claude couldn't answer that. Try saying it another way.",empty_completion:"No reply came back. Try again.",prompt_too_large:"This chat has grown too long. Press Start over to begin a fresh one (your answers will be cleared)."};
function setBusy(b){busy=b;const btn=$("sendBtn");btn.classList.toggle("stop",b);btn.textContent=b?"Stop":"Send";btn.disabled=b?false:(!aiOn||!$("box").value.trim());}
async function send(text){
  text=(text||"").trim();if(!text||busy)return;
  if(CRISIS_KEYWORDS.some(k=>text.toLowerCase().includes(k)))openCrisis();
  addMsg("me",text);turns.push({role:"user",content:text});save();
  if(!aiOn)return;
  const {m,b}=addMsg("ai","Thinking…");b.classList.add("thinking");
  ctl=new AbortController();setBusy(true);
  const recent=turns.slice(-30).map(t=>({role:t.role,content:t.content}));
  const last=recent.pop();
  try{
    const {text:reply}=await api.chat([...recent,{role:"user",content:last.content+"\n\n"+context()}],{signal:ctl.signal,onText:({text})=>{b.classList.remove("thinking");b.innerHTML=rich(text);scrollDown();}});
    b.classList.remove("thinking");b.innerHTML=rich(reply);turns.push({role:"assistant",content:reply});
  }catch(e){
    b.classList.remove("thinking");
    if(e?.text){b.innerHTML=rich(e.text);turns.push({role:"assistant",content:e.text});}else m.remove();
    if(e?.code!=="cancelled"){const note=h("div",{class:"note",text:ERR[e?.code]||"The connection dropped. Try sending again."});if(m.isConnected)m.append(note);else $("log").append(note);}
  }
  save();setBusy(false);scrollDown();
}

/* ================= wiring ================= */
function renderAll(){renderSteps();renderWork();}
function openCrisis(){$("crisis").hidden=false;$("crisisClose").focus();}
$("resList").append(...RESOURCES.map(r=>h("div",{},h("span",{},h("b",{text:r.name}),h("small",{text:r.desc})),h("a",{href:"tel:"+r.number.replace(/\s/g,""),text:r.number}))));
$("helpBtn").onclick=openCrisis;$("crisisClose").onclick=()=>{$("crisis").hidden=true;};
const cks=["c1","c2","c3","c4"].map($);
cks.forEach(c=>c.addEventListener("change",()=>{$("consentGo").disabled=!cks.every(x=>x.checked);}));
$("consentGo").onclick=()=>{store.set(CONSENT_KEY,JSON.stringify({timestamp:Date.now()}));$("consent").hidden=true;};
$("consentHelp").onclick=openCrisis;
try{const c=JSON.parse(store.get(CONSENT_KEY)||"null");if(!c||(Date.now()-c.timestamp)/864e5>=90)$("consent").hidden=false;}catch{$("consent").hidden=false;}

const box=$("box");
box.addEventListener("input",()=>{box.style.height="auto";box.style.height=Math.min(box.scrollHeight,130)+"px";if(!busy)$("sendBtn").disabled=!aiOn||!box.value.trim();});
box.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();go();}});
function go(){const t=box.value;if(!t.trim()||busy)return;box.value="";box.style.height="auto";$("sendBtn").disabled=true;send(t);}
$("sendBtn").onclick=()=>{if(busy){ctl?.abort();return;}go();};
function setTab(talk){document.body.classList.toggle("talk",talk);$("tabWork").setAttribute("aria-selected",String(!talk));$("tabTalk").setAttribute("aria-selected",String(talk));if(talk)scrollDown();}
$("tabWork").onclick=()=>setTab(false);$("tabTalk").onclick=()=>setTab(true);

let armed=null;
$("restart").onclick=()=>{const btn=$("restart");
  if(!armed){btn.textContent="Tap again to clear everything";armed=setTimeout(()=>{btn.textContent="Start over";armed=null;},3000);return;}
  clearTimeout(armed);armed=null;btn.textContent="Start over";ctl?.abort();S=blank();turns=[];store.del(STORE_KEY);boot();};

function boot(){
  if(!turns.length)turns.push({role:"assistant",content:INTROS.values,intro:"values"});
  $("log").innerHTML="";
  for(const t of turns){if(t.intro){addMsg("divider",STEPS.find(s=>s.key===t.intro)?.label||"");}addMsg(t.role==="user"?"me":"ai",t.content);}
  renderAll();save();
}
load();boot();

(async()=>{
  try{const r=await fetch("/api/status");aiOn=!!(await r.json()).ai;}catch{aiOn=false;}
  $("unavail").hidden=aiOn;
  if(!busy)$("sendBtn").disabled=!aiOn||!box.value.trim();
  renderWork();
})();
})();
