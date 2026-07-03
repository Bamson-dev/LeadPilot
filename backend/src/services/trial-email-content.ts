import { emailButton, emailSignature } from "./email-template";

export const TRIAL_STEP_HOURS_FROM_SIGNUP: Record<number, number> = {
  1: 0,
  2: 24,
  3: 48,
  4: 72,
  5: 96,
  6: 120,
  7: 144,
  8: 168,
  9: 216,
  10: 264,
  11: 288,
  12: 312,
  13: 336,
  14: 348,
  15: 360,
};

export const TRIAL_EMAIL_SUBJECTS: Record<number, string> = {
  1: "You are 60 seconds from your first client list",
  2: "You have not run your first search yet",
  3: "She landed a client in six days with one search",
  4: "What a full client pipeline actually looks like",
  5: "The three reasons people hesitate (and what to do)",
  6: "Finding clients is the bottleneck, not your skill",
  7: "What users say after they stop hunting manually",
  8: "One week in: what do you want next month to look like?",
  9: "One closed client pays for lifetime access many times over",
  10: "Why consistent outreach beats random effort",
  11: "Picture your pipeline full tomorrow morning",
  12: "The lifetime deal is moving to a yearly plan",
  13: "Can I ask you something direct?",
  14: "The price changes tomorrow",
  15: "My last message to you",
};

const CTA = emailButton("Go to LeadThur", "https://leadthur.com");
const SIG = emailSignature();

