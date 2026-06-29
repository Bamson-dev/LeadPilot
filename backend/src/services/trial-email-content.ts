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
  1: "Your free trial is live. Go get your first client.",
  2: "Did you find your first potential client yet?",
  3: "She closed a client in her first week",
  4: "This is what your pipeline could look like.",
  5: "The real reason you are still hesitating.",
  6: "Talented people stay broke for one reason.",
  7: "What people are saying after they switched.",
  8: "Your first week is almost up.",
  9: "One client. That is all it takes.",
  10: "The freelancers who win do this one thing.",
  11: "Imagine waking up to 1,000 clients to pitch.",
  12: "The lifetime deal is closing.",
  13: "A quick and honest question.",
  14: "Tomorrow this offer changes.",
  15: "Last email from me.",
};

export function getTrialEmailBody(step: number): string {
  const bodies: Record<number, string> = {
    1: `
<h1>Your free trial is live. Go get your first client.</h1>
<p>Hi, I am Bamidele, the founder of LeadThur.</p>
<p>You just unlocked your free searches, and I want you to run your first one right now while this email is still open.</p>
<p>Search the type of potential client you want, choose your city, and click search. In about 60 seconds you will have a list of real potential clients you can reach out to today.</p>
<div class="highlight">You are not here to collect business data. You are here to close clients and get paid. LeadThur helps you start that process immediately.</div>
<a href="https://leadthur.com" class="btn">Run my first search</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    2: `
<h1>Did you find your first potential client yet?</h1>
<p>Yesterday you started your free trial, so I wanted to check in personally.</p>
<p>Most people who do not run a search in the first day never come back. It is not because the tool does not work. It is because life gets busy and they postpone the one action that can change their pipeline.</p>
<p>You signed up because you need clients, and this is the fastest way to find them. Take one minute now and run a search before the day gets away from you.</p>
<a href="https://leadthur.com" class="btn">Find potential clients now</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    3: `
<h1>She closed a client in her first week.</h1>
<p>A freelancer in our community ran her first LeadThur search and found a beauty spa with a low Google rating. She pitched them, showed them what to improve, and closed them within a week.</p>
<p>The lesson is simple. Low rated businesses already know they have a problem, so they are often easier to close than businesses that think everything is fine.</p>
<p>When you search inside LeadThur, you are not looking at random records. You are looking at potential clients with clear signals you can use in your outreach.</p>
<a href="https://leadthur.com" class="btn">Find my first easy to close client</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    4: `
<h1>This is what your pipeline could look like.</h1>
<p>Imagine opening your laptop and never wondering where your next client will come from.</p>
<p>With full LeadThur access, you can pull potential clients in any city, see the details you need to reach out, and build a steady pipeline instead of waiting for referrals to save the month.</p>
<div class="highlight">
  <strong style="color:#09090b;display:block;margin-bottom:8px">What this unlocks for you:</strong>
  Unlimited potential client searches<br>
  Any city whenever you need fresh leads<br>
  Contact details ready for outreach<br>
  Fast export so your team can pitch same day<br>
  No more dry spells between projects
</div>
<a href="https://leadthur.com" class="btn">Build my client pipeline</a>
<p style="margin-top:14px;font-size:13px;color:#71717a">You can also follow us on <a href="https://www.instagram.com/leadthur" style="color:#7c3aed">Instagram</a> and on Twitter at LeadThur to see real people landing clients with this every day.</p>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    5: `
<h1>The real reason you are still hesitating.</h1>
<p>If you have not upgraded yet, it usually comes down to three honest reasons.</p>
<p><strong style="color:#09090b">Price.</strong> I understand that every naira matters. But one closed client can pay for LeadThur many times over.</p>
<p><strong style="color:#09090b">Trust.</strong> You might still be wondering if this can work for your niche or city. That is a fair question.</p>
<p><strong style="color:#09090b">Timing.</strong> You may feel like you should wait until things are calmer before you commit.</p>
<p>If something is not working for your city, reply to this email and I will help you directly. A real human will answer you.</p>
<a href="https://leadthur.com" class="btn">See how people are using LeadThur</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    6: `
<h1>Talented people stay broke for one reason.</h1>
<p>Your challenge is not talent. Your challenge is pipeline.</p>
<p>The freelancers who stay booked are not always better than you. They are usually just speaking to more potential clients every week, so they have more chances to close work.</p>
<p>LeadThur fixes that numbers problem. Instead of spending hours hunting for who to pitch, you spend your time pitching and closing.</p>
<a href="https://leadthur.com" class="btn">Fix my pipeline this week</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    7: `
<h1>What people are saying after they switched.</h1>
<p>If you read our Trustpilot reviews, the same thing comes up again and again.</p>
<p>People say they finally stopped wasting hours on Google and started each day with a real list of potential clients to pitch.</p>
<p>Speed matters, but confidence matters too. It is easier to send outreach when you know exactly who you are contacting and why they are a fit.</p>
<a href="https://leadthur.com" class="btn">Read reviews and get started</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    8: `
<h1>Your first week is almost up.</h1>
<p>You have now seen what LeadThur does in real use, not in a sales video.</p>
<p>So this decision is simple. Do you want another month of hunting for clients manually, or do you want potential clients on demand whenever you need to fill your pipeline?</p>
<p>You are already good at your work. What changes your income is how many opportunities you can create each week.</p>
<a href="https://leadthur.com" class="btn">Choose the faster path to clients</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    9: `
<h1>One client. That is all it takes.</h1>
<p>Let us do the real math.</p>
<p>One web design client can cover the cost easily. One social media retainer can cover it. One copywriting project can cover it.</p>
<div class="highlight">If one closed client can pay for lifetime access many times over, every client after that is pure profit.</div>
<p>This is why LeadThur is not an expense. It is a client acquisition asset you can use every week.</p>
<a href="https://leadthur.com" class="btn">Make the numbers work for me</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    10: `
<h1>The freelancers who win do this one thing.</h1>
<p>They build a repeatable system to find potential clients every week.</p>
<p>That is the difference between feast and famine freelancing. With a system, you build momentum. Without one, you keep starting from zero.</p>
<p>LeadThur is built to be that system for you, so client flow does not depend on luck.</p>
<a href="https://leadthur.com" class="btn">Build my repeatable client system</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    11: `
<h1>Imagine waking up to 1,000 clients to pitch.</h1>
<p>Picture tomorrow morning. You open your laptop and you already have a thousand potential clients ready, with phone numbers and emails, in any city you choose.</p>
<p>What would that change for your month? How much calmer would your work feel if you were choosing opportunities instead of chasing them?</p>
<p>That is what LeadThur is designed to give you consistently.</p>
<a href="https://leadthur.com" class="btn">Get access to 1,000 potential clients</a>
<p style="margin-top:14px;font-size:13px;color:#71717a">If you want to see real people landing clients with this every day, follow us on <a href="https://www.instagram.com/leadthur" style="color:#7c3aed">Instagram</a> and on Twitter at LeadThur.</p>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    12: `
<h1>The lifetime deal is closing.</h1>
<p>I want to be transparent with you.</p>
<p>The lifetime slots are running out, and after that the offer moves to a yearly plan. You can pay once and own it forever, or wait and pay every year.</p>
<p>I am not sending fake countdowns. I am simply making sure you know before the change happens.</p>
<a href="https://leadthur.com" class="btn">Lock in lifetime access</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    13: `
<h1>A quick and honest question.</h1>
<p>You signed up for a reason, and that reason was not software. It was getting more clients and creating steady income.</p>
<p>What is holding you back from upgrading right now?</p>
<p>If you reply and tell me, I will answer personally. No assistant, no template, just me trying to help you move forward.</p>
<a href="https://leadthur.com" class="btn">I am ready to move forward</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    14: `
<h1>Tomorrow this offer changes.</h1>
<p>This is your last clear window to lock in the current lifetime price.</p>
<p>I am not trying to pressure you. I just want you to decide with full information before it moves to yearly pricing.</p>
<p>If you know LeadThur can help you close more clients, this is the right time to secure it.</p>
<a href="https://leadthur.com" class="btn">Lock in my lifetime access today</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    15: `
<h1>Last email from me.</h1>
<p>I have shared everything I can to help you make a clear decision, and I will not keep flooding your inbox.</p>
<p>I will leave you with one thought. Every week spent hunting for clients is a week you could have spent closing them.</p>
<p>If you want in, the link is below. If now is not the time, I genuinely wish you success and steady work.</p>
<a href="https://leadthur.com" class="btn">Join LeadThur</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,
  };

  const body = bodies[step];
  if (!body) throw new Error(`Invalid trial email step: ${step}`);
  return body.trim();
}
