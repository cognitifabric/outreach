// Versioned consent evidence for The Salon Agent's own demo/support messages.
// Recording permission here does not send a message or bypass carrier approval.
const SMS_CONSENT_VERSION='tsa-demo-support-2026-10-15';
const SMS_CONSENT_TEXT='I agree to receive non-marketing text messages from The Salon Agent, a service operated by Rapid Clean Solutions LLC, at the number provided about my demo request, demo appointment updates and service questions. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Consent is not a condition of purchase.';
function consentEvidence(body,phone){
  if(body.smsConsent!==undefined && typeof body.smsConsent!=='boolean')return null;
  if(body.smsConsent!==true)return {granted:false};
  const digits=phone.replace(/\D/g,'');
  const normalized=digits.length===10?'+1'+digits:digits.length===11 && digits.startsWith('1')?'+'+digits:'';
  if(!/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(normalized) || body.smsConsentVersion!==SMS_CONSENT_VERSION)return null;
  return {granted:true,phone:normalized,recordedAt:new Date().toISOString(),version:SMS_CONSENT_VERSION,text:SMS_CONSENT_TEXT,method:'optional_website_checkbox',pagePath:'/#contact',program:'The Salon Agent demo and customer support'};
}
module.exports={SMS_CONSENT_VERSION,SMS_CONSENT_TEXT,consentEvidence};
