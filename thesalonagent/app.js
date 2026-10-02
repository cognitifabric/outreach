const $=s=>document.querySelector(s);
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
$('.menu-toggle').addEventListener('click',()=>{const open=$('#mobile-nav').hidden;$('#mobile-nav').hidden=!open;$('.menu-toggle').setAttribute('aria-expanded',String(open));$('.menu-toggle').setAttribute('aria-label',open?'Close navigation':'Open navigation')});
$('#mobile-nav').querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{$('#mobile-nav').hidden=true;$('.menu-toggle').setAttribute('aria-expanded','false')}));
$('#copyright-year').textContent=new Date().getFullYear();

const journey=[
  ['THE ENQUIRY','A warm hello.<br>A useful next step.','“Hi, I’m the studio’s AI assistant. Are you looking for a new set or a fill?”','Understand the request','Service + artist + time','Matched to the right schedule','Details sent by SMS'],
  ['THE AVAILABILITY','The right artist.<br>A time that fits.','Check the service length, staff hours and connected calendar before offering a time.','Check connected availability','Friday · 11:00 AM','Sample opening with artist Maya','Choose an available time'],
  ['THE BOOKING','Clear details.<br>Your booking rules.','Create the appointment request and explain any required deposit before it is confirmed.','Follow the business policy','Lash fill · Maya','Example hold · deposit pending','Appointment + deposit link'],
  ['THE FOLLOW-UP','A clear next step.<br>Less chasing.','Send approved appointment details and a deposit reminder when the client still needs to act.','Keep status visible','Payment status updated','Sample deposit marked paid','Confirmation + reminder'],
  ['THE TEAM HANDOFF','A person,<br>when it matters.','If the client asks for a person or the request falls outside the rules, collect it for your team.','Create a callback request','Client context in one place','Appointment history + team notes','Callback request for staff']
];
let sceneStep=0,sceneTimer;
function renderScene(index) {
  sceneStep=index;const data=journey[index];
  $('#scene-label').textContent=`0${index+1} / ${data[0]}`;
  $('#scene-title').innerHTML=data[1];$('#scene-copy').textContent=data[2];$('#scene-status').textContent=data[3];
  $('#scene-calendar').textContent=data[4];$('#scene-calendar-detail').textContent=data[5];$('#scene-message').textContent=data[6];
  document.querySelectorAll('.scene-step').forEach((b,i)=>{b.classList.toggle('active',i===index);b.setAttribute('aria-pressed',String(i===index))});
}
function replayScene(){clearInterval(sceneTimer);renderScene(0);if(reducedMotion.matches)return;sceneTimer=setInterval(()=>{if(sceneStep===4){clearInterval(sceneTimer);return}renderScene(sceneStep+1)},2800)}
document.querySelectorAll('.scene-step').forEach(b=>b.addEventListener('click',()=>{clearInterval(sceneTimer);renderScene(Number(b.dataset.step))}));
$('#replay-scene').addEventListener('click',replayScene);
$('#booking-scene').addEventListener('pointermove',e=>{if(reducedMotion.matches || e.pointerType!=='mouse')return;const rect=e.currentTarget.getBoundingClientRect();$('#scene-stack').style.setProperty('--ry',`${-14+(e.clientX-rect.left)/rect.width*16-8}deg`);$('#scene-stack').style.setProperty('--rx',`${7-(e.clientY-rect.top)/rect.height*10+5}deg`)});
$('#booking-scene').addEventListener('pointerleave',()=>{$('#scene-stack').style.removeProperty('--ry');$('#scene-stack').style.removeProperty('--rx')});
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearInterval(sceneTimer)});
reducedMotion.addEventListener('change',()=>{if(reducedMotion.matches)clearInterval(sceneTimer)});

