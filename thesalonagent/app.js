const steps=[
{tag:'01 / CUSTOMER CALLS',title:'“Can I book with Jordan?”',body:'A booking request starts while your team is with a client.',type:'voice'},
{tag:'02 / AVAILABILITY CHECKED',title:'The right stylist. A time that fits.',body:'Staff hours, breaks and connected calendars guide the options.',type:'availability'},
{tag:'03 / APPOINTMENT IN THE CALENDAR',title:'Your team can see the appointment.',body:'A saved appointment and a paid deposit are separate statuses.',type:'calendar'},
{tag:'04 / CUSTOMER RECEIVES A TEXT',title:'The details. The next step.',body:'A deposit link gives the customer a way to pay through your provider.',type:'sms'},
{tag:'05 / TEAM SEES THE STATUS',title:'Know what still needs attention.',body:'Your team sees the booking and the pending deposit in one view.',type:'team'}
];
let currentStep=0;
const scene=document.querySelector('#product-scene');
function element(tag,text,className=''){const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;}
function bubble(speaker,words,customer=false){const el=element('div','',customer?'bubble customer':'bubble');el.append(element('strong',speaker),element('span',words));return el;}
function row(label,value){const el=element('div','','scene-row');el.append(element('span',label),element('strong',value));return el;}
function renderStep(index){
  currentStep=index;const item=steps[index];
  document.querySelector('#step-kicker').textContent=item.tag;
  document.querySelector('#step-title').textContent=item.title;
  document.querySelector('#step-body').textContent=item.body;
  document.querySelectorAll('[data-step]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.step)===index)));
  const next=document.querySelector('#next-step');next.textContent=index===steps.length-1?'Replay ↻':'Next →';next.setAttribute('aria-label',index===steps.length-1?'Replay booking walkthrough':'Show next booking step');
  scene.replaceChildren();
  if(item.type==='voice'){scene.append(bubble('ALEX · DEMO CUSTOMER',"I'd like a lash set with Jordan on Tuesday.",true),bubble('MIA · AI RECEPTIONIST','Let’s check Jordan’s price and available times.'));}
  if(item.type==='availability'){scene.append(row('Stylist / service','Jordan · Classic full set'),row('Service price','$120'),row('Staff schedule','Hours & breaks checked'));const slots=element('div','','availability-slots');slots.append(element('span','2:00 PM'),element('span','4:00 PM'));scene.append(slots,element('p','Illustrative available times · fictional schedule','scene-status'));}
  if(item.type==='calendar'){const slot=element('div','','calendar-slot');slot.append(element('strong','Tue Oct 13 · 2:00–3:30 PM'),element('p','Alex Rivera · Classic full set'),element('p','Jordan · Demo Studio'));scene.append(slot,element('span','$40 deposit pending','pending-status'),element('p','Illustrative connected calendar · fictional appointment','scene-status'));}
  if(item.type==='sms'){scene.append(bubble('MIA · SMS EXAMPLE','Alex, your appointment is saved for Tue Oct 13, 2 PM with Jordan. Your $40 deposit is pending.'),bubble('NEXT STEP','A deposit link is sent through your configured payment provider.'),element('p','Illustration only. No text or payment is sent.','scene-status'));}
  if(item.type==='team'){scene.append(row('Client','Alex Rivera'),row('Stylist / time','Jordan · Oct 13, 2 PM'),row('Booking source','AI voice'),row('Appointment','Saved'),row('Deposit','$40 · Pending'));}
}
document.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>renderStep(Number(button.dataset.step))));
document.querySelector('#next-step').addEventListener('click',()=>renderStep((currentStep+1)%steps.length));
renderStep(0);
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
  } finally {button.disabled=false;button.textContent='Request my demo ↗'}
});
fetch('/api/public-config').then(r=>{if(!r.ok)throw new Error('Unavailable');return r.json()}).then(config=>{if(!config.intakeEnabled){$('#intake-unavailable').hidden=false;form.hidden=true}}).catch(()=>{$('#intake-unavailable').hidden=false;form.hidden=true});
