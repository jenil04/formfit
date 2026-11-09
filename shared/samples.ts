/**
 * Two fictional sample forms, pasted the way they look when copied from a
 * real application page: labels, limits, required markers, dropdown hints.
 * Organisations here are invented.
 */
export interface SampleForm {
  id: string;
  name: string;
  blurb: string;
  text: string;
}

export const SAMPLE_FORMS: SampleForm[] = [
  {
    id: "lumen-accelerator",
    name: "Lumen Accelerator, Spring Cohort",
    blurb: "15 fields · limits from 140 to 500 chars · 5 only you can answer",
    text: `Lumen Accelerator — Spring Cohort Application
Applications close March 14. All fields marked * are required.

Company name *

Describe your company in one sentence. (max 140 characters) *

What problem are you solving, and for whom?
Be specific about the customer and what they do today instead.
Max 500 characters
Required

Describe your traction to date. *
(300 characters max)

Who is on your founding team?
Names, roles and relevant background. 400 chars

Why now? *
What changed in the world that makes this possible today? (max 300 characters)

What is your current monthly recurring revenue (USD)?

How do you plan to use the program's resources and funding?
Limit: 500 characters

What is your tech stack? (up to 200 characters)

Link to your product demo or website *

Primary contact email *

Founder phone number *
Include country code.

Current stage *
Select one
Idea
Prototype
Pilot with customers
Generating revenue

How much funding are you seeking?
e.g. amount and terms you would accept

Founder date of birth (required for program records)

I agree to the Lumen Accelerator terms and conditions *

Submit
`,
  },
  {
    id: "northwind-builders",
    name: "Northwind Open Builders Grant",
    blurb: "Online hackathon + grant · word and char limits · KYC, payout, tax",
    text: `Northwind Open Builders Grant — Online Hackathon
Build something useful in 3 weeks. Winners receive grants.

1. Project name *

2. Tagline (80 characters max) *

3. What does your project do? *
Explain it like we have 30 seconds. 1000 characters max.

4. What problem inspired you to build this? (max 600 characters)

5. What makes your approach different from existing tools? (100 words max)

6. Technologies used (max 150 characters)

7. Demo video URL *
Loom, YouTube or similar.

8. GitHub repository URL *

9. Team members and roles
(max 300 characters)

10. What's next on your roadmap? (max 400 characters)

11. Payout wallet address (for grant payment) *
USDC on Base or Ethereum

12. Government ID or passport number (required for prize KYC)

13. Shipping address for winner swag

14. Tax ID (EIN, PAN or equivalent) *

15. Team contact email *

16. I confirm this project was built during the hackathon period and I agree to the rules *
`,
  },
];
