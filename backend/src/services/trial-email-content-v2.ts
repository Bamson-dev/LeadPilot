import { emailButton, emailParagraph, emailSignature } from "./email-template";

export const TRIAL_SEQUENCE_VERSION_V2 = 2;
export const TRIAL_SEQUENCE_MAX_STEP_V2 = 20;
export const TRIAL_POST_SEARCH_TRACKING_STEP = 100;

/** Day 0 email 2 is sent several hours after email 1 on the same day. */
export const V2_TRIAL_STEP_HOURS_FROM_SIGNUP: Record<number, number> = {
  1: 0,
  2: 6,
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
  16: 552,
  17: 624,
  18: 696,
  19: 792,
  20: 888,
};

export const V2_TRIAL_EMAIL_SUBJECTS: Record<number, string> = {
  1: "your 2 searches are ready",
  2: "what 393 real leads looks like",
  3: "why are they booked and you are not",
  4: "the part everyone skips",
  5: "does this even work for what I do",
  6: "your client does not live near you",
  7: "what happens if it does not work",
  8: "here is everything you get for $25",
  9: "6 of 20 left",
  10: "you do not have to write the email",
  11: "the hard way versus the 60 second way",
  12: "stop remembering who you emailed",
  13: "nobody paid these people to say this",
  14: "what does $25 actually cost you",
  15: "why we never email a guessed address",
  16: "who actually opened your email",
  17: "another slot just went",
  18: "what is actually stopping you",
  19: "this closes soon",
  20: "last one, then we go quiet",
};

export const TRIAL_POST_SEARCH_EMAIL_SUBJECT = "are you going to email them or not";

const CHECKOUT = emailButton("Get Lifetime Access for $25", "https://leadthur.com/checkout");
const SIG = emailSignature();

function paras(lines: string[]): string {
  return lines.map((line) => emailParagraph(line)).join("");
}

function bodyWithLink(lines: string[], linkLabel: string, href: string): string {
  return `${paras(lines)}${emailButton(linkLabel, href)}${CHECKOUT}${SIG}`;
}

