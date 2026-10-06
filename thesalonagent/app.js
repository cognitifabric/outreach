const steps=[
{tag:'01 / AI VOICE',title:'Your next inquiry, taken care of.',body:'Alex asks for a classic full set with Jordan. The assistant checks the requested artist’s service price and collects the details needed to find an available time.',type:'voice'},
{tag:'02 / STAFF, PRICING & CALENDARS',title:'The right artist. The right time.',body:'Jordan’s classic full set is $120 in this fictional example. The appointment is saved against the configured schedule and connected staff and studio calendars. The $40 deposit is still pending.',type:'calendar'},
{tag:'03 / SMS NEXT STEP',title:'The details, in their pocket.',body:'A text gives Alex the appointment details and the next action. A configured deposit link can be included; receiving a link does not mean payment was completed.',type:'sms'},
{tag:'04 / TEAM DASHBOARD',title:'The team gets the whole picture.',body:'Service, staff, appointment time, source and deposit status sit together. Team members can review the booking and follow up when needed.',type:'team'},
{tag:'05 / HUMAN ASSISTANCE',title:'A person for the exceptions.',body:'When a request needs the team, the workflow can flag human assistance or record a callback request. The follow-up path is configured for the business.',type:'handoff'}
];
let currentStep=0;
const scene=document.querySelector('#product-scene');
function element(tag,text,className=''){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
function bubble(speaker,words,customer=false){const el=element('div','',customer?'bubble customer':'bubble');el.append(element('strong',speaker),element('span',words));return el;}
function row(label,value){const el=element('div','','scene-row');el.append(element('span',label),element('strong',value));return el;}
function renderStep(index){currentStep=index;if(typeof sceneController!=='undefined')sceneController?.setStep(index);const item=steps[index];document.querySelector('#step-kicker').textContent=item.tag;document.querySelector('#step-title').textContent=item.title;document.querySelector('#step-body').textContent=item.body;document.querySelectorAll('[data-step]').forEach(b=>{const active=Number(b.dataset.step)===index;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});document.querySelector('#previous-step').disabled=index===0;document.querySelector('#next-step').textContent=index===steps.length-1?'Start again ↻':'Next step →';scene.replaceChildren(element('p','DEMO STUDIO · FICTIONAL DATA','scene-eyebrow'));
if(item.type==='voice'){scene.append(element('h4','Mia · AI booking assistant'),bubble('ALEX','What is the price for a classic full set with Jordan, and can I book next Tuesday?',true),bubble('MIA','A classic full set with Jordan is $120. Let’s check their availability and find a time that works for you.'),element('p','Illustrative dialogue → staff price → availability','scene-status'));}
if(item.type==='calendar'){scene.append(element('h4','Tuesday, October 13, 2026'));const slot=element('div','','calendar-slot');slot.append(element('strong','2:00–3:30 PM · Alex Rivera'),element('p','Classic full set · Jordan · $120'),element('p','Appointment saved · $40 deposit pending'));scene.append(slot,row('STAFF CALENDAR','Jordan'),row('MASTER CALENDAR','Demo Studio'),element('p','Illustrative Google Calendar integration','scene-status'));}
if(item.type==='sms'){scene.append(element('h4','SMS with Mia'),bubble('MIA','Alex, your appointment is saved for Tue Oct 13, 2 PM with Jordan. Your $40 deposit is pending.'),bubble('MIA','Here is the next step: your secure deposit link.'),element('p','Illustrative link only. No SMS or payment is sent.','scene-status'));}
if(item.type==='team'){scene.append(element('h4','Booking overview'),row('CLIENT','Alex Rivera'),row('SERVICE / PRICE','Classic full set · $120'),row('STAFF / TIME','Jordan · Oct 13, 2 PM'),row('SOURCE','AI voice'),row('DEPOSIT','$40 · Pending'),element('p','Appointment saved; deposit payment is a separate status.','scene-status'));}
if(item.type==='handoff'){scene.append(element('h4','Human assistance'),bubble('ALEX','I have a question that needs the studio team.',true),bubble('MIA','I can ask a team member to follow up.'),row('REQUEST','Callback'),row('STATUS','Awaiting team follow-up'),element('p','Example of a configured escalation path','scene-status'));}}
document.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>renderStep(Number(button.dataset.step))));document.querySelector('#previous-step').addEventListener('click',()=>renderStep(Math.max(0,currentStep-1)));document.querySelector('#next-step').addEventListener('click',()=>renderStep((currentStep+1)%steps.length));
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
const sceneHost=document.querySelector('#workflow-3d');
// Reserve the desktop illustration's height before lazy loading so section links stay put.
sceneHost.hidden=motionPreference.matches || matchMedia('(max-width: 700px)').matches || navigator.connection?.saveData===true;
let sceneController;
renderStep(0);
const sceneObserver=new IntersectionObserver(async entries=>{
  if(!entries.some(e=>e.isIntersecting))return;
  sceneObserver.disconnect();
  if(motionPreference.matches || matchMedia('(max-width: 700px)').matches || navigator.connection?.saveData)return;
  try { const module=await import('./workflow-3d.js');sceneController=module.createWorkflowScene(sceneHost);sceneController.setStep(currentStep); } catch(error) { console.warn("Booking illustration fallback:",error.name,error.message);sceneHost.hidden=true; }
},{rootMargin:'200px'});
sceneObserver.observe(document.querySelector('#demo'));
document.querySelector('#motion-toggle').addEventListener('click',e=>{const paused=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(paused));e.currentTarget.textContent=paused?'Resume motion':'Pause motion';sceneController?.setPaused(paused);});
fetch('/media/transcripts/timeline.json').then(r=>{if(!r.ok)throw new Error('Transcript unavailable');return r.json();}).then(data=>{for(const line of data.narrator){document.querySelector('#video-transcript').append(element('p',line.text));}}).catch(()=>document.querySelector('#video-transcript').append(element('p','Request details are collected, availability is checked, an appointment is saved, SMS supplies the next step, and the team sees the booking or callback request.')));
const film=document.querySelector('video');
film.addEventListener('error',()=>{document.querySelector('#video-error').hidden=false;});

const $=selector=>document.querySelector(selector);
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
  } finally {button.disabled=false;button.textContent='Show me my AI front desk ↗'}
});
fetch('/api/public-config').then(r=>{if(!r.ok)throw new Error('Unavailable');return r.json()}).then(config=>{if(!config.intakeEnabled){$('#intake-unavailable').hidden=false;form.hidden=true}}).catch(()=>{$('#intake-unavailable').hidden=false;form.hidden=true});
