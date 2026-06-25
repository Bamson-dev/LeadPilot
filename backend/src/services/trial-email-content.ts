export const TRIAL_STEP_HOURS_FROM_SIGNUP: Record<number, number> = {
  1: 0,
  2: 24,
  3: 48,
  4: 72,
  5: 96,
  6: 120,
  7: 144,
  8: 168,
  9: 192,
  10: 216,
};

export const TRIAL_EMAIL_SUBJECTS: Record<number, string> = {
  1: "Your 2 free searches are ready",
  2: "Did you run your first search?",
  3: "She closed a client in her first week",
  4: "You have used your free searches. Here is what comes next.",
  5: "The real reason you have not upgraded yet",
  6: "What 5 star reviews actually say",
  7: "6 slots left. This is not a marketing line.",
  8: "Can I ask you one question?",
  9: "The math that makes this a no-brainer",
  10: "Last email. I mean it.",
};

export function getTrialEmailBody(step: number): string {
  const bodies: Record<number, string> = {
    1: `
<h1>You are in. Go find your first clients.</h1>
<p>I am Bamidele, the person who built LeadThur.</p>
<p>You just unlocked 2 free searches. No card. No catch. I want you to see exactly what this does before you decide anything.</p>
<p>Here is what to do right now. Go to your dashboard, type any business type, type any city in the world, and hit search. Watch what happens in the next 60 seconds.</p>
<div class="highlight">Try something specific. "Salons in London." "Restaurants in Dubai." "Law firms in Nairobi." The more specific the city, the more useful the results.</div>
<p>I built LeadThur because I was spending 3 hours every morning just trying to find businesses to pitch. By the time I had 20 contacts my whole morning was gone. This fixes that. I want you to feel that difference yourself.</p>
<a href="https://leadthur.com/freetrial" class="btn">Run my first search now →</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur<br><span style="color:#a1a1aa;font-size:13px">Reply to this email if you need anything. I read every message.</span></div>`,

    2: `
<h1>What did you find?</h1>
<p>Yesterday you signed up for a free trial on LeadThur. I am curious, did you get a chance to run a search?</p>
<p>If you did, you already know. Watching 1,000+ businesses load onto your screen with direct phone numbers and emails in under 60 seconds is a different feeling from anything else out there.</p>
<p>If you have not tried it yet, I want to be honest with you about something.</p>
<p>Most people who sign up for a free trial and do not use it within 24 hours never come back. Not because the product does not work. Because life gets in the way and the tab gets closed.</p>
<p>Do not let that happen. You signed up for a reason. You need clients. LeadThur can get you in front of 1,000 of them in the time it takes to drink a cup of tea.</p>
<a href="https://leadthur.com/freetrial" class="btn">Run my search right now →</a>
<a href="https://paystack.shop/pay/Leadthur" class="btn-ghost">Get lifetime access — ₦25,000 once →</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    3: `
<h1>This came in on WhatsApp last week.</h1>
<p>I do not share testimonials much because most of them sound fake. But this one I want you to read because it is exactly the kind of thing I built LeadThur for.</p>
<p>One of our users, a freelancer who does social media management, signed up and ran her first search on a Tuesday. By Friday she had sent pitches to 40 businesses from her LeadThur list. By the following Tuesday she had closed her first client from that list. A beauty spa that had a 3.2 star rating on Google and was clearly losing customers.</p>
<div class="highlight">"I used to spend hours every day just trying to find businesses to contact. LeadThur changed everything. I found my client in the first search." — WhatsApp message from a LeadThur user</div>
<p>That 3.2 star rating was her opening. She reached out and told them she could help fix their online reputation. They said yes the same day.</p>
<p>LeadThur shows you the Google rating of every business in your search results. The ones with low ratings are your warmest leads. They are already losing customers and they know it. That is your opening.</p>
<p>You have 2 free searches. Use one to find businesses like that in your city or any city in the world.</p>
<a href="https://leadthur.com/freetrial" class="btn">Find my first warm lead →</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    4: `
<h1>You have seen what LeadThur can do.</h1>
<p>Your 2 free searches showed you exactly what LeadThur returns. Real businesses. Real phone numbers. Real emails. Real Google ratings. In 60 seconds.</p>
<p>The question now is simple. How many more businesses do you want to pitch?</p>
<p>With lifetime access you get unlimited searches. Any business. Any city. 195 countries. Export everything to a spreadsheet in one click and start pitching the same day.</p>
<div class="highlight">
  <strong style="color:#09090b;display:block;margin-bottom:8px">What you get for ₦25,000 once:</strong>
  Unlimited searches in 195 countries<br>
  1,000+ businesses per search<br>
  Direct phone numbers, emails, websites<br>
  Google ratings to find easy pitches<br>
  One-click CSV export<br>
  All future updates included<br>
  Zero monthly fees. Ever.
</div>
<p>One client from your first search pays for LeadThur 10 times over. That is not a marketing line. That is just the math.</p>
<a href="https://paystack.shop/pay/Leadthur" class="btn">Get lifetime access — ₦25,000 once →</a>
<a href="https://leadthur.com/freetrial" class="btn-ghost">Run another search first →</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    5: `
<h1>I want to ask you something directly.</h1>
<p>You signed up for the free trial a few days ago. You have not upgraded yet. I am not going to pretend I do not notice that.</p>
<p>In my experience there are usually three reasons someone does not upgrade after a free trial.</p>
<p><strong style="color:#09090b">One. They tried it and it did not work for their city.</strong> If that is you, reply to this email right now and tell me which city you searched. I will personally check what the results look like and help you find the right search that works.</p>
<p><strong style="color:#09090b">Two. The price feels like a risk.</strong> I understand that. ₦25,000 is real money. But consider this. You are not buying software. You are buying a list of 1,000+ businesses to pitch every single time you search. If one of them becomes a client and pays you even ₦30,000, you have already made your money back. And you can do that search again tomorrow. And the day after.</p>
<p><strong style="color:#09090b">Three. It is just not the right time.</strong> That is fine. But the lifetime deal closes when the remaining slots run out. After that it moves to a yearly plan. The people who waited and paid yearly will pay more in the first year alone than you would pay today for lifetime access.</p>
<a href="https://paystack.shop/pay/Leadthur" class="btn">Get lifetime access — ₦25,000 once →</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur<br><span style="color:#a1a1aa;font-size:13px">Genuinely, reply to this if something is not working. I will fix it.</span></div>`,

    6: `
<h1>People leave reviews when something surprises them.</h1>
<p>Nobody goes to Trustpilot to leave a review for something average. They go when something genuinely changed how they work.</p>
<p>LeadThur has a 5 star rating on Trustpilot. I am not going to paste the reviews here and ask you to trust me. I want you to go read them yourself.</p>
<p>What you will notice is that almost every review mentions the same two things. How fast the results come back. And how different it feels to have a real list of businesses to pitch instead of spending the morning on Google.</p>
<div class="highlight">The most common thing people say after their first search is that they wish they had found LeadThur sooner. Not because the product is complicated. Because the problem it solves is one they have been living with for months or years.</div>
<p>You have been living with it too. That is why you signed up.</p>
<a href="https://paystack.shop/pay/Leadthur" class="btn">Get lifetime access — ₦25,000 once →</a>
<a href="https://leadthur.com/freetrial" class="btn-ghost">Read the Trustpilot reviews first →</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    7: `
<h1>I want to be straight with you about something.</h1>
<p>We opened 20 lifetime slots at ₦25,000. 14 have been taken. 6 are left.</p>
<p>I know every product says "limited slots" and it means nothing. So let me tell you exactly what happens when these 6 are gone.</p>
<p>LeadThur moves to a yearly plan. The price goes up permanently. People who get in today pay once and never again. People who wait pay every single year.</p>
<p>I am not adding a countdown timer. I am not sending you fake urgency emails every hour. I am just telling you the truth because you deserve to know before the decision is made for you by someone else taking the last slot.</p>
<div class="highlight">₦25,000 once vs ₦100,000 every year. That is the only choice on the table right now.</div>
<p>If you are going to upgrade, today is the day to do it.</p>
<a href="https://paystack.shop/pay/Leadthur" class="btn">Claim one of the 6 remaining slots →</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    8: `
<h1>What would change if you had 1,000 businesses to pitch tomorrow?</h1>
<p>Genuinely think about that for a second.</p>
<p>Not 10. Not 50. One thousand businesses with direct phone numbers, emails, and websites. In any city you choose. In 60 seconds.</p>
<p>How many pitches would you send? How many would reply? How many would turn into clients?</p>
<p>I built LeadThur because I asked myself that exact question. I was spending my mornings searching for businesses one by one and I knew there had to be a better way. There was. And now you have it sitting right in front of you.</p>
<p>The free trial showed you two searches worth of results. Lifetime access gives you unlimited searches. The same tool. No limits. No monthly fees. Just a one-time payment and a list of businesses to pitch every single day for the rest of your career.</p>
<a href="https://paystack.shop/pay/Leadthur" class="btn">Get lifetime access — ₦25,000 once →</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur<br><span style="color:#a1a1aa;font-size:13px">This is email 8 of 10. Two more coming if you need them.</span></div>`,

    9: `
<h1>Let me show you the numbers.</h1>
<p>I want to break down exactly what ₦25,000 means in the context of what you actually do for a living.</p>
<p>If you are a web designer and you charge ₦150,000 for a website, you need one client from LeadThur to make back 6x your investment.</p>
<p>If you do social media management at ₦50,000 a month, one client covers LeadThur twice over in the first month alone.</p>
<p>If you do cold email outreach and your average deal is ₦200,000, one close pays for LeadThur 8 times over.</p>
<div class="highlight">The question is not whether ₦25,000 is worth it. The question is how fast you will make it back. Based on what most people charge for their services, the answer is usually the first client.</div>
<p>And after that first client, every search is pure profit. You paid once. The tool keeps working. The clients keep coming.</p>
<a href="https://paystack.shop/pay/Leadthur" class="btn">Make my investment back with the first client →</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur</div>`,

    10: `
<h1>This is the last email I am sending you.</h1>
<p>I have sent you 9 emails over the past 9 days. I am not going to send a 10th. I do not believe in flooding your inbox.</p>
<p>I just want to leave you with one thought.</p>
<p>Every morning you spend searching for clients manually is a morning you could have spent pitching them. The searching is the part that kills momentum. It is the reason most freelancers and agency owners never reach the level of clients they are capable of serving.</p>
<p>LeadThur removes that part completely. You wake up, run one search, have 1,000 businesses to pitch before breakfast, and spend the rest of your morning actually selling.</p>
<p>If you decide to upgrade, the link is below. Lifetime access. One payment. No monthly fees. No renewal. Yours forever.</p>
<p>If you decide not to, I hope you find another way to solve the problem. Genuinely.</p>
<p>Either way, good luck. I mean that.</p>
<a href="https://paystack.shop/pay/Leadthur" class="btn">Get lifetime access — ₦25,000 once →</a>
<div class="sig"><strong>Bamidele</strong>Founder, LeadThur<br><span style="color:#a1a1aa;font-size:13px">This is my last email to you. No more after this one.</span></div>`,
  };

  const body = bodies[step];
  if (!body) throw new Error(`Invalid trial email step: ${step}`);
  return body.trim();
}
