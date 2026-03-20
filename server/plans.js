// server/plans.js
const PLANS = {
  free: {
    export_excel: false,
    ai_insights: false,
    ai_chat: false,
    alerts: false,
    full_history: false,
  },
  starter: {
    export_excel: true,
    ai_insights: true,
    ai_chat: false,
    alerts: false,
    full_history: true,
  },
  pro: {
    export_excel: true,
    ai_insights: true,
    ai_chat: true,
    alerts: true,
    full_history: true,
  },
};

function isTrialActive(ent) {
  if (!ent || !ent.trial_ends_at) return false;
  return new Date(ent.trial_ends_at).getTime() > Date.now();
}

function hasFeature(ent, feature) {
  const plan = (ent && ent.plan) || "free";
  const planMap = PLANS[plan] || PLANS.free;
  return !!planMap[feature] || isTrialActive(ent);
}

module.exports = { PLANS, hasFeature, isTrialActive };