export function getV2TrialEmailBody(step: number): string {
  const bodies: Record<number, string> = {
    1: bodyWithLink(
      [
        "Hi, welcome to LeadThur. Before I explain anything else, I want you to actually use this, so here is exactly what to do. Go to your dashboard, type in a business type and a city, anywhere in the world, and hit search. That is genuinely the entire first step.",
        "Here is what happens next. In about 60 seconds, real businesses start appearing on your screen, not placeholder text, not a sample dataset, actual businesses with actual phone numbers, verified email addresses, their website, their Google rating. Say you type dentists and your city. A minute later you are looking at thirty, forty real dental practices you did not have a way to find this morning.",
        "That is your free trial. Two full searches, no card required, no catch. Most people who sign up never actually run the first search, and that one decision is the entire difference between someone who finds a client next week and someone who forgot they signed up for something. Do not be the second person. Go run your first search right now.",
      ],
      "Run your first search",
      "https://leadthur.com/freetrial"
    ),

    2: bodyWithLink(
      [
        "I want to show you something before you run your own first search, because I think it will change how you think about what is possible here. A user on LeadThur searched restaurants in São Paulo a while back and got 393 real businesses back. Not 393 as a marketing number, 393 as an actual result on their screen, each one with a phone number and a working website attached. Another user searched hotels in Accra Ghana and pulled 67.",
        "Think about what that actually means for a second. That is not a list you build over a week of Googling one business at a time. That is one search box, one business type, one city, and a result that would normally take someone days to assemble by hand, sitting in front of them in under a minute.",
        "You still have two free searches waiting, completely untouched. Nobody has looked at your city yet through this. I would genuinely rather you find out what your own numbers look like than keep reading examples about other people's. Go look first, then decide what you think.",
      ],
      "Run your free search",
      "https://leadthur.com/freetrial"
    ),

    3: bodyWithLink(
      [
        "I want to ask you something honestly. Have you ever watched someone with clearly less skill than you post about landing a client, and felt something twist in your stomach because you knew, you actually knew, your work was better than theirs? I have talked to a lot of people who do the kind of work you do, and almost everyone says yes immediately when I ask this.",
        "Here is what I have noticed about the people who stay consistently booked. It is almost never talent. It is that they have a list of businesses sitting in front of them, and they email that list every single week, whether they feel like it or not. Some of those emails get ignored. Some get a flat no. But a few say yes, and a few is genuinely all it takes to stay busy.",
        "You are not losing to better work. You are losing to someone who has a list and sends emails and you do not, yet. Your two free searches are still sitting there completely unused. Go build your own list today, and start the habit the people who stay booked already have.",
      ],
      "Start your free search",
      "https://leadthur.com/freetrial"
    ),

    4: bodyWithLink(
      [
        "Most people who hear about LeadThur focus entirely on the search part, finding businesses fast, and honestly, that part alone would be worth using. But I think the more important half is the one people skip past, so I want to slow down and actually explain it.",
        "Once you have your list of potential clients, LeadThur also writes the outreach email for you, using AI that knows what you sell, and sends it directly from your own inbox. That last part matters more than it sounds like. It means when a business replies, that reply lands in your actual email, not in some third party inbox you have to go check separately. You are having a real conversation with a real business owner, using your own name, your own email address.",
        "Picture what your afternoon looks like with this. You find forty potential clients on a lunch break, the AI drafts a pitch for each one specific to that business, you review it, hit send once, and go back to actual work. By the time you check your inbox later, one or two people have already opened it. That entire loop, finding them and reaching them, takes less time than making a cup of coffee. Go see it for yourself.",
      ],
      "See how LeadThur works",
      "https://leadthur.com"
    ),

    5: bodyWithLink(
      [
        "A question I get asked a lot is whether this actually works for a specific type of work, so let me answer it directly instead of dancing around it. Web designer, copywriter, social media manager, consultant, sales rep, agency owner, virtual assistant, if what you do involves selling a service to a business, this finds the businesses that need exactly that service.",
        "Here is why that is true regardless of your niche. You are not searching for people who might be interested in something general. You type your specific service and a specific city, and what comes back is businesses in that city, filtered by whatever type you searched, complete with contact details. If you sell web design, search for restaurants or salons or law firms, whatever type of business commonly has a bad or missing website, and see what comes back.",
        "I would rather you test it on your actual niche than take my word that it works broadly. You have two free searches specifically so you can find that out yourself before spending anything. Go try it on exactly what you do.",
      ],
      "Try it on your niche",
      "https://leadthur.com/freetrial"
    ),

    6: bodyWithLink(
      [
        "Something I think a lot of people miss when they first hear about LeadThur is that it is not limited to your own city at all. A dentist in Manchester. A law firm in Toronto. A hotel in Dubai. Every one of those is searchable in the exact same way, the exact same sixty seconds, as searching your own street.",
        "Here is why that matters more than it might seem at first. Those businesses often pay in pounds or dollars, sometimes for work that would be priced much lower locally where you are. They also frequently never meet their designer, their copywriter, their marketer in person at all, the entire relationship happens over email from the first pitch onward. Distance is not actually a barrier for most of the services people sell to businesses.",
        "Picture invoicing your next client in a currency worth several times what you are used to charging, for work you are already capable of doing today. LeadThur covers 195 countries, so this is not a hypothetical, it is one search box away. Try searching a city you have never even visited and see what comes back.",
      ],
      "Search any city",
      "https://leadthur.com"
    ),

    7: bodyWithLink(
      [
        "I want to address something directly, because I think it is the honest question sitting behind most of the hesitation people have. What if you pay and it just does not work for you.",
        "Here is exactly what happens in that case. Run one search with lifetime access, on your own business type, in your own target city. If LeadThur cannot return real potential clients with real contact details, actual usable phone numbers and email addresses, email our support within 30 days and you get every dollar back. No argument, no runaround, no proving anything beyond saying it did not work for you. You also keep whatever you already exported before asking for the refund.",
        "I am telling you this so plainly because I would rather you know the risk sits on us, not on you, before you decide anything. You are not being asked to trust marketing copy. You are being asked to try it, and if it fails you, we make that free. That is the actual deal.",
      ],
      "See the guarantee",
      "https://leadthur.com"
    ),

    8: bodyWithLink(
      [
        "I want to lay out exactly what lifetime access includes, in full, so there is no guessing about what you are actually paying for. Over 1,000 potential clients per search, and that search allowance is yours forever, not on a monthly reset. Direct phone numbers and verified email addresses on every result. The email sender built directly into your dashboard, so outreach happens without a second tool. Unlimited CSV export, meaning you can download every search you ever run with no cap. The AI outreach writer, drafting your pitches for you. Done for you pitch templates by service, in case you would rather start from something built for your exact niche. Open tracking, so you know who actually read your email. Automatic follow ups, so leads do not go cold from you forgetting to check back in. Full search history saved. Coverage across 195 countries. And every feature we build after today, included at no extra charge, forever.",
        "If you priced most of those individually, several of them alone run fifty to sixty dollars a year from other tools built to do just one of these things. All of it together, once, no renewal, is twenty five dollars. I wanted you to see the actual list before the number, not the other way around.",
      ],
      "See everything included",
      "https://leadthur.com"
    ),

    9: bodyWithLink(
      [
        "I want to tell you something that is genuinely happening right now, not a countdown timer designed to create fake pressure. Lifetime access is priced at twenty five dollars for a limited number of spots, and six of the original twenty remain at that price. Once those are gone, the price becomes one hundred dollars a year for everyone who did not act before then, permanently, not just for a launch window.",
        "I am not going to pretend this is some manufactured urgency trick. It is simply how the pricing was structured from the start, a reward for people who decide early rather than people who wait and see. You already have two free searches sitting there completely untouched, which means you have not even seen what your own results look like yet. That is honestly the part I would fix first. See what LeadThur actually returns for your own business type and city, then make your decision about the twenty five dollars while that price still exists.",
      ],
      "Check your free searches",
      "https://leadthur.com"
    ),

    10: bodyWithLink(
      [
        "One thing I think people underestimate about outreach is how much the blank page stops them before they even start. You find forty potential clients, you feel good about it, and then you sit there trying to figure out what to actually say to a business you have never spoken to. That gap between finding a lead and reaching out to them is where most people quietly give up.",
        "Here is how LeadThur handles that. You describe what you sell once, briefly, and the AI drafts a pitch for each business, referencing something specific about that business rather than sending the same generic message to everyone. You can edit any word of it if something feels off, but most people read it, nod, and hit send exactly as written.",
        "Picture this actually happening. You open your dashboard, select forty leads from your last search, the AI writes a pitch for each one in a few seconds, you glance over them, and you send all forty before your coffee gets cold. That is not a hypothetical workflow, that is what using this looks like on an average afternoon.",
      ],
      "Open your dashboard",
      "https://leadthur.com"
    ),

    11: bodyWithLink(
      [
        "I want to walk you through two different versions of the same afternoon, because I think seeing them side by side makes the difference obvious in a way a bullet list never quite does.",
        "Version one, the way most people still find clients. You open Google, search something like web designers near restaurants, scroll through pages of irrelevant results, click into a business website hoping there is a contact form, fill it out, and hear nothing back for a week, if you hear back at all. You do this for two or three businesses before giving up for the day, exhausted, having contacted maybe three people.",
        "Version two. You open LeadThur, type your service and a city, and sixty seconds later you have forty real businesses with phone numbers and verified emails. You send outreach to all forty from the same dashboard, using an email address written for you. That entire process, start to finish, takes less time than version one took to find three businesses.",
        "You have already lived version one long enough to know exactly how it feels. I would rather you try version two for free and compare it yourself than take my word for which one is faster.",
      ],
      "Try version two free",
      "https://leadthur.com/freetrial"
    ),

    12: bodyWithLink(
      [
        "Here is a problem almost nobody talks about when they talk about outreach. Sending the first email is actually the easy part. The hard part is remembering, three days later, which of the forty people you contacted actually deserve a follow up, and then finding the time to actually write and send that follow up before it becomes five days late and feels awkward to send at all.",
        "LeadThur handles this by letting you set your follow up timing once, and then it keeps the thread moving on its own. No spreadsheet tracking who you emailed and when. No mental math trying to remember if it has been three days or five. It simply runs in the background while you focus on the actual work you get paid for.",
        "I think this is the piece that quietly makes the biggest difference over a month, not week one, because week one everyone is motivated. It is the follow ups in week three that most people let slip, and that is exactly where this keeps working even when you stop thinking about it.",
      ],
      "Set up follow ups",
      "https://leadthur.com"
    ),

    13: bodyWithLink(
      [
        "I want to show you something instead of telling you something. There are real screenshots, unedited, of people messaging us on WhatsApp about landing a client through LeadThur, sent without us asking anyone to say anything nice. There are also real reviews on Trustpilot, a platform where we genuinely cannot edit or remove what someone writes.",
        "I am not going to summarize what any of them said, because I think it means more coming from someone who has no reason to say it except that it happened to them. Go look at what real users actually wrote, in their own words, before you take anything I have said in these emails at face value.",
      ],
      "Read real user reviews",
      "https://leadthur.com"
    ),

    14: bodyWithLink(
      [
        "I want to do some very simple math with you, the kind you could check yourself in about ten seconds. If you land one client through LeadThur, at whatever your normal rate is for the work you do, and compare that against a one time payment of twenty five dollars, the twenty five dollars essentially disappears. It is not a meaningful cost against even a modest first invoice, let alone a client you keep for months.",
        "Most people who use this seriously end up closing their first client in the same week they buy lifetime access, simply because the searching and the outreach both happen so quickly that there is very little time between deciding to try and actually having a conversation with someone.",
        "I am not asking you to spend money you are unsure about. I am asking you to look at what one client is worth to you, then look at the number twenty five again, and notice how far apart those two numbers actually are.",
      ],
      "See lifetime access",
      "https://leadthur.com"
    ),

    15: bodyWithLink(
      [
        "I want to explain a decision we made early on that I think matters more than it sounds like on the surface. A lot of tools that claim to find business emails are actually guessing them, generating something like info at the business name dot com and hoping it exists. When you email a guessed address that does not exist, it bounces, and repeated bounces damage your sending reputation, the same reputation that determines whether your future emails, including ones to real prospects, land in an inbox or get flagged as spam.",
        "LeadThur only sends to verified addresses, pulled directly from the business's own website and checked before anything goes out. This means occasionally a business simply will not have a findable email, and we would rather show you nothing there than show you a guess that hurts you later.",
        "I wanted you to understand this was a deliberate tradeoff, not a limitation we are apologizing for. Protecting your ability to send emails that actually land matters more to us than inflating a number on a results page.",
      ],
      "Learn about verified emails",
      "https://leadthur.com"
    ),

    16: bodyWithLink(
      [
        "One of the more useful things I think people overlook when they start using LeadThur is the open tracking. Every email you send through the platform shows you whether it was actually opened, which sounds small until you are staring at forty sent emails wondering where to spend your follow up energy.",
        "Instead of treating every contact the same, you can see exactly who opened your pitch and who has not touched it yet. That means your second message goes to the person who read your first one and is worth a nudge, rather than getting spread evenly across everyone including people who never even opened the original.",
        "It is a small feature, but it changes how you spend your time after the initial send, and time is usually the thing people run out of first.",
      ],
      "Try open tracking",
      "https://leadthur.com"
    ),

    17: bodyWithLink(
      [
        "I want to keep being straightforward with you about this, since I already told you exactly how the pricing works. The number of lifetime slots remaining at twenty five dollars keeps dropping as people claim them, and once it hits zero, the price becomes one hundred dollars a year, permanently, for anyone who did not get in before then.",
        "You have already run your free searches by this point in most cases, so you already know what the results actually look like for your own business and city, rather than trusting my description of it. This is genuinely the moment where the number under this offer still says twenty five, and I cannot tell you how much longer that stays true.",
      ],
      "Claim lifetime access",
      "https://leadthur.com"
    ),

    18: bodyWithLink(
      [
        "At this point in these emails, I think you have seen most of what there is to see. You have seen exactly what lifetime access includes. You have seen the refund guarantee and what it actually covers. You have seen real people, unprompted, saying it worked for them. If you ran your free searches, you have seen your own real results with your own eyes.",
        "So I want to ask honestly, what is actually stopping you at this point. Not the marketing version of the objection, the real one sitting underneath it. Is it that you are not sure you will follow through and actually use it. Is it that twenty five dollars feels like a decision you keep meaning to make later. Whatever it is, I would rather you name it to yourself than keep scrolling past these emails without ever actually deciding either way.",
      ],
      "Decide today",
      "https://leadthur.com"
    ),

    19: bodyWithLink(
      [
        "I want to be honest that this is genuinely one of the last emails you will get about this specific offer. Once the remaining lifetime slots are gone, twenty five dollars does not come back, not as a future promotion, not as a special deal later. It becomes one hundred dollars a year from that point forward.",
        "I want you to picture two versions of yourself a month from now. One version acted today, has already run real searches, sent real outreach, and is somewhere in the middle of a conversation with a potential client who might become a real one. The other version is still occasionally opening these emails, still meaning to try it, still exactly where they are right now. Neither version is judged harshly by me, I just want you to actually pick which one you would rather be, because right now you are choosing by not choosing.",
      ],
      "Act before slots close",
      "https://leadthur.com"
    ),

    20: bodyWithLink(
      [
        "This is the final email in this sequence, and I meant that honestly, not as a trick to get you to open one more. If LeadThur is not something you end up using, that is completely fine, you will not keep hearing about it from us after this.",
        "If some part of you has been meaning to try it this whole time, your two free searches are still there if you never used them, and the twenty five dollar lifetime offer is still standing for now. I am not going to keep pushing after this message. This is simply the last time I ask before I stop asking.",
      ],
      "Last chance at $25",
      "https://leadthur.com"
    ),
  };

  const body = bodies[step];
  if (!body) throw new Error(`Invalid v2 trial email step: ${step}`);
  return body.trim();
}

export function getTrialPostSearchEmailBody(query: string, location: string): string {
  return `
${paras([
  `You searched ${query} in ${location} a few hours ago. I do not know if you noticed, but LeadThur did not just give you a list, it gave you real businesses with real phone numbers and real email addresses, sitting right there in your dashboard. And as far as I can tell, you have not sent a single email to any of them.`,
  "Here is the thing nobody tells you about a list like this. It does not stay untouched forever. Somebody else, doing the exact same work you do, in the exact same city, is going to run a similar search this week and start emailing. If they get there first, it does not matter that you found the list too, it matters that they acted on it and you did not.",
  "You already did the hard part. You searched, you got real results, you know they are sitting there. The only thing left is opening the dashboard and pressing send. Go do that now, while the list is still fresh and nobody has touched it.",
])}${emailButton("Open your dashboard", "https://leadthur.com/dashboard")}${CHECKOUT}${SIG}`.trim();
}
