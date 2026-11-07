/* Public, disposable workspace. Never reads or writes the account's storage. */
const DEMO_MODE=new URLSearchParams(location.search).get('demo')==='1';
const localStorage=DEMO_MODE?(()=>{
  const records=new Map();
  return Object.freeze({
    getItem:key=>records.get(String(key))??null,
    setItem:(key,value)=>records.set(String(key),String(value)),
    removeItem:key=>records.delete(String(key)),
    clear:()=>records.clear(),
    key:index=>[...records.keys()][index]??null,
    get length(){return records.size;}
  });
})():window.localStorage;

if(DEMO_MODE){
  const now=new Date(),year=now.getFullYear(),month=now.getMonth(),half=now.getDate()<=15?1:2;
  localStorage.setItem('salary_theme','light');
  localStorage.setItem('salary_templates',JSON.stringify([
    {id:101,name:'Сборка корпуса',price:480},
    {id:102,name:'Подготовка деталей',price:220},
    {id:103,name:'Финишная обработка',price:350}
  ]));
  localStorage.setItem('salary_goals',JSON.stringify({period:90000,week:25000,month:180000,profile:{name:'Демо-профиль',info:'Мастер своего дела'},calc:{money:48000}}));
  for(let offset=0;offset<8;offset++){
    const date=new Date(year,month-Math.floor((offset+(half===1?1:0))/2),1);
    const p=offset%2===0?half:3-half;
    const start=p===1?1:16,end=p===1?15:new Date(date.getFullYear(),date.getMonth()+1,0).getDate();
    const last=offset===0?now.getDate():end;
    const workDays={};
    for(let d=start;d<=last;d++){
      if(d!==last&&(d-start)%3!==0)continue;
      workDays[d]=[
        {id:1000+d*2,name:'Сборка корпуса',qty:8+(d%5),price:480},
        {id:1001+d*2,name:'Подготовка деталей',qty:12+(d%4),price:220}
      ];
    }
    // The first record is always the period currently shown by the application.
    const y=offset===0?year:date.getFullYear(),m=offset===0?month:date.getMonth();
    const key=`salary_${y}_${m}_${p}`;
    const base=Object.values(workDays).flat().reduce((sum,w)=>sum+w.qty*w.price,0);
    localStorage.setItem(key,JSON.stringify({days:workDays,bonuses:[{id:9000,type:'period-premium-20',name:'Премия +20% за период',amount:Math.round(base*20)/100}],taxEnabled:false,dayOverrides:{},expenses:[{id:8001,name:'Материалы',amount:3400,mode:'period'},{id:8002,name:'Дорога',amount:180,mode:'day'}],_ts:Date.now()}));
  }
  localStorage.setItem(`salary-ui-day:local:salary_${year}_${month}_${half}`,String(now.getDate()));
}
