import { emailButton, emailParagraph, emailSignature } from "./email-template";

export const TRIAL_SEQUENCE_VERSION_V3 = 3;
export const TRIAL_SEQUENCE_MAX_STEP_V3 = 30;
export const TRIAL_POST_SEARCH_TRACKING_STEP = 100;

/**
 * Day offsets from signup (hours).
 * Email 2 is 5 hours after Email 1 on day 0.
 * Emails 29 and 30 are both day 45; Email 30 is 5 hours after Email 29.
 */
export const V3_TRIAL_STEP_HOURS_FROM_SIGNUP: Record<number, number> = {
  1: 0,
  2: 5,
  3: 24,
  4: 48,
  5: 72,
  6: 96,
  7: 120,
  8: 144,
  9: 192,
  10: 240,
  11: 288,
  12: 336,
  13: 384,
  14: 432,
  15: 480,
  16: 528,
  17: 576,
  18: 624,
  19: 672,
  20: 720,
  21: 768,
  22: 816,
  23: 864,
  24: 912,
  25: 960,
  26: 1008,
  27: 1032,
  28: 1056,
  29: 1080,
  30: 1085,
};

export const V3_TRIAL_EMAIL_SUBJECTS: Record<number, string> = {
  1: "You're In. Now Please Read This.",
  2: "What 393 Real Businesses Actually Looks Like",
  3: "Why Are They Eating And You Are Not?",
  4: "The Part Everyone Skips",
  5: "Does This Even Work For What I Do?",
  6: "Your Next Client Isn't Near You",
  7: "What If It Doesn't Work For Me?",
  8: "Here Is Everything You Actually Get For $25",
  9: "Six Slots Left. Then It Goes To $100 A Year.",
  10: "You Don't Have To Write The Email Yourself",
  11: "Hours On Google Vs 60 Seconds. Pick One.",
  12: "Stop Trying To Remember Who You Emailed",
  13: "Nobody Paid These People To Say This",
  14: "What Does $25 Actually Cost You?",
  15: "Why We Never Send To A Guessed Email",
  16: "Somebody Just Claimed A Slot. There Are Fewer Now.",
  17: "Who Actually Opened Your Email?",
  18: "What Is Actually Stopping You?",
  19: "This Sequence Is Coming To An End",
  20: "Somebody Landed A Client While You Were Reading This",
  21: "You Do Not Need Fiverr Anymore",
  22: "Your Slot Might Already Be Gone",
  23: "A Real Question From A Real User This Week",
  24: "One Client From This Pays For A Decade Of Other Tools",
  25: "This Sequence Is Almost Over",
  26: "Look At Your Bank Account Right Now",
  27: "Nigerian Freelancers, This One Is For You",
  28: "Two Days Left In This Sequence",
  29: "Final Reminder Before This Ends",
  30: "This Is The Last Email",
};

export const TRIAL_POST_SEARCH_EMAIL_SUBJECT =
  "You Searched. You Haven't Sent Anything Yet.";

const CHECKOUT = emailButton(
  "Get Lifetime Access for $25",
  "https://paystack.shop/pay/Leadthur"
);
const SIG = emailSignature();

function paras(lines: string[]): string {
  return lines.map((line) => emailParagraph(line)).join("");
}

function bodyWithLink(lines: string[], linkLabel: string, href: string): string {
  return `${paras(lines)}${emailButton(linkLabel, href)}${CHECKOUT}${SIG}`;
}

/**
 * Map an old-sequence progress step onto v3.
 * Returns the sequence_step to store (last "virtually received"), so the next
 * email sent is the proportional target. Completed sequences map to 30.
 *
 * Examples (oldMax=15): step 1 → store 1 (next=2); step 8 → store 15 (next=16); step 15 → 30.
 */
export function mapOldSequenceStepToV3(oldStep: number, oldMax: number): number {
  const step = Math.max(0, Math.floor(oldStep));
  const max = Math.max(1, Math.floor(oldMax));
  if (step >= max) return TRIAL_SEQUENCE_MAX_STEP_V3;
  const targetEmail = Math.floor((step / max) * TRIAL_SEQUENCE_MAX_STEP_V3);
  if (targetEmail <= 0) return 0;
  return targetEmail - 1;
}

