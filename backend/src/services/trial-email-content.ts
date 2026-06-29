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
  1: "you are 60 seconds from your first client",
  2: "i noticed something from yesterday",
  3: "she closed a client in 6 days",
  4: "imagine never chasing clients again",
  5: "can i be honest with you?",
  6: "it was never your skill",
  7: "people keep saying the same thing",
  8: "one week in. honest question",
  9: "one client. that is all it takes",
  10: "feast or famine. here is the difference",
  11: "picture tomorrow morning",
  12: "this is going away soon",
  13: "can i ask you something real?",
  14: "tomorrow this changes",
  15: "my last email to you",
};

export function getTrialEmailBody(step: number): string {
  const bodies: Record<number, string> = {
    1: `
<h1>you are 60 seconds from your first client</h1>
<p>If you run one search right now, you can have fresh potential clients to pitch before this minute ends.</p>
<p>Choose your service, choose your city, and let LeadThur do the heavy lifting so you can focus on conversations that make you money.</p>
<div class="highlight">You are already good at what you do. What changes your income is having enough potential clients in front of you every day.</div>
<p>Do not overthink this first step. Open LeadThur and run your first search now.</p>
<a href="https://leadthur.com" class="btn">run my first search</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    2: `
<h1>i noticed something from yesterday</h1>
<p>When someone signs up and does not run a search in the first 24 hours, they usually never come back, even when they still need clients badly.</p>
<p>I do not want that to happen to you because your trial can create momentum today if you use it.</p>
<div class="highlight">You are one focused minute away from a list of potential clients you can contact this afternoon.</div>
<p>Run the search now while this is top of mind and give yourself a real shot at closing work this week.</p>
<a href="https://leadthur.com" class="btn">find potential clients now</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    3: `
<h1>she closed a client in 6 days</h1>
<p>She opened LeadThur, found a low rated spa, sent a short pitch, and closed the deal in under a week.</p>
<p>What worked was not luck. She reached out to potential clients who already felt the pain and were ready to listen.</p>
<div class="highlight">That is the advantage of starting with the right potential clients instead of random cold outreach.</div>
<p>You can do the same today with your next search.</p>
<a href="https://leadthur.com" class="btn">find my first easy win client</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    4: `
<h1>imagine never chasing clients again</h1>
<p>The best feeling in freelancing is not just getting paid. It is waking up with a full pipeline and knowing your month is covered.</p>
<p>LeadThur helps you build that by giving you new potential clients whenever you need them, in any city you choose.</p>
<div class="highlight">No more dry spells. No more guessing where the next client will come from. Just consistent opportunities to pitch and close.</div>
<p>If you want steady income, this is the system that supports it.</p>
<a href="https://leadthur.com" class="btn">build my full pipeline</a>
<p style="margin-top:14px;font-size:13px;color:#71717a">If you want to see real people landing clients with this every day, check us on <a href="https://www.instagram.com/leadthur" style="color:#7c3aed">Instagram</a> and on Twitter at LeadThur.</p>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    5: `
<h1>can i be honest with you?</h1>
<p>If you are hesitating, it is usually about price, trust, or timing, and all three are completely understandable.</p>
<p>You might be wondering if this will work in your city, if now is the right time, or if spending money today is wise.</p>
<div class="highlight">One closed client can change that decision instantly, and that is exactly what this trial is meant to help you do.</div>
<p>If something feels unclear, reply and tell me directly. I will answer you myself.</p>
<a href="https://leadthur.com" class="btn">see how this can work for me</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    6: `
<h1>it was never your skill</h1>
<p>Your struggle is not because you are not good enough. It is because you do not have enough potential clients to talk to every week.</p>
<p>Freelancers who stay booked are often just better at pipeline, not more talented.</p>
<div class="highlight">When pipeline is weak, income feels random. When pipeline is strong, income becomes predictable.</div>
<p>LeadThur helps you fix the pipeline side so your skill can finally pay you consistently.</p>
<a href="https://leadthur.com" class="btn">fix my pipeline now</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    7: `
<h1>people keep saying the same thing</h1>
<p>The common feedback is simple. They stop wasting hours searching and start each day with potential clients ready to pitch.</p>
<p>That shift changes confidence fast because you are no longer guessing where your next opportunity will come from.</p>
<div class="highlight">When your list is ready, outreach feels lighter and closing becomes more likely.</div>
<p>Read what others are saying, then decide if this is the missing piece in your workflow.</p>
<a href="https://leadthur.com" class="btn">see what others experienced</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    8: `
<h1>one week in. honest question</h1>
<p>You have had a full week to see what LeadThur can do, so what do you want the next month to look like?</p>
<p>You can keep hunting manually and hoping referrals come, or you can generate potential clients on demand and create your own momentum.</p>
<div class="highlight">This choice is really about your income stability, not software.</div>
<p>If you want the second path, this is a good time to commit to it.</p>
<a href="https://leadthur.com" class="btn">choose steady pipeline</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    9: `
<h1>one client. that is all it takes</h1>
<p>If one project from one client can pay for access several times over, the decision becomes very clear.</p>
<p>Whether you do design, social media, copy, ads, or consulting, one closed deal can cover this and leave room for profit.</p>
<div class="highlight">After that first close, every extra client you win through LeadThur is upside.</div>
<p>This is why I call it a client pipeline asset, not a tool expense.</p>
<a href="https://leadthur.com" class="btn">run the math for my service</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    10: `
<h1>feast or famine. here is the difference</h1>
<p>Booked freelancers have one thing struggling freelancers do not have, and it is a repeatable system for finding potential clients every week.</p>
<p>Without that system, every month starts from zero and stress keeps rising.</p>
<div class="highlight">With a system, pipeline stays warm and income gets more consistent.</div>
<p>LeadThur exists to give you that system without making your day more complicated.</p>
<a href="https://leadthur.com" class="btn">build my repeatable system</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    11: `
<h1>picture tomorrow morning</h1>
<p>You open your laptop and a thousand potential clients are waiting, with contact details, in the exact city you want to target.</p>
<p>How different would this month feel if you started each day from that position instead of from uncertainty?</p>
<div class="highlight">That kind of visibility gives you options, and options usually lead to more closes and calmer income.</div>
<p>This is the daily reality LeadThur is built to create.</p>
<a href="https://leadthur.com" class="btn">start with 1,000 potential clients</a>
<p style="margin-top:14px;font-size:13px;color:#71717a">Want to see real people landing clients with this every day? Check <a href="https://www.instagram.com/leadthur" style="color:#7c3aed">Instagram</a> and Twitter at LeadThur.</p>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    12: `
<h1>this is going away soon</h1>
<p>The lifetime option is closing, and after that the same access moves to yearly pricing.</p>
<p>I am sharing this plainly so you can decide with clear information instead of finding out after the change.</p>
<div class="highlight">Pay once and own it, or wait and pay every year. That is the real choice now.</div>
<p>If LeadThur is helping you build pipeline, this is the best window to lock it in.</p>
<a href="https://leadthur.com" class="btn">lock in lifetime access</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    13: `
<h1>can i ask you something real?</h1>
<p>You signed up because you wanted more clients and steadier income, so what is still holding you back right now?</p>
<p>If there is a concern, a doubt, or something that did not click for your market, tell me and I will respond personally.</p>
<div class="highlight">This is me asking person to person because I want you to win with this if it is the right fit.</div>
<p>I am listening.</p>
<a href="https://leadthur.com" class="btn">i am ready to move forward</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    14: `
<h1>tomorrow this changes</h1>
<p>By this time tomorrow, the current lifetime price window will be gone.</p>
<p>I am not writing this to create panic. I am writing so you can make a confident decision before pricing moves to yearly.</p>
<div class="highlight">If you plan to use LeadThur to stay fully booked, this is your cleanest chance to lock in value.</div>
<p>You know your goals. Choose the path that supports them.</p>
<a href="https://leadthur.com" class="btn">secure my access today</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    15: `
<h1>my last email to you</h1>
<p>This is my final message in this sequence, and I want to leave you with respect and clarity.</p>
<p>Every week you spend hunting for potential clients is a week you could spend closing and earning.</p>
<div class="highlight">If you want in, the link is here. If not, I genuinely wish you steady work and great clients.</div>
<p>Either way, thank you for reading these emails.</p>
<a href="https://leadthur.com" class="btn">join LeadThur</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,
  };

  const body = bodies[step];
  if (!body) throw new Error(`Invalid trial email step: ${step}`);
  return body.trim();
}
