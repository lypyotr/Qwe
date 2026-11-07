import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('index.html','utf8');
const section=(start,end)=>{
  const a=html.indexOf(start),b=html.indexOf(end,a);
  assert.ok(a>=0&&b>a,'application section exists: '+start);
  return html.slice(a,b);
};
const records=new Map(),elements=new Map(),dirty=[];
const element=id=>{
  if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',attributes:{},classList:{toggle(){}},setAttribute(name,value){this.attributes[name]=value;}});
  return elements.get(id);
};
const ctx=vm.createContext({console,Date,Math,
  document:{getElementById:element,querySelectorAll:()=>[]},window:{},setTimeout:()=>0,
  localStorage:{getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,String(v)),key:i=>[...records.keys()][i],get length(){return records.size;}},
  haptic(){},markPeriodDirty:key=>dirty.push(key),
  renderHistory(){},renderAchievements(){},renderGoals(){},renderDayStrip(){},renderDayPanel(){},renderChart(){},renderExpenses(){},renderPeriodCard(){},renderTaxToggle(){},ensureMonthOption(){},rememberPeriodDay(){},toast(){},
});
vm.runInContext(`
  let days={},bonuses=[],taxEnabled=false,dayOverrides={},expenseItems=[],selectedDay=1;
  let period={year:2026,month:10,period:1,startDay:1,endDay:15};
  function getPeriod(){return period;}
  function saveKey(){return 'salary_'+period.year+'_'+period.month+'_'+period.period;}
  function periodFsKey(){return saveKey().replace('salary_','');}
  function M(value){return value+' ₽';}
  function esc(value){return String(value||'');}
  function renderTotal(){renderPeriodPremium();}
`,ctx);
vm.runInContext(section('function save(){','function onPeriodChange('),ctx);
vm.runInContext(section('function isPeriodPremium(','function fmt('),ctx);
vm.runInContext(section('function periodSnapshot(','// ══════════════════════════════════════════════\n//  SYNC STATUS PILL'),ctx);
vm.runInContext(section('function collectPeriodStats(','function renderStats('),ctx);
const run=code=>vm.runInContext(code,ctx);

assert.equal(run('calcTotal()'),0);
run('togglePeriodPremium()');
assert.equal(element('periodPremiumToggle').attributes['aria-checked'],'true');
assert.equal(run('calcTotal()'),0,'an empty period gets no unearned bonus');
assert.equal(JSON.parse(records.get('salary_2026_10_1')).bonuses[0].type,'period-premium-20');

run("days={1:[{id:1,name:'Работа',qty:10,price:1000}]};bonuses.push({id:2,name:'Доплата',amount:500},{id:3,name:'Вычет',amount:-100});save();renderBonuses();");
assert.equal(run('calcTotal()'),12400,'20% applies only to work, not other supplements');
assert.equal(element('periodPremiumAmount').textContent,'Премия: +2000 ₽');
assert.ok(!element('bonusList').innerHTML.includes('period-premium-20'),'the automatic bonus is not a manually editable amount');
run('taxEnabled=true');
assert.equal(run('calcTotal()'),10788,'tax is deducted after adding the premium');
run('taxEnabled=false;days[1][0].qty=20;save();save();renderBonuses();');
assert.equal(run('calcTotal()'),24400,'the premium follows work edits without compounding');
assert.equal(JSON.parse(records.get('salary_2026_10_1')).bonuses[0].amount,4000,'exports retain an updated ruble amount');
assert.equal(run('bonuses.filter(isPeriodPremium).length'),1,'saving never duplicates the premium');
assert.ok(dirty.includes('2026_10_1'),'premium changes enter the existing sync queue');

run('period={...period,period:2,startDay:16,endDay:30};load();renderBonuses();');
assert.equal(element('periodPremiumToggle').attributes['aria-checked'],'false','other periods start with the premium disabled');
run('days={16:[{qty:1,price:2500}]};togglePeriodPremium();');
assert.equal(run('calcTotal()'),3000);
run('period={...period,period:1,startDay:1,endDay:15};load();renderBonuses();');
assert.equal(run('calcTotal()'),24400,'switching back restores the original period and premium');
assert.equal(element('periodPremiumToggle').attributes['aria-checked'],'true');

run('const snap=periodSnapshot();togglePeriodPremium();');
assert.equal(run('calcTotal()'),20400,'disabling removes only the percentage bonus');
assert.equal(run('bonuses.length'),2,'manual supplements are retained');
run('restorePeriodSnapshot(snap);');
assert.equal(run('calcTotal()'),24400,'undo snapshots preserve the premium');
run('bonuses[0].amount=1;localStorage.setItem(saveKey(),JSON.stringify({days,bonuses,taxEnabled}));load();');
assert.equal(run('calcTotal()'),24400,'a stale imported amount is recomputed from work');
assert.equal(run('collectPeriodStats().find(p=>p.p===1).total'),24400,'statistics use the same premium formula');
assert.equal(run('collectPeriodStats().find(p=>p.p===2).total'),3000);

run('days={1:[{qty:1,price:10.03}]};bonuses=bonuses.filter(isPeriodPremium);save();');
assert.equal(run('calcBonus()'),2.01,'premium is rounded to kopeks');
run('days={1:[{qty:1,price:-100}]};save();');
assert.equal(run('calcBonus()'),0,'a negative work balance cannot create a negative premium');
assert.equal(run('calcTotal()'),0);
run('togglePeriodPremium();save();load();renderBonuses();');
assert.equal(element('periodPremiumToggle').attributes['aria-checked'],'false','disabled state survives reload');
console.log('period premium OK: calculations, tax, edits, persistence, period isolation, sync queue, undo, statistics and rounding');