export function getV3TrialEmailBody(step: number): string {
  const bodies: Record<number, string> = {
    1: bodyWithLink(
      [
        "Welcome to LeadThur. Before I say anything else, I want you to actually use this software, because most people who sign up for tools like this never open them again. Do not be one of them.",
        "Here is exactly what you need to do in the next 10 minutes. Go to your dashboard. Type any business type you have ever wanted a client from. Type any city on earth. Hit search. In about 60 seconds you will be looking at real businesses with real phone numbers and real email addresses.",
        "That is your first search. That is the whole first step.",
        "I am not going to keep bothering you with a big welcome sequence about features and tutorials. This tool is simple. You already know how to use it. What matters is whether you actually do.",
        "Please go run your first search right now while you are still thinking about it.",
      ],
      "Run My First Search",
      "https://leadthur.com/dashboard"
    ),

    2: bodyWithLink(
      [
        "Somebody on LeadThur last week searched restaurants in São Paulo. Got 393 real businesses back. Phone numbers, verified emails, websites, ratings. Everything.",
        "Another one searched hotels in Accra Ghana. Got 67. Not a huge market, but 67 hotels who have never heard of him, sitting on his screen, ready to be pitched. He pitched 40 of them. Got a reply the next morning. Closed his first client that week.",
        "I am not telling you this to impress you. I am telling you because you still have two free searches sitting there completely untouched, and the version of this that runs on your niche in your target city is what actually decides if this works for you.",
        "Please go run one. Any business type. Any city. See what your version of that list looks like before you decide anything else.",
      ],
      "Show Me My List",
      "https://leadthur.com/dashboard"
    ),

    3: bodyWithLink(
      [
        "There is somebody with worse work than you posting client wins on Instagram right now. You know exactly who I am talking about.",
        "Their designs are cleaner in the mockup than in the final delivery. Their copy would embarrass you if you had to defend it. And they are booked to next quarter while your calendar is looking at you like it has questions.",
        "Here is the truth nobody has told you yet. That person is not better than you at the work. They just have a list. They open their laptop on Monday morning. They pull up 100 businesses in some city. They email 40 of them before lunch. By Friday they have closed one or two. Then they do it again the next Monday.",
        "They are not more talented than you. They are not luckier than you. They just have the list. That is the whole gap.",
        "You have two free searches sitting in your account right now. That is the beginning of your list. Please go build it.",
      ],
      "Go Build My List",
      "https://leadthur.com/dashboard"
    ),

    4: bodyWithLink(
      [
        "Everybody who signs up for LeadThur focuses on the search part. Which makes sense, because the search is what looks impressive on video.",
        "But the search is only half of what this actually is. The other half is that LeadThur also writes the email for you, and sends it from your own inbox.",
        "Let me explain why that matters more than it sounds. Every other tool sells you a list, then sends you off to a second tool to email it, then a third to track opens, then a fourth to do follow ups. Four bills every month. Four dashboards. Four passwords to remember. That is not running a business, that is managing an outreach stack.",
        "LeadThur does all four in the same screen for one payment you make once. You find them, you write to them, you send to them, you follow up with them. From one place. Never a second subscription. Never a second bill.",
        'That is what "built in email sender" really means. And it is the part I would pay for even if the search part was worse than it is.',
        "Have you claimed your slot yet? There are still a few left at $25.",
      ],
      "See The Offer",
      "https://pdigitalhq.com/lp/"
    ),

    5: bodyWithLink(
      [
        'I got asked this question three times this week. "Does LeadThur actually work for my specific niche?"',
        "Web designer. Copywriter. Social media manager. SEO specialist. Consultant. Sales rep. Agency owner. Virtual assistant. Video editor. Bookkeeper. Accountant. Anyone selling any service to any business. If that is you, LeadThur finds businesses that need exactly what you sell.",
        'Here is why it works across every one of those. You are not searching for "people who might want something someday." You type your service and a specific city, and what comes back is businesses in that city filtered by whatever type commonly needs what you sell. Sell websites? Search restaurants, salons, dentists, law firms, anyone whose website is either broken or nonexistent. Sell social media? Search local businesses whose Instagram has three posts from 2019.',
        "You pick your niche. You pick your target. LeadThur brings them to you.",
        "Your two free searches are still sitting there. Please run one on exactly what you sell. See for yourself if I am telling you the truth.",
      ],
      "Test It On My Niche",
      "https://leadthur.com/freetrial"
    ),

    6: bodyWithLink(
      [
        "Something most people miss about LeadThur. It is not limited to your street. Or your city. Or your country.",
        "195 countries covered. That is not a marketing number, that is the actual search coverage. You can pull hotels in Dubai from your kitchen table in Lagos. You can find dentists in Manchester from your bedroom in Nairobi. You can pitch law firms in Toronto without owning a passport.",
        "Why does this matter to you specifically? Because those businesses pay in pounds and dollars. Most of them will never meet you in person. They will only see the work you send them and the invoice they pay. That is all they care about.",
        "Charging in your local currency for local clients is one business model. Charging in dollars for foreign clients while sitting exactly where you are right now is a completely different one. LeadThur is the second one.",
        "Two free searches. Please try one on a city three time zones away from where you live. See what comes back.",
      ],
      "Search A Foreign City",
      "https://leadthur.com/freetrial"
    ),

    7: bodyWithLink(
      [
        "Sitting behind every hesitation is the same question. What if I pay and it does not work for me?",
        "I want to answer that directly, because I would rather you decide with the real answer in front of you than sit wondering.",
        "If you buy lifetime access and LeadThur does not work for you, here is exactly what happens. You email us within 30 days. You show us you actually used it, real searches, real pitches sent. We send you back twice what you paid. Not a refund. Double. $50 back to your account for the $25 you spent.",
        "Then you keep every lead you already exported. Not deleted, not taken back. Still yours.",
        "That is not marketing copy. That is a real promise I am personally making to you in this email, and I honor it every single time it comes up. The risk sits on me, not on you. Which means the only question left is whether you actually want to try it.",
        "Your two free searches are still there. Or if you have already decided, claim the slot.",
      ],
      "Claim My Lifetime Access",
      "https://paystack.shop/pay/Leadthur"
    ),

    8: bodyWithLink(
      [
        "Let me lay out exactly what lifetime access includes, in full. Because everybody skips this part and then buys anyway, and I want you to buy with your eyes open.",
        "Over 1,000 potential clients per search. Forever. Not a monthly reset, not a limit that renews. Forever means forever.",
        "Direct phone numbers and verified email addresses on every result. The email sender built into the same dashboard. Unlimited CSV export of every search you run. The AI outreach writer. Done for you pitch templates by service. Open tracking. Automatic follow ups. Full search history. 195 countries. Every feature we build after today, included at no extra charge, forever.",
        "If you priced most of those individually against other tools, half of them alone run $50 to $60 a year each. All of them together, once, no renewal, is $25.",
        "That number is not a discount. That is what we charge for lifetime access right now, before the slots close.",
      ],
      "See Full Offer",
      "https://leadthur.com/"
    ),

    9: bodyWithLink(
      [
        "Quick note. There are 20 lifetime slots at $25. Six of them remain as of this morning.",
        "I am telling you the real number because I would rather you know than find out later that it is gone. When the last one goes, the price becomes $100 per year for everyone after. Every year. Not just the first year. Every year, forever, for anyone who did not act in time.",
        "If you have not run your two free searches yet, please run them today. See what comes back. Then decide whether to claim the slot while the number is still $25.",
      ],
      "Claim Before They Close",
      "https://paystack.shop/pay/Leadthur"
    ),

    10: bodyWithLink(
      [
        "One thing stops most people from ever starting cold outreach. The blank email screen. You know you should send something, but you do not know what to say, and every draft you start sounds either too corporate or too desperate, and eventually you close the tab and tell yourself you will figure it out tomorrow. Then tomorrow becomes next week.",
        "LeadThur removes that entirely. You describe what you sell in one sentence. The AI drafts an email for each business, opening with something specific to that business, closing with a clear ask. You can change any word if you want. Most people never do.",
        "Picture your actual afternoon with this. You select 40 leads from your last search. The AI writes 40 pitches in about 20 seconds. You skim them. Hit send. Go make coffee. By the time the coffee is ready, someone has opened it. By the time you finish drinking it, someone has replied. That is not marketing. That is what this loop actually looks like.",
        "Please go try it while your slot is still open at $25.",
      ],
      "Watch The Demo",
      "https://pdigitalhq.com/nl"
    ),

    11: bodyWithLink(
      [
        "Let me walk you through two versions of the same afternoon. Because seeing them side by side makes the difference obvious in a way a feature list never can.",
        'Version one. The way most people still hunt for clients. You open Google. You search "web designers near restaurants" or whatever your version is. You scroll through pages of irrelevant results. You click into a business website hoping there is a contact form. You fill it out. You hear nothing back for a week. Maybe forever. You do this for two or three businesses before giving up, exhausted, having contacted maybe three people in a whole afternoon.',
        "Version two. You open LeadThur. You type your service and a city. Sixty seconds later you have 40 real businesses with phone numbers and verified emails. You send outreach to all 40 from the same dashboard, with the AI writing every pitch. That entire process, start to finish, takes less time than version one took to find three businesses.",
        "You have already lived version one long enough to know exactly how it feels. Try version two while it is still free.",
      ],
      "Try Version Two",
      "https://leadthur.com/freetrial"
    ),

    12: bodyWithLink(
      [
        "Here is a problem nobody talks about when they talk about outreach. Sending the first email is actually the easy part. The hard part is remembering, three days later, which of the 40 people you contacted actually deserve a follow up, and then finding the time to write and send that follow up before it becomes five days late and feels awkward.",
        "LeadThur handles this by letting you set your follow up timing once. Then it keeps the thread moving on its own while you focus on the actual work you get paid for.",
        "No spreadsheet tracking who you emailed and when. No mental math about whether it has been three days or five. It runs in the background while you sleep.",
        "I think this is quietly the biggest difference over a month. Week one, everyone is motivated. Week three, most people let follow ups slip. That is where this keeps working when you would have stopped.",
        "Have you claimed your slot yet? Six left as of this morning.",
      ],
      "Claim My Slot",
      "https://pdigitalhq.com/lp/"
    ),

    13: bodyWithLink(
      [
        "I want to show you something instead of telling you something.",
        "There are real WhatsApp screenshots on our sales page from people who landed clients using LeadThur. They sent us these messages without us asking. We did not pay them, we did not incentivize them, they just sent them because something worked for them and they wanted to tell somebody.",
        "There are also real Trustpilot reviews. Trustpilot is a platform where we genuinely cannot edit or remove what somebody wrote. So whatever they said, they said, and it is still up there.",
        "I am not going to tell you what any of them said. Because it matters more coming from someone who has no reason to say it except that it happened to them.",
        "Please go look at what they actually wrote before you take my word for any of it.",
      ],
      "See Real Reviews",
      "https://leadthur.com/"
    ),

    14: bodyWithLink(
      [
        "Let me do some very simple math with you. The kind you could double check in about 10 seconds.",
        "If you land one client through LeadThur, at whatever your normal rate is for the work you do, and compare that against a one time payment of $25, the $25 essentially disappears. It is not a meaningful cost against even a modest first invoice, let alone a client you keep for months.",
        "Most people who use this seriously end up closing their first client in the same week they buy. Because the searching and the outreach both happen so quickly that there is very little time between deciding to try and actually having a conversation with a real business owner.",
        "I am not asking you to spend money you are unsure about. I am asking you to look at what one client is worth to you. Then look at the number $25 again. Notice how far apart those two numbers actually are.",
      ],
      "Claim My Access",
      "https://paystack.shop/pay/Leadthur"
    ),

    15: bodyWithLink(
      [
        "I want to explain a decision we made early on that matters more than it sounds like.",
        'A lot of tools that claim to find business emails are actually guessing them. They generate something like "info@thebusinessname.com" and hope it exists. When you email a guessed address that does not exist, it bounces. Repeated bounces damage your sending reputation. The same reputation that determines whether your future emails, including ones to real prospects, land in an inbox or get flagged as spam.',
        "LeadThur only sends to verified addresses, pulled directly from the business's own website and checked before anything goes out. This means occasionally a business will not have a findable email, and we would rather show you nothing there than show you a guess that hurts you later.",
        "I wanted you to understand this was a deliberate tradeoff, not a limitation we are apologizing for. Protecting your ability to send emails that actually land matters more to us than inflating a number on a results page.",
      ],
      "See How It Works",
      "https://pdigitalhq.com/nl"
    ),

    16: bodyWithLink(
      [
        "Slots are moving. As of this email, we are down to a smaller number than we were on Monday.",
        "I am not going to give you a fake countdown timer or a fake urgency claim. When the last slot goes, this becomes $100 per year for everyone who did not act. Not next year. Every year. Forever, for anyone who was too late.",
        "If you have already run your two free searches and seen the list come back, you know what is possible. This is the moment where the number under this offer still says $25.",
      ],
      "Claim My Slot Now",
      "https://paystack.shop/pay/Leadthur"
    ),

    17: bodyWithLink(
      [
        "One of the most useful things people overlook when they start using LeadThur is the open tracking.",
        "Every email you send through the platform shows you whether it got opened. Which sounds small until you are looking at 40 sent emails and wondering where to spend your follow up energy.",
        "Instead of treating every contact equally, you can see exactly who opened your pitch and who has not touched it yet. Your second message goes to the person who read your first one and is worth a nudge, rather than getting spread across everyone including people who never opened it.",
        "Small feature. Changes how you spend your time. And your time is usually the thing you run out of first.",
      ],
      "Try It Free",
      "https://leadthur.com/freetrial"
    ),

    18: bodyWithLink(
      [
        "At this point in this sequence, I think you have seen most of what there is to see.",
        "You have seen what lifetime access includes. You have seen the double your money back guarantee and what it actually covers. You have seen real people, unprompted, saying it worked for them. If you ran your free searches, you have seen your own real results with your own eyes.",
        "So I want to ask you honestly. What is actually stopping you? Not the marketing version of the objection. The real one sitting underneath.",
        "Is it that you are not sure you will follow through and actually use it? Is it that $25 feels like a decision you keep meaning to make later? Whatever it is, I would rather you name it to yourself than keep scrolling past these emails without ever actually deciding either way.",
        "The version of you who acts on this today is a different person than the one who did not.",
      ],
      "I'm Ready",
      "https://leadthur.com/"
    ),

    19: bodyWithLink(
      [
        "You are past the halfway point of these emails now. There are a limited number left after this one.",
        "I want to be honest that once these emails end, and once the slots close, $25 does not come back as a future promotion. It becomes $100 a year from that point forward.",
        "Picture two versions of you a month from now. One version acted today. Already ran real searches. Sent real outreach. Sitting somewhere in the middle of a conversation with a potential client who might become a real one. The other version is still occasionally opening these emails, still meaning to try it, still exactly where they are right now.",
        "Neither version is being judged harshly by me. I just want you to actually pick which one you would rather be, because right now you are choosing by not choosing.",
      ],
      "Claim My Access",
      "https://paystack.shop/pay/Leadthur"
    ),

    20: bodyWithLink(
      [
        "Real message we received last week from a LeadThur user. Paraphrased so I do not share personal details.",
        '"Ran my first search on Sunday night. Sent 20 emails Monday morning before work. Got a reply by lunch. Had a call Tuesday. Signed the contract Wednesday. This is the fastest client I have ever closed in my career."',
        "Not every user has that speed. Some take longer. Some take faster. But every single one of them started with the same first step, which is running a search.",
        "You still have not run yours.",
        "Please just go do it. Two free searches. No card. Nothing to cancel. Type your niche, type a city, look at what comes back.",
      ],
      "Run My Search",
      "https://leadthur.com/freetrial"
    ),

    21: bodyWithLink(
      [
        "Fiverr takes 20% of every dollar you earn. Every single time you close a client, the platform reaches in and takes a fifth of it. You did the pitch, you did the work, you delivered on time, and they still keep 20%.",
        "The reason freelancers stay on Fiverr and Upwork is that finding clients directly used to be hard. It required hours of Google searching, guessing at email addresses, hoping for a reply, writing pitches from scratch. Fiverr was easier even though it cost you money.",
        "LeadThur is what makes finding clients directly easier than Fiverr. Type a business type, type a city, get real businesses back with real emails in 60 seconds. Then send the pitch from the same dashboard. Keep 100% of what you earn. Nobody bidding under you.",
        "You are still paying Fiverr 20%. There is no reason to.",
      ],
      "Stop Paying The Platform",
      "https://leadthur.com/"
    ),

    22: bodyWithLink(
      [
        "I hate sending these urgency emails. But the number of lifetime slots at $25 keeps dropping, and I owe it to you to keep you informed rather than let you find out the hard way.",
        "If you have been meaning to claim your slot, please go check right now whether it is still available. I do not know exactly how many are left as I write this. I know it is fewer than it was last week. The counter on the sales page shows the real current number.",
        "When the last one goes, it becomes $100 a year. Every year. Forever. No exceptions.",
      ],
      "Check If My Slot Is Still Available",
      "https://paystack.shop/pay/Leadthur"
    ),

    23: bodyWithLink(
      [
        "Somebody emailed us this week and asked the exact question you might be asking yourself right now.",
        '"I have never done cold outreach before. Am I going to figure this out or am I about to waste $25?"',
        "Here is what I told her. This tool is not built for people who are experts at outreach. It is built specifically for people who have never done it before. You do not have to know how to write cold emails, the AI does that. You do not have to know how to find business emails, LeadThur finds them. You do not have to know what a \"lead\" is, you just have to type a business and a city.",
        "She bought the same day. Ran her first search that night. Sent her first pitch the next morning. That is the entire barrier, and it does not exist here.",
        "If any part of you has been holding back because you think you are not the kind of person who does this, you are exactly the kind of person this is built for.",
      ],
      "This Was Built For Me",
      "https://pdigitalhq.com/lp/"
    ),

    24: bodyWithLink(
      [
        "Let me put $25 in perspective.",
        "Most SaaS tools that do a fraction of what LeadThur does charge $30 to $80 per month. A lead scraper alone is often $60 a month. An email sender with follow ups, another $30. A CRM to track it all, another $50. That is $140 a month, or $1,680 a year, for what LeadThur does in one dashboard.",
        "If you buy lifetime access at $25, and you use it for 10 years, that comes out to $2.50 per year. Not per month. Per year. And you get every new feature we build in that decade at no additional cost.",
        "I am not telling you this to convince you the number is small. You already know the number is small. I am telling you so you understand why this offer will not exist much longer. Nobody sells this pricing at scale. We are doing it now because we are still building trust in the market, and every one of you who buys becomes proof for the next hundred people.",
        "Please claim your slot before the number changes.",
      ],
      "Claim My Slot",
      "https://paystack.shop/pay/Leadthur"
    ),

    25: bodyWithLink(
      [
        "You are 40 days into these emails. There are a handful left. I want to be honest about what happens when they end.",
        "When this sequence ends, you will not hear from me about LeadThur again unless you sign up. No more emails, no more reminders, no more chances to grab a slot at $25 before it becomes $100 a year.",
        "I know some people need multiple reminders, and I know some people need silence. Both are fine. But if you have been sitting on the fence, this is a real signpost that the fence is about to disappear.",
      ],
      "Get Off The Fence",
      "https://leadthur.com/"
    ),

    26: bodyWithLink(
      [
        "Look at your bank account. Really look at it. What is the last invoice you sent?",
        "If it was two weeks ago, three weeks ago, longer, that gap is what LeadThur closes. It is not a magic bullet. It is a list. But that list is what stops the gap from happening.",
        "Every day you delay this is another day the gap stays open. Every day the gap stays open is another day you tell yourself the situation is normal, when it does not have to be.",
        "Please stop delaying this. $25 once, and the gap starts closing this week.",
      ],
      "Close The Gap",
      "https://pdigitalhq.com/lp/"
    ),

    27: bodyWithLink(
      [
        "If you are reading this from Nigeria, I want to talk to you directly for a second.",
        "You already know that the local freelance market has ceilings. A logo design in Lagos is worth ₦30,000. The same logo, sold to a small business owner in Manchester, is worth £150. Same design, same skill, three times the money, once you charge in a currency that is not naira.",
        "LeadThur is how you reach those clients. Not through a platform that takes a cut. Not through Instagram DMs that get ignored. Directly, through their real email, with a pitch the AI writes for you.",
        "I built this software from Lagos because I lived this frustration for years before I figured it out. You do not have to figure it out. Just use the tool.",
      ],
      "Reach Foreign Clients",
      "https://leadthur.com/"
    ),

    28: bodyWithLink(
      [
        "Two more emails after this one. Then this sequence ends.",
        "I want to make sure I have said everything I need to say to you. So let me be direct.",
        "LeadThur works. Not for everyone, but for people who actually use it. The people who log in, run a search, send some pitches, and follow up. The ones who treat it as a business tool instead of a lottery ticket.",
        "If you are willing to be that person, this software will pay for itself many times over before your next monthly bill hits. If you are not, no software will help you.",
        "I think you can be that person. I think that is why you are still reading these emails 44 days later. I think you have been waiting for a sign that this is real. This email is that sign.",
      ],
      "I Am Ready",
      "https://leadthur.com/"
    ),

    29: bodyWithLink(
      [
        "One more email after this. Then I go quiet.",
        "The offer is still $25 for lifetime access. Slots are still being claimed. I do not know exactly how many are left as you read this, but I know the number is smaller than yesterday.",
        "If you have been meaning to do this, please do it now. Not tomorrow. Now. Because tomorrow you will forget, and next week you will remember, and by then something will have changed.",
      ],
      "Claim Before It's Gone",
      "https://paystack.shop/pay/Leadthur"
    ),

    30: bodyWithLink(
      [
        "This is the last email in this sequence. If LeadThur is not for you, that is completely fine. You will not hear from me about this again after today.",
        "If some part of you has been meaning to try it this whole time, your two free searches are still there if you never used them, and the $25 lifetime offer is still standing right now as I write this.",
        "I am not going to push you again after this. This is simply the last time I ask before I stop asking.",
        "Whatever you decide, I appreciate that you read this far. That says something about you.",
      ],
      "Claim My Access One Last Time",
      "https://leadthur.com/"
    ),
  };

  const body = bodies[step];
  if (!body) throw new Error(`Invalid v3 trial email step: ${step}`);
  return body.trim();
}

export function getTrialPostSearchEmailBody(query: string, location: string): string {
  return `
${paras([
  `You ran a search for ${query} in ${location} a few hours ago. LeadThur pulled real businesses back with real phone numbers and real email addresses. They are sitting in your dashboard right now.`,
  "You have not sent a single email to any of them.",
  "Here is what nobody tells you about a list like this. It does not stay yours forever. Somebody else, doing the same work you do, in the same city, is going to run a search that overlaps with yours this week. If they email those businesses before you do, the businesses will remember them, not you.",
  "You already did the hard part. You searched. You got the list. The only thing left is opening the dashboard and hitting send. Please go do it before the list goes cold.",
])}${emailButton("Go To My Dashboard", "https://leadthur.com/dashboard")}${CHECKOUT}${SIG}`.trim();
}
