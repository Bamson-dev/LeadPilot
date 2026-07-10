import { C, FONT } from "./theme";

const PARAGRAPHS = [
  "You have watched somebody with half your skill post a client win and felt something turn in your stomach. Their design is worse than yours. Their ads would embarrass you. And they are booked to next quarter while your calendar has room in it this Thursday.",
  "That person is not waiting to be found. They have a list of businesses in front of them, they know each one has a broken website or a dead social page, and they email fifty of them before lunch. Some ignore it. Some say no. Two say yes, and two is all it takes.",
  "Their list is not limited to the street they live on either. A dentist in Manchester, a law firm in Toronto, a hotel in Dubai. Those businesses pay in pounds and dollars, they never meet their designer in person, and they care about the work rather than the country it came from. Your work is good.",
  "You cannot reach any of them, because you do not have a list. You have Google, a contact form that goes nowhere, an Instagram message the owner never opens, and an Upwork account that keeps twenty percent of the money you finally manage to earn.",
  "Every business you needed was published online the whole time, in every city in the world. Phone number, email address, website, rating. You simply had no way to pull all of them into one place until now.",
];

export function ProblemAgitationSection() {
  return (
    <section
      style={{
        backgroundColor: C.bgSecondary,
        padding: "72px 24px",
        fontFamily: FONT,
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 13,
            fontWeight: 700,
            color: C.purpleLight,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Read this part slowly
        </p>
        <h2
          style={{
            fontSize: "clamp(26px, 4vw, 36px)",
            fontWeight: 900,
            color: C.text,
            margin: "0 0 28px",
            letterSpacing: -0.5,
            lineHeight: 1.2,
          }}
        >
          You already know your work is good. So why are they eating and you are not?
        </h2>
        {PARAGRAPHS.map((paragraph) => (
          <p
            key={paragraph.slice(0, 40)}
            style={{
              fontSize: 16,
              color: C.muted,
              lineHeight: 1.7,
              margin: "0 0 20px",
            }}
          >
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}