export function getTrialEmailBody(step: number): string {
  const bodies: Record<number, string> = {
    1: `
<h1>Your first list of potential clients is one search away</h1>
<p>You signed up for LeadThur because you need more clients. The fastest way to see what this does is to run your first search right now.</p>
<p>Choose any business type and any city in the world. LeadThur returns 1,000+ businesses with direct contact details — phone numbers, websites, and addresses you can use today.</p>
<div class="highlight">Most people get their first list in under 60 seconds. That is enough potential clients to start pitching this afternoon.</div>
<p>Open LeadThur, run one search, and see exactly what you get before you decide anything.</p>
${CTA}
${SIG}`,

    2: `
<h1>You have not run your first search yet</h1>
<p>I noticed you signed up but have not searched yet. That usually means life got busy — but the trial only helps if you use it.</p>
<p>One search shows you how many potential clients exist in your target city, with contact details included. You do not need a perfect niche. Pick a business type you serve and a city you want to work in.</p>
<div class="highlight">You are one search away from a list you can contact today. The trial costs you nothing except a minute of your time.</div>
<p>Run your first search now while this is still top of mind.</p>
${CTA}
${SIG}`,

    3: `
<h1>She landed a client in six days with one search</h1>
<p>A freelancer used LeadThur to find a low-rated spa in her city. She sent a short pitch offering to improve their online presence. They replied the same week and signed.</p>
<p>She did not get lucky. She started with businesses that already had a visible problem and direct contact details on her list. That is the advantage of searching with intent instead of cold guessing.</p>
<div class="highlight">One search gave her enough qualified leads to start conversations that week. You can do the same in your market.</div>
<p>Run a search in a city you want to serve and pick the businesses that look like the easiest first win.</p>
${CTA}
${SIG}`,

    4: `
<h1>What a full client pipeline actually looks like</h1>
<p>The best feeling in freelancing is not just getting paid. It is knowing where your next three clients are coming from before you need them.</p>
<p>LeadThur gives you that visibility. Search any city, get 1,000+ potential clients with contact details, and build a pipeline you control instead of waiting on referrals.</p>
<div class="highlight">No more dry months. No more starting from zero every time work slows down. You generate opportunities on demand.</div>
<p>If you want steady income, you need a steady list of people to pitch. This is how you build it.</p>
${CTA}
<p class="meta" style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#666666;">See how others use LeadThur on <a href="https://www.instagram.com/leadthur" style="color:#7C3AED;text-decoration:underline;">Instagram</a> and on X at <a href="https://x.com/LeadThur" style="color:#7C3AED;text-decoration:underline;">@LeadThur</a>.</p>
${SIG}`,

    5: `
<h1>The three reasons people hesitate</h1>
<p>When someone does not upgrade after a trial, it is usually one of three things: price, trust, or timing. All three are fair concerns.</p>
<p>You might wonder if this works in your city, if businesses will respond, or if now is the right time to spend on tools. Those are reasonable questions.</p>
<div class="highlight">LeadThur is a one-time payment for lifetime access — not a monthly subscription. One closed client typically covers the cost many times over.</div>
<p>If something is unclear, reply to this email and tell me directly. I read every message.</p>
${CTA}
${SIG}`,

    6: `
<h1>Finding clients is the bottleneck, not your skill</h1>
<p>Your work is not the problem. The gap is volume — you do not have enough potential clients to talk to each week.</p>
<p>Freelancers who stay booked are not always more talented. They are better at keeping a full pipeline. When outreach is random, income feels unpredictable.</p>
<div class="highlight">LeadThur fixes the pipeline side. You search any city, get 1,000+ businesses with contact details, and choose who to pitch.</div>
<p>Your skill deserves a steady flow of conversations. This is how you create that flow.</p>
${CTA}
${SIG}`,

    7: `
<h1>What users say after they stop hunting manually</h1>
<p>The feedback we hear most often is simple: they stop wasting hours on Google and start each week with a list of potential clients ready to contact.</p>
<p>That shift changes confidence quickly. You are no longer guessing where the next opportunity will come from. You generate one when you need it.</p>
<div class="highlight">When your list is ready, outreach feels lighter and closing becomes more likely. That is what a real client pipeline does.</div>
<p>See if this fits how you want to work — one search, one city, one thousand potential clients.</p>
${CTA}
${SIG}`,

    8: `
<h1>One week in: an honest question</h1>
<p>You have had a full week to see what LeadThur can do. So what do you want the next month to look like?</p>
<p>You can keep hunting manually and hoping referrals show up. Or you can search any city on demand, export contact details, and build momentum yourself.</p>
<div class="highlight">This is not really a software decision. It is a decision about whether you want predictable pipeline or unpredictable income.</div>
<p>If you want the second path, now is a good time to commit to it.</p>
${CTA}
${SIG}`,

    9: `
<h1>One closed client covers lifetime access many times over</h1>
<p>Think about what one project from one client pays you. For most freelancers — design, marketing, copy, ads, consulting — that single deal is worth far more than a one-time LeadThur payment.</p>
<p>Lifetime access means no monthly fee eating into your margin. You pay once, search any city, and keep building pipeline for as long as you run your business.</p>
<div class="highlight">After your first close, every additional client you win through LeadThur is pure upside. That is why I think of this as a pipeline asset, not a tool expense.</div>
<p>Run the math for your own service. One client is usually enough to make this an obvious yes.</p>
${CTA}
${SIG}`,

    10: `
<h1>Why consistent outreach beats random effort</h1>
<p>Booked freelancers have one thing struggling freelancers lack: a repeatable system for finding potential clients every week.</p>
<p>Without that system, every month starts from zero. Stress rises when work ends because there is no list waiting for you.</p>
<div class="highlight">With a system, pipeline stays warm. You search a city, export contact details, pitch consistently, and income becomes more predictable.</div>
<p>LeadThur exists to give you that system without adding complexity to your day.</p>
${CTA}
${SIG}`,

    11: `
<h1>Picture your pipeline full tomorrow morning</h1>
<p>Imagine opening your laptop and seeing 1,000 potential clients in the exact city you want to target — with phone numbers, websites, and addresses ready to use.</p>
<p>How different would this month feel if you started each day from that position instead of from uncertainty?</p>
<div class="highlight">That kind of visibility gives you options. Options lead to more conversations, more closes, and calmer income.</div>
<p>This is the daily reality LeadThur is built to create. One search. Any city. Direct contact details included.</p>
${CTA}
<p class="meta" style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#666666;">See real examples on <a href="https://www.instagram.com/leadthur" style="color:#7C3AED;text-decoration:underline;">Instagram</a> and on X at <a href="https://x.com/LeadThur" style="color:#7C3AED;text-decoration:underline;">@LeadThur</a>.</p>
${SIG}`,

    12: `
<h1>The lifetime deal is moving to a yearly plan</h1>
<p>I want to be direct with you: the current lifetime access option is closing. After that, the same access moves to yearly pricing.</p>
<p>I am not saying this to create panic. I am saying it so you can decide with clear information before the change.</p>
<div class="highlight">Pay once and own it forever, or wait and pay every year. That is the real choice in front of you right now.</div>
<p>If LeadThur is helping you build pipeline, this is the best window to lock in lifetime access.</p>
${CTA}
${SIG}`,

    13: `
<h1>Can I ask you something direct?</h1>
<p>You signed up because you wanted more clients and steadier income. What is still holding you back?</p>
<p>If there is a concern about your market, your niche, or whether this fits your workflow, tell me. I will respond personally.</p>
<div class="highlight">I built LeadThur because finding clients was the hardest part of freelancing. I want you to win with it if it is the right fit for you.</div>
<p>Reply and let me know what you are thinking. I am listening.</p>
${CTA}
${SIG}`,

    14: `
<h1>The price changes tomorrow</h1>
<p>By this time tomorrow, the current lifetime price window will be gone. After that, access moves to yearly billing.</p>
<p>I am not writing this to pressure you. I am writing so you can make a confident decision before pricing changes.</p>
<div class="highlight">If you plan to use LeadThur to stay fully booked, this is your cleanest chance to lock in lifetime value with a one-time payment.</div>
<p>You know your goals. Choose the path that supports them.</p>
${CTA}
${SIG}`,

    15: `
<h1>My last message to you</h1>
<p>This is my final email in this sequence. I want to leave you with respect and clarity.</p>
<p>Every week you spend hunting for potential clients manually is a week you could spend closing and earning. LeadThur gives you 1,000+ businesses per search, in any city, with contact details included — for a one-time payment.</p>
<div class="highlight">If you want in, the link is below. If not, I genuinely wish you steady work and great clients.</div>
<p>Thank you for reading these emails.</p>
${CTA}
${SIG}`,
  };

  const body = bodies[step];
  if (!body) throw new Error(`Invalid trial email step: ${step}`);
  return body.trim();
}