const profiles={
  lashes:{business:'Sunday Lash Studio',service:'Lash fill',duration:'60 minutes',staff:'Maya',client:'Alex Morgan',question:'I’d like a lash fill. What times do you have?',intro:'I’m the studio’s AI assistant. I can help with your booking. We’ll use a sample 60-minute fill with artist Maya.',deposit:40},
  barber:{business:'Northside Barber Shop',service:'Cut + beard',duration:'45 minutes',staff:'Jordan',client:'Alex Morgan',question:'Can I book a haircut and beard trim?',intro:'I’m the shop’s AI assistant. Let’s find a time for your cut and beard trim with Jordan. This sample service takes 45 minutes.',deposit:20},
  wellness:{business:'Stillpoint Wellness Studio',service:'Private studio session',duration:'50 minutes',staff:'Riley',client:'Alex Morgan',question:'Do you have an opening for a private session?',intro:'I’m the studio’s AI assistant. I can help with scheduling. We’ll use a sample 50-minute studio session with Riley.',deposit:25}
};
let demo={profile:'lashes',scenario:'booking',phase:'start',view:'bookings',slot:'',paid:false,callback:false,booking:false};
function chatBubble(speaker,text,client=false){const bubble=document.createElement('p');bubble.className='bubble'+(client?' client':'');const label=document.createElement('span');label.className='speaker';label.textContent=speaker;bubble.append(label,document.createTextNode(text));return bubble}
function option(label,action,primary=false){const b=document.createElement('button');b.type='button';b.className='demo-option'+(primary?' primary':'');b.textContent=label;b.addEventListener('click',action);$('#demo-options').append(b)}
function record(title,detail,status,tone=''){const row=document.createElement('article');row.className='sample-record';const top=document.createElement('div');top.className='record-top';const h=document.createElement('h4');h.textContent=title;const tag=document.createElement('span');tag.className='record-tag '+tone;tag.textContent=status;top.append(h,tag);const p=document.createElement('p');p.textContent=detail;row.append(top,p);return row}
function resetDemo(){demo={...demo,phase:'start',slot:'',paid:false,callback:false,booking:false};renderDemo()}
function renderDemo() {
  const p=profiles[demo.profile],deposit=$('#demo-deposit').checked;
  $('#demo-business').textContent=p.business;$('#demo-chat').replaceChildren();$('#demo-options').replaceChildren();
  document.querySelectorAll('.profile-tab').forEach(b=>{const active=b.dataset.profile===demo.profile;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
  document.querySelectorAll('.scenario-tab').forEach(b=>{const active=b.dataset.scenario===demo.scenario;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
  const add=(speaker,text,client=false)=>$('#demo-chat').append(chatBubble(speaker,text,client));
  if(demo.scenario==='callback') {
    add('SAMPLE CLIENT','I have a question I’d rather discuss with a person.',true);
    add('AI ASSISTANT',demo.callback?'Your sample callback request is in the team’s queue, with your preferred contact time.':'Of course. I can collect a callback request for the team. What’s the best time to reach you?');
    if(!demo.callback){option('Request a callback after 3 PM',()=>{demo.callback=true;demo.phase='complete';demo.view='callbacks';renderDemo()},true)}
    else option('Try another workflow',()=>{demo.scenario='booking';resetDemo()});
  } else {
    const reschedule=demo.scenario==='reschedule',sms=demo.scenario==='sms';
    add(sms?'SAMPLE SMS CLIENT':'SAMPLE CLIENT',reschedule?'Could I move my sample appointment to Friday?':p.question,true);
    if(demo.phase==='start') {
      add(sms?'SMS ASSISTANT':'AI ASSISTANT',reschedule?'I can check times that fit your existing service. This fictional request is outside the example late-change window, so a change is allowed.':p.intro);
      option(reschedule?'Check replacement times':'Find sample openings',()=>{demo.phase='availability';renderDemo()},true);
    } else if(demo.phase==='availability') {
      add(sms?'SMS ASSISTANT':'AI ASSISTANT',`The sample calendar has two Friday openings with ${p.staff} for your ${p.duration.toLowerCase().replace('minutes','minute')} service. Which works for you?`);
      for(const time of ['11:00 AM','2:30 PM']) option(`Friday · ${time}`,()=>{demo.slot=time;demo.phase='selected';renderDemo()});
    } else if(demo.phase==='selected') {
      add('SAMPLE CLIENT',`Friday at ${demo.slot}, please.`,true);
      add(sms?'SMS ASSISTANT':'AI ASSISTANT',`${p.service} with ${p.staff} at ${demo.slot}. ${deposit && !reschedule?`This example requires a $${p.deposit} deposit. The appointment stays pending until that payment is recorded.`:reschedule?'Your sample paid deposit carries over; no new payment is requested.':'This example does not require a deposit.'}`);
      option(reschedule?'Confirm example change':'Create example booking',()=>{demo.phase='complete';demo.booking=true;demo.paid=reschedule || !deposit;demo.view='bookings';renderDemo()},true);
    } else {
      add(sms?'SMS ASSISTANT':'AI ASSISTANT',reschedule?`Your sample appointment has moved to Friday at ${demo.slot}. A confirmation text would follow in a configured system.`:demo.paid?`Your example appointment is confirmed for Friday at ${demo.slot}. Your team can see the status and client details.`:`Your example appointment is held for Friday at ${demo.slot}. A deposit link would be sent; the team sees “Deposit pending.”`);
      if(!demo.paid) option(`Simulate $${p.deposit} deposit paid`,()=>{demo.paid=true;renderDemo()},true);
      option('View sample client record',()=>{demo.view='clients';renderTeam()});
    }
  }
  renderTeam();
}
function renderTeam() {
  const p=profiles[demo.profile];const panel=$('#demo-team');panel.replaceChildren();
  document.querySelectorAll('.workspace-tab').forEach(b=>{const active=b.dataset.view===demo.view;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
  if(demo.view==='bookings') {
    panel.append(record('Casey Taylor · sample client',`${p.service} · ${p.staff} · Friday, 9:30 AM`,'Confirmed'));
    if(demo.booking) panel.append(record(`${p.client} · your example`,`${p.service} · ${p.staff} · Friday, ${demo.slot}`,demo.paid?(demo.scenario==='reschedule'?'Rescheduled':'Confirmed'):'Deposit pending',demo.paid?'':'pending'));
    else {const empty=document.createElement('p');empty.className='workspace-empty';empty.textContent='Complete the sample booking to see its appointment and payment status here.';panel.append(empty)}
  } else if(demo.view==='clients') {
    panel.append(record(`${p.client} · sample client`,`${p.service} preference · Preferred provider: ${p.staff}`,'Client context'));
    panel.append(record('Appointment history',demo.booking?`Latest example: Friday at ${demo.slot}. ${demo.paid?'Confirmed.':'Awaiting deposit.'}`:'One previous sample appointment. No new example booking yet.','Fictional record','blue'));
    panel.append(record('Team note','Client prefers an afternoon appointment when possible.','Staff context'));
  } else if(demo.callback) panel.append(record(`${p.client} · callback requested`,'Prefers after 3 PM · Wants to discuss a question with a person','Needs follow-up','pending'));
  else {const empty=document.createElement('div');empty.className='workspace-empty';const strong=document.createElement('strong');strong.textContent='No sample callbacks yet.';empty.append(strong,document.createTextNode('Choose “Ask for a person” to see how a request reaches your team.'));panel.append(empty)}
}
document.querySelectorAll('.profile-tab').forEach(b=>b.addEventListener('click',()=>{demo.profile=b.dataset.profile;resetDemo()}));
document.querySelectorAll('.scenario-tab').forEach(b=>b.addEventListener('click',()=>{demo.scenario=b.dataset.scenario;resetDemo()}));
document.querySelectorAll('.workspace-tab').forEach(b=>b.addEventListener('click',()=>{demo.view=b.dataset.view;renderTeam()}));
$('#demo-deposit').addEventListener('change',resetDemo);$('#reset-demo').addEventListener('click',resetDemo);renderDemo();

const calcIds=['calc-hours','calc-hour-value','calc-appointments','calc-contribution','calc-fee'];
function calculateValue(){const values=calcIds.map(id=>{const el=$('#'+id);return el.value.trim()==='' || !el.validity.valid?NaN:Number(el.value)});if(values.some(v=>!Number.isFinite(v)||v<0)){$('#calc-result').textContent='Check inputs';$('#calc-breakdown').textContent='Use nonnegative numbers in every field.';return}const [hours,hourValue,appointments,contribution,fee]=values,format=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v);$('#calc-result').textContent=format(hours*hourValue+appointments*contribution-fee);$('#calc-breakdown').textContent=`${format(hours*hourValue)} time value + ${format(appointments*contribution)} appointment contribution − ${format(fee)} assumed fee.`}
calcIds.forEach(id=>$('#'+id).addEventListener('input',calculateValue));calculateValue();

const tourSlides=[
  ['Your attention belongs with your clients.','Booking work often arrives at the least convenient moment: during a service, after closing, or while someone is handling another enquiry.',['Start with the calls and requests that take staff time.','Find the repetitive work your current tools leave behind.']],
  ['Connect the conversation to the appointment.','An AI assistant can understand the request, answer approved questions and guide the client toward the right next step.',['Voice and two-way SMS.','Service, provider and schedule selection.','An approved booking, booking link or callback workflow.']],
  ['Keep the follow-through in sync.','The workflow continues after the first conversation, so your client and your team know what happens next.',['Appointment details and approved deposit links.','Payment status and reminders.','Eligible changes handled under your policies.']],
  ['Give your team one view of the work.','A custom workspace brings the context together, instead of making your staff chase several disconnected tools.',['Bookings, client profiles and staff notes.','Connected calendars and recurring schedules.','Callback requests and exceptions for human review.']],
  ['Agree a useful, measurable starting point.','We review your existing tools, build one scoped workflow and test it with you before launch.',['Demonstrate the exact integration.','Agree setup costs, monthly fees and included usage.','Measure completed outcomes and admin time against a baseline.']],
  ['Let’s map your business.','Tell us where booking gets busy. We’ll follow up about a walkthrough focused on that workflow.',['Send your enquiry through the site anytime.','Email contact@fabricioguardia.com.','Los Angeles visits can be arranged.']]
];
let tourIndex=0;
function renderTour(){const [title,body,points]=tourSlides[tourIndex];$('#tour-count').textContent=`THE GUIDED TOUR / 0${tourIndex+1} OF 06`;$('#tour-title').textContent=title;$('#tour-body').textContent=body;$('#tour-points').replaceChildren(...points.map(t=>{const p=document.createElement('p');p.textContent=t;return p}));$('#tour-back').disabled=tourIndex===0;$('#tour-next').textContent=tourIndex===5?'Discuss my business ↗':'Next →'}
$('#open-tour').addEventListener('click',()=>{tourIndex=0;renderTour();$('#tour-dialog').showModal()});$('#close-tour').addEventListener('click',()=>$('#tour-dialog').close());
$('#tour-back').addEventListener('click',()=>{if(tourIndex>0){tourIndex--;renderTour()}});
function nextTour(){if(tourIndex===5){$('#tour-dialog').close();$('#contact').scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth'});$('#intake-form input').focus({preventScroll:true});return}tourIndex++;renderTour()}
$('#tour-next').addEventListener('click',nextTour);$('#tour-dialog').addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();nextTour()}if(e.key==='ArrowLeft' && tourIndex>0){e.preventDefault();tourIndex--;renderTour()}});

const form=$('#intake-form');let requestKey,payloadSignature;
form.addEventListener('submit',async e=>{
  e.preventDefault();if(!form.reportValidity())return;
  if(form.elements.contactPreference.value==='Phone call' && !form.elements.phone.value.trim()) {$('#form-error').textContent='Add your phone number or choose an email reply.';$('#form-error').hidden=false;form.elements.phone.focus();return}
  const data=Object.fromEntries(new FormData(form));
  const params=new URLSearchParams(location.search),tags=['utm_source','utm_medium','utm_campaign'].map(k=>params.get(k)?`${k}=${params.get(k)}`:'').filter(Boolean).join(' ');
  data.source=tags.slice(0,300) || 'Website';
  const signature=JSON.stringify(data);if(signature!==payloadSignature){payloadSignature=signature;requestKey=crypto.randomUUID()}data.requestKey=requestKey;
  const button=$('#submit-enquiry');button.disabled=true;button.textContent='Saving your enquiry…';$('#form-error').hidden=true;
  try {
    const response=await fetch('/api/intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(15000)});
    const result=await response.json();if(!response.ok || result.ok!==true)throw new Error(result.error || 'Could not save your enquiry.');
    $('#submission-reference').textContent=`Enquiry reference: ${result.id}`;form.hidden=true;$('#form-success').hidden=false;$('#form-success').focus();
  } catch(error) {
    $('#form-error').textContent=['TimeoutError','TypeError'].includes(error.name)?'We could not confirm receipt. Your details are still here. Try again, or email contact@fabricioguardia.com.':error.message;
    $('#form-error').hidden=false;$('#form-error').focus();
  } finally {button.disabled=false;button.textContent='Request a walkthrough ↗'}
});
fetch('/api/public-config').then(r=>{if(!r.ok)throw new Error('Unavailable');return r.json()}).then(config=>{if(!config.intakeEnabled){$('#intake-unavailable').hidden=false;form.hidden=true}}).catch(()=>{$('#intake-unavailable').hidden=false;form.hidden=true});
