# AI-native career coaching and career-direction products (late 2026 landscape)

Research date: 2026-11-06. Method note: all findings below come from web search result snippets (approx. 30 searches). Direct page fetches (WebFetch) were blocked in this session for every host tried (heycari.ai, mypassion.ai, toolworthy.ai, getmarlee.com, careervillage.org, weekday.works, kickresume.com, apps.apple.com, reworked.co), so pricing pages, app-store listings and landing pages could NOT be read first-hand. Where a fact rests on an aggregator or a vendor's own copy, that is flagged. Design/UX observations are therefore the weakest part of this dossier and are listed as gaps where unverifiable.

Reference point: our product (The Compass by Purposefields) is a free, account-less, ten-step career-DIRECTION tool with a non-directive Claude "thinking partner", Australian market, localStorage only, no follow-up loop. Comparisons below emphasise the direction/self-discovery segment and the dimensions where we differ (structure, follow-up, pricing, data model, safety).

---

## Key Question 1: Which products focus on career DIRECTION / self-discovery vs job-search EXECUTION? (Product-by-product dossier)

### Takeaway
The market splits into (a) a large, crowded, well-funded "job-search execution" tier (résumé/ATS/tracker suites that have bolted on an "AI career coach" chat: Teal, Careerflow, Kickresume, WonsultingAI, LinkedIn Career Coach, Indeed Career Scout) and (b) a much thinner "direction / self-discovery" tier that is mostly either philanthropically funded (CareerVillage Coach, FutureFit AI via workforce agencies), assessment-led one-off purchases (Pigment, Apt AI, ikigai apps), general-purpose life/leadership coaches (Marlee, Rocky.ai), or B2B enterprise coaches (Valence Nadia, BetterUp Grow, Sapia Phai). Very few consumer products combine guided direction-finding steps with an AI thinking partner; Google Career Dreamer (free, US-only, Labs experiment) and CareerVillage Coach are the closest free analogues to ours.

### Cited Findings

#### Segment map (direction vs execution)
- A 2026 roundup places Coach by CareerVillage as the strongest free pick for "structured exploration", Pigment ($79 assessment) and APT AI as paid self-discovery tools, Cari as an "ongoing career thinking partner", and explicitly says Careerflow is "more accurately described as an AI-assisted job-search suite than a deep career coach" and CareerClimb focuses on promotions/reviews, not direction — [Search summary of heycari.ai / mypassion.ai / pigment.is / careerclimb.app listicles](https://pigment.is/blogs/blogs/best-ai-for-career-advice); [heycari roundup](https://heycari.ai/blog/best-ai-career-coaches-companions-us-2026); [mypassion.ai ranking](https://mypassion.ai/blog/best-ai-career-assessment-tools-2026). (Caveat: all three are vendor blogs ranking themselves highly.)
- Sapia.ai's Phai trial (>1,000 users) found about 63% of users sought help changing career direction, ~43% were mid-career or later, and users more often asked how to describe their experience and find their strengths than which roles fit their CV; "confidence gaps and lack of clarity came up most often" — [CFOtech UK](https://cfotech.co.uk/story/sapia-ai-unveils-phai-an-ai-coach-for-career-change); [OnRec press release](https://www.onrec.com/node/127265). (Vendor-reported.)

#### DIRECTION / SELF-DISCOVERY TIER

**1. Coach by CareerVillage.org (nonprofit, free) — closest free analogue**
- What/launch: launched August 2024 as an AI career tool aimed at underrepresented youth and adults; "first-of-its-kind AI career development tool built for equity and measurable results"; tracks learner progress with the validated CAAS-SF career-readiness survey — [Schultz Family Foundation release](https://schultzfamilyfoundation.org/news-release/coach-launches-first-of-its-kind-ai-career-development-tool-built-for-equity-and-measurable-results); [PR Newswire](https://prnewswire.com/news-releases/careervillage-launches-coach-first-of-its-kind-ai-career-development-tool-built-for-equity-and-measurable-results-302219163.html).
- Scope: helps with résumés/cover letters, interpreting job descriptions, exploring careers, and mock interviews; target "high school students to job seekers"; one directory notes it is "not plugged into live job boards" — [topai.tools listing](https://topai.tools/t/coach-by-careervillage); [Product Hunt](https://test-webhooks.producthunt.com/posts/coach-by-careervillage).
- Positioning: CareerVillage says it is "much more than just an AI chatbot" and that "this tool should not replace career coaching"; pilot study found learners prefer a hybrid of human and AI coaching — [CareerVillage article](https://www.careervillage.org/articles/coach/coach-ai-for-career-readiness/); [CareerVillage update](https://www.careervillage.org/articles/cv-updates/empowering-futures-how-careervillage-orgs-ai-career-coach-revolutionizes-access-to-career-guidance/).
- Funding: Gates Foundation $1,000,000 (Feb 2024, 12 months) to pilot an AI career coach for adults; Elisabeth C. DeLuca Foundation $1,143,646 (2024); GitLab Foundation $100,000 (2024); Schultz Family Foundation part of a >$3M April 2025 initiative that also funds Renaissance Philanthropy to build "key performance benchmarks for AI platforms"; Cisco, Atlassian Foundation, Google.org also named; ServiceNow/Deloitte/GlideFast cash + tech donation — [Gates Foundation grant](https://gatesfoundation.org/about/committed-grants/2024/02/inv-066023); [Grantable 990 data](https://grantable.co/nonprofits/careervillage-inc-morg_f93fb240f3d943cba0c76b193ffef4cf); [HR Tech Feed](https://hrtechfeed.com/new-3m-initiative-to-train-ai-platforms-to-provide-better-career-discovery-and-job-search-results); [Cisco blog](https://blogs.cisco.com/our-corporate-purpose/transforming-career-development-through-ai); [ServiceNow](https://www.servicenow.com/workflow/hr/transforming-career-coaching-ai.html).
- Business model: free to the public via philanthropy; institutions (schools, job-training programs) pay via a cost-sharing model — [TriplePundit](https://triplepundit.com/story/2024/ai-career-coach/811516).
- Traction/reviews: Product Hunt shows a single 5.0 rating; directory pages show "no reviews yet"; no independent hands-on review found — [Product Hunt](https://test-webhooks.producthunt.com/posts/coach-by-careervillage).
- Criticism: commentary argues AI coaching "can not be customized to your needs the way that 1-on-1 coaching naturally is" and is best for "low hanging fruit" like résumé review — [CareerVillage Q&A thread](https://www.careervillage.org/questions/1114596/what-are-the-pros-and-cons-of-careervillage-coach-ai).

**2. Google Career Dreamer (free, experimental, US-only at launch)**
- Launched February 2025 via Grow with Google / Google Labs; user describes background, skills, education, interests and the tool suggests career paths and lets you drill into roles; described as "a career discovery tool, helping users make sense of their experiences and understand how their skills translate across different industries", not a job board; Gemini integration for cover letters/résumés; Google consulted career-navigation organisations while building it; "only available in a test mode in the US" at launch — [TechCrunch](https://techcrunch.com/2025/02/19/googles-career-dreamer-uses-ai-to-help-you-explore-job-possibilities/); [TechRadar](https://www.techradar.com/pro/googles-latest-ai-tool-helps-you-find-your-perfect-job); [ClearanceJobs](https://news.clearancejobs.com/2025/02/20/googles-career-dreamer-uses-ai-to-help-you-map-your-next-job/).
- Advice from coverage: "works best if users are in a place where they are open to reflecting and exploring"; success "will largely depend on the accuracy of its recommendations" — [Success.com](https://www.success.com/?p=84282); [Google AI forum review](https://discuss.ai.google.dev/t/a-review-on-career-dreamer-by-google/122278).
- Related: Google's Interview Warmup (launched 2022) has been discontinued; one vendor blog dates the shutdown to April 2026, another to early 2025 (internally inconsistent); Google pointed users to Gemini Live, Career Dreamer and custom Gemini "Gems" — [FinalRound AI](https://www.finalroundai.com/blog/google-interview-warmup-discontinued-alternatives); [Aceround](https://www.aceround.app/blog/google-interview-warmup-review/). Shutdown date unconfirmed by Google.

**3. Marlee (formerly Fingerprint for Success / F4S; getmarlee.com) — assessment-led AI coach, work-motivation focus**
- Assessment: measures 48 traits that "influence your energy levels and motivation for certain tasks", benchmarked against "a sample of others working in your local culture" — [Marlee FAQ: what does Marlee measure](https://getmarlee.com/faq/what-does-marlee-measure); [Marlee FAQ: motivational analysis](https://getmarlee.com/faq/what-is-the-motivational-analysis).
- Coaching format: 8-week coaching programs; free plan "only takes 10–15 minutes each week"; "Unlimited AI Coaching sessions" on free Starter — [Marlee cost FAQ](https://rc.getmarlee.com/faq/what-does-marlee-cost); [Krowdbase](https://www.krowdbase.com/software/coach-marlee).
- Pricing: Starter free forever (no credit card); Growth listed at $15.99/month by directories; Enterprise via sales — [G2 pricing](https://www.g2.com/products/marlee/pricing); [fitgap](https://us.fitgap.com/products/013548/marlee); [Krowdbase](https://www.krowdbase.com/software/coach-marlee). Competitor Risely estimates ~$2 per coaching conversation vs BetterUp $75–250+/session (self-interested source) — [Risely pricing guide](https://risely.me/compare/pricing-guide/).
- Positioning drift: increasingly team/leadership/enterprise (pages for "leadership", "collaboration software", "enterprise"); several directories file it under team performance rather than career direction — [getmarlee.com/leadership](https://getmarlee.com/leadership); [getmarlee.com/industry/enterprise](https://getmarlee.com/industry/enterprise).
- Traction/reviews: very thin — Krowdbase "Reviews(0)", Aigregator "Based on 0 reviews" (June 2026), SourceForge "Be the first to post a review"; "194 countries" user claim appears only on one third-party site — [Krowdbase](https://www.krowdbase.com/software/coach-marlee); [Aigregator](https://aigregator.com/tools/coach-marlee); [SourceForge](https://sourceforge.net/app/marlee/web-app/); [callin.io](https://callin.io/ai-tools/get-marlee). "Over 90% reliability" accuracy claim is vendor-sourced — [callin.io](https://callin.io/ai-tools/get-marlee).

**4. FutureFit AI (B2B2C workforce navigation; Toronto)**
- What: AI career-navigation platform using labour-market data and recommendation algorithms to map skills to career paths, training and job placement; "GPS for workers"; products: Pathways Platform and Career Copilot (for public workforce systems); individuals usually reach it through partner nonprofits/government programs (e.g., Palette Skills, First Work); "not actually trying to replace humans" — [AWS Startups blog](https://aws.amazon.com/blogs/startups/how-futurefit-ai-helps-map-out-career); [BadCredit.org feature](https://www.badcredit.org/news/futurefit-ai-reshapes-career-navigation-in-the-digital-age/).
- Funding: $5.7M raise (BetaKit); April 2026 strategic investment from Achieve Partners (Ryan Craig); Acumen portfolio; a Caplight page headline mentions a $16M Series A led by BlackRock/Fin Capital but this could not be confirmed — [BetaKit](https://betakit.com/futurefit-ai-raises-5-7-million-to-scale-career-navigation-platform/); [Newswire.ca](https://www.newswire.ca/news-releases/futurefit-ai-announces-strategic-investment-to-help-governments-and-industries-navigate-ai-s-impact-on-people-and-jobs-856758122.html); [Acumen](https://acumen.org/investment/futurefit-ai); [Caplight](https://www.caplight.com/company/futurefit).
- Not a direct consumer competitor (no consumer self-serve pricing found); relevant as the "labour-market-data-first" opposite of our deliberately no-reality-check stance.

**5. Sapia.ai Phai (mobile-first AI career coach, Claude-based, enterprise distribution)**
- Launched October 2024; "mobile-first AI career coach for job seekers and employees, accessible via API"; runs on Anthropic's Claude; positioned for employer brand, pre-application alignment and internal mobility — [BusinessWire](https://www.businesswire.com/news/home/20241023515360/en); [Silicon Canals](https://siliconcanals.com/?p=55776); [Sapia blog](https://sapia.ai/resources/blog/ai-career-coach/).
- Privacy: conversations "anonymous by design, collect no personal identifiers, and are not used to train the underlying models" — [CFOtech UK](https://cfotech.co.uk/story/sapia-ai-unveils-phai-an-ai-coach-for-career-change).
- Trial data cited above (63% direction change; confidence/clarity most common themes).

**6. Assessment-first paid self-discovery tools (Pigment, Apt AI, MyPassionAI, Make the Leap)**
- Pigment (pigment.is): forced-choice, 120-question scenario test (~18 min), scores 82 workplace traits, 36-page PDF report within 24h, five work-type categories (Analytical, Creative, Integrative, Influential, Operational), career recommendations; sold at $49.99 vs $99.99 list on deal sites (the $79 figure appears in a 2026 listicle); seller-hosted reviews positive ("solid jumping off points for a career change"); vendor claims 4.9/5; no independent psychometric validation found; one reviewer notes it is "limited by the same self-report ceiling as any chatbot" — [StackSocial](https://www.stacksocial.com/sales/career-self-discovery-assessment-one-time-purchase); [TechRepublic](https://www.techrepublic.com/fr/article/pigment-career-self-discovery-assessment/); [Entrepreneur](https://www.entrepreneur.com/leadership/a-new-assessment-is-helping-entrepreneurs-identify/502996); [Loox reviews](https://loox.io/s/EJ1vuzkGU1); [pigment.is blog](https://pigment.is/blogs/blogs/best-ai-for-career-advice).
- Apt AI (tryapt.ai): personality + aptitude test wrapped in an AI "career mentor" subscription; free test, results paywalled; vendor claims "trusted by over 100,000 people"; Trustpilot dominated by paywall/refund complaints ("15+ minutes on the Test before asking to subscribe with a non-refundable policy", refund emails unanswered), repetitive questions, stale job listings; company reply says it is "actively working on making the pricing and paywall more transparent earlier in the experience"; a coaching-firm review says 65% of Trustpilot reviews are 4–5 stars — [Trustpilot tryapt.ai](https://www.trustpilot.com/review/tryapt.ai?page=3); [Realign Coaching review](https://realigncoaching.org/reviews/apt-ai-reviews/); [Apt reviews page](https://www.tryapt.ai/reviews).
- MyPassionAI: free "archetype quiz" as a starting point; Make the Leap: free result naming three career paths with income ranges from written answers — [mypassion.ai ranking](https://mypassion.ai/blog/best-ai-career-assessment-tools-2026) (vendor blog; no independent reviews found).

**7. Ikigai-style self-discovery apps (micro-market)**
- LifePurpose Ai / "Your Purpose" (iOS, $0.99, Kevin Cramer/pandx.io) for "finding your ikigai and a fulfilling and purpose-driven career"; "not received enough ratings or reviews" — [App Store](https://apps.apple.com/us/app/id6446226000).
- ikigAI (Product Hunt): two assessments then a one-off paid "Ikigai Scroll" guide — [Product Hunt](https://www.producthunt.com/posts/1161703).
- Ikigai Path: 5-step flow (Life Stage, Passions, Skills, Mission, Market) using Gemini to produce a result card (developer case study) — [Contra](https://contra.com/community/pOSjEOcI-what-i-built-ikigai-path-is).
- IkigaiFinder.ai: guided questions across love / good at / world needs / paid for — [WebCatalog](https://webcatalog.io/en/apps/ikigaifinder-ai). Ikigai Coach GPT on G2 has "not enough reviews" — [G2](https://www.g2.com/products/ikigai-coach-gpt/reviews).
- Also: "Ikigai master prompt" sold on Gumroad — [Gumroad](https://chuckzerotoone.gumroad.com/l/ikigaimasterprompt).

**8. Rocky.ai / "My AI Coach – Rocky" (general life/leadership coach, daily check-in model)**
- Method: solution-focused coaching + positive psychology; "isn't a therapist"; asks questions and encourages reflection; daily ~5-minute reflective conversation (one source says 5–10 min, twice a week); memory-based progress tracking; soft-skills and habit tools; white-label version for coaches/orgs — [Rocky help: why your coach asks questions](https://help.rocky.ai/ai-chat/why-your-ai-coach-asks-you-always-questions); [Rocky help: app features](https://help.rocky.ai/app-features/discover-your-potential-with-rocky-ai); [Dealroom](https://app.dealroom.co/companies/rocky); [Risely vs Rocky](https://risely.me/compare/risely-vs-rocky-ai/).
- Pricing (conflicting): free tier; $9.99 individual; $19.90/seat teams; white-label from $99; App Store in-app purchases incl. $2.99 weekly and $29.49 yearly "daily coaching questions"; another listing $9.99 monthly / $49.99 yearly Premium — [aitoolsbakery review](https://aitoolsbakery.com/blog/rocky-ai-review/); [App Store id1492680249](https://apps.apple.com/app/id1492680249); [JustUseApp](https://justuseapp.com/en/app/1492680249/my-ai-coach-rocky/reviews).
- Reviews: 3.2/5 in a 2026 review flagging small team, missing compliance certifications, unverified integration claims; consumer app 4.2/5 from only 18 reviews including "isn't ready for conversation"; roundups call it "narrow by design and not meant for depression or broader mental health work" — [aitoolsbakery](https://aitoolsbakery.com/blog/rocky-ai-review/); [JustUseApp](https://justuseapp.com/en/app/1492680249/my-ai-coach-rocky/reviews); [Arahi roundup](https://bump.arahi.ai/blog/best-ai-coaching-tools).

**9. Cari (heycari.ai) — "ongoing career thinking partner"**
- Described (in its own blog) as best for an ongoing career thinking partner for people weighing direction, compensation or trade-offs — [heycari roundup](https://heycari.ai/blog/best-ai-career-coaches-companions-us-2026). No pricing, ratings or independent coverage could be found; a dedicated search returned nothing — treat as early-stage/unknown.

**10. Small iOS "AI career coach" apps (long tail)**
- Career Compass AI Career Coach (Career Compass AI, LLC): $9.99/month or $44.99/year, 7-day trial; only ~11 ratings / 5 reviews; "not enough ratings yet"; third-party legitimacy score 65/100 — [App Store id6670568018](https://apps.apple.com/us/app/career-compass-ai-career-coach/id6670568018); [AppsHunter](https://appshunter.io/ios/app/career-compass-ai-career-coach/id6670568018/reviews). Others surfaced: Coach Me Up!, CareerCrafter UK, Scout — AI Career & Talent, MyCareerCoach, SkillDrift, Career Path Compass, Bindi AI Career Mentor, AI CareerGPT — none with meaningful review counts in results — [alternativeto AI Coach feature list](https://alternativeto.net/feature/ai-coach/); [App Store Coach Me Up](https://apps.apple.com/us/app/coach-me-up/id6446685068); [TrustMRR Bindi](https://trustmrr.com/startup/bindi-ai-career-mentor).

#### JOB-SEARCH EXECUTION TIER (with "AI coach" features)

**11. Teal (tealhq.com)**
- Free forever plan (unlimited résumés, unlimited job tracking, basic AI, 10 templates) + Teal+ with weekly/monthly/quarterly billing only, no annual plan: $13/week (some say $9/week discounted), $29/month, $79/quarter — [FrontDeskReview](https://frontdeskreview.com/software/resume-builders/teal.md); [Makerstack](https://makerstack.co/reviews/teal-review/); [Weekday](https://www.weekday.works/post/teal-hq-review).
- Funding: $7.5M Series A, announced with an AI interview tool that "simulates a two-way conversation with an AI agent and gives real-time feedback" — [Refresh Miami](https://refreshmiami.com/news/teal-raises-7-5m-to-expand-ai-powered-career-platform/); [Pulse2](https://pulse2.com/teal-7-5-million-series-a-closed-for-expanding-ai-based-careers-platform).
- Trustpilot: 4.2/5 from 116 reviews (Sept 2026), 4.3/5 from 93 (Mar 2026), 3.9/5 older sample; main complaint = billing/charged after cancellation; AI content "feels forced", "generic or misaligned"; "feature sprawl ... each feature individually is decent but not best-in-class" — [Trustpilot tealhq](https://www.trustpilot.com/review/tealhq.com?page=5); [Scoutify](https://scoutify.com/blog/teal-review); [ResumeCoach](https://www.resumecoach.com/reviews/tealhq-resume-builder-review/). No source confirmed a standalone "career coach" chat product.

**12. Careerflow.ai**
- "AI-powered career management platform": résumé builder, LinkedIn optimizer, job tracker, mock interview, cover letters, networking tracker, skill-gap analyzer; Premium adds unlimited generation + AI mock interviews; B2B lines for career coaches, bootcamps, higher-ed, outplacement, workforce development (coach-performance analytics) — [Careerflow features](https://www.careerflow.ai/features); [Careerflow FAQ](https://www.careerflow.ai/faq); [Careerflow for coaches](https://careerflow.ai/organizations/career-coaches).
- Pricing (own blog): $8.99/week, $23.99/month, $54.99/quarter; Capterra lists from $14.41 with free version — [Careerflow blog](https://www.careerflow.ai/blog/best-ai-resume-builders); [Capterra](https://www.capterra.ae/software/1059484/careerflow-ai).
- Complaints: software bugs, "extremely limited free plan", no integrations — [Capterra](https://www.capterra.in/software/1059484/careerflow-ai); [toolsforhumans](https://www.toolsforhumans.ai/ai-tools/careerflow). No branded individual "AI career coach chat" found.

**13. WonsultingAI (wonsulting.ai)**
- Tools: ResumAI, CoverLetterAI, NetworkAI, JobTrackerAI, InterviewAI, JobBoardAI, AutoApplyAI / AI Agent; free Starter plan with conflicting limits across sources (e.g., 5 résumé bullets, 3 cover letters, 3 networking messages, 1 interview prep, 30 tracked jobs per one Oct-2026 review); Premium $19.99/month; separate human coaching bundles $999–$1,999 for 1–7 yrs experience; 30-day money-back by email (single source) — [Weekday review](https://www.weekday.works/post/wonsulting-ai-review); [Jobright review](https://jobright.ai/blog/wonsulting-review-2026-pros-cons-and-alternatives/); [MSPoweruser](https://mspoweruser.com/wonsulting-ai-review); [G2](https://www.g2.com/products/wonsultingai/reviews). No "CareerAI" chatbot product confirmed.

**14. Kickresume AI Career Coach**
- Short questionnaire then a structured career plan "generated within seconds" naming skills to develop and learning resources; Premium-only per one review; Kickresume's own writer concedes it "functions more like a conversational chatbot that answers your questions rather than a true coaching assistant that guides you and visually maps out your potential next steps"; Product Hunt testimonial: key features "rely heavily on AI-generated content"; Trustpilot 3/5 reviewer "expected there to be more help with AI" — [Kickresume help center](https://kickresume.com/en/help-center/5-best-ai-career-coaches/); [Kickresume coach page](https://www.kickresume.com/en/online-ai-career-coach/); [PitchMeAI review](https://pitchmeai.com/blog/kickresume-review); [Trustpilot](https://www.trustpilot.com/review/kickresume.com?page=10).

**15. LinkedIn Career Coach + LinkedIn Learning AI Coach**
- Learning AI coach: subscriber-only since Oct 2023, chatbot to coach through "tough moments or career development"; 2025: custom practice scenarios, "My Career Journey" tool for personalised learning plans — [Social Media Today](https://www.socialmediatoday.com/news/linkedin-ai-learning-in-stream/703274/); [LinkedIn News 2025](https://news.linkedin.com/2025/navigating-your-career-in-the-ai-era).
- Career Coach chatbot: added 2024, upgraded through 2025–2026, embedded in app and desktop in early 2026; requires Premium Career or higher (from $29.99/month); free accounts get limited AI on job posts only; uneven geographic rollout — [itsourcecode guide](https://itsourcecode.com/linkedin/linkedin-ai-job-search-career-coach/); [Yahoo Tech](https://tech.yahoo.com/ai/articles/linkedin-just-launched-ai-job-153328000.html); [TechRadar](https://www.techradar.com/pro/linkedin-wants-you-to-use-ai-tools-to-find-your-next-job).
- Verdicts: "decent for resume review and interview prep, but ... less capable than ChatGPT for open-ended career conversations"; "still gives generic advice in places"; AI features "a bonus rather than a reason to subscribe"; users subscribe 30 days then cancel — [CO/AI](https://about.getcoai.com/news/how-linkedin-premiums-ai-features-promise-more-than-they-deliver); [itsourcecode Premium review](https://itsourcecode.com/linkedin/is-linkedin-premium-worth-it/).

**16. Indeed Career Scout (free, embedded in Indeed; AU launch July 2026)**
- Announced US Sept 10 2025 with Talent Scout; launched for Australian jobseekers July 2026 and UK (framed as "AI-powered career coach to support workers seeking a career change"); Netherlands late Aug 2026 (secondary source) — [Indeed release](https://www.businesswire.com/news/home/20250910809034/en/Indeed-Introduces-New-Suite-of-Hiring-Products-Career-Scout-Talent-Scout-Premium-Sponsored-Jobs-and-Indeed-Connect); [IT Brief Australia](https://itbrief.com.au/story/indeed-launches-ai-career-scout-for-australian-jobseekers); [Workplace Journal UK](https://workplacejournal.co.uk/2026/07/indeed-launches-career-scout-to-support-workers-seeking-career-change/).
- Features: personalised pathways from skills/interests, "why you might suit" explanations, expected earnings, chat to find jobs, AI mock interviews; personalisation from profile + chat context + Indeed behaviour; Indeed claims 7x faster applying and 38% higher hire likelihood (internal US data) — [Indeed career services](https://indeed.com/career-services); [eCommerceNews AU](https://ecommercenews.com.au/story/indeed-launches-ai-career-scout-for-australian-jobseekers). Directly relevant: a free, Australian-available, direction-flavoured AI coach from a job board, but anchored to job matching.

**17. Pathrise (shut down as D2C)** — income-share model (free until hired, then % of first-year salary); assets acquired by Springshare Oct 2025, D2C wound down by end of 2025, folding into CareerShift — [Springshare FAQ](https://www.springshare.com/careershift-pathrise-faq). Huntr, Jobscan and Rezi: searches returned no information on AI-coach features; treat as résumé/tracker tools without a coaching proposition (gap).

#### ENTERPRISE / B2B AI COACHES (adjacent)

**18. Valence "Nadia"** — building since Dec 2022, launched early 2023 ("first AI coach to market"); $50M Series B Sept 2025 (Bessemer); ADP Ventures strategic investment 2026; Microsoft 365 integration May 2026; AI-only, no human in loop; calendar-centric model of who you work with; per-organisation guardrails to escalate to a human coach, manager or HR; claims first/only ISO 42001-certified AI coach (self-reported, July 2026) — [Pulse2 Series B](https://pulse2.com/valence-50-million-series-b-raised-for-enterprise-ai-coach-platform/amp/); [ADP](https://mediacenter.adp.com/adp-ventures-invests-in-valence); [BVP profile](https://www.bvp.com/news/meet-nadia-valences-ai-coach-for-leadership-development-and-workplace-collaboration); [Reworked](https://www.reworked.co/learning-development/ai-coaches-make-choices-know-what-those-choices-are/); [Valence AI lab](https://valence.co/ai-lab).

**19. BetterUp Grow** — AI coaching launched Jan 2025; Grow is AI-only supplement to human coaches; pilot: 95% satisfaction, 16% reported boosted workplace confidence; quote-only enterprise pricing; a competitor blog claims BetterUp closed individual signups in early 2026 (unverified) — [BusinessWire](https://www.businesswire.com/news/home/20250121963707/en); [BetterUp Grow page](https://www.betterup.com/products/betterup-ai-coaching); [CB Insights via Lindy](https://www.lindy.ai/blog/ai-coach); [Reworked](https://www.reworked.co/learning-development/ai-coaches-make-choices-know-what-those-choices-are/).

#### GENERAL ASSISTANTS (ChatGPT / Claude / Gemini) and GPT-store coaches

- Usage pattern: "most people are using it ... like, can you improve this [résumé]?" per OpenAI's head of recruiter programs; also interview prep, confidence, self-reflection, translating experience into narratives — [OpenAI Forum event](https://forum.openai.com/home/videos/event-replay-get-hired-using-chatgpt-tips-from-openais-head-of-recruiter-programs-2026-02-05); [OpenAI Academy](https://academy.openai.com/en/public/clubs/higher-education-05x4z/blogs/how-to-use-chatgpt-to-land-your-dream-job-2026-04-22).
- Prompt recipes: "Act as a career coach", give background first, ask for "encouraging but realistic feedback"; Coursera says it "does not replace the intuition and accountability" of a human and recommends a human for high-stakes/emotional decisions — [Coursera](https://www.coursera.org/articles/chatgpt-career-coach); [Physician Leaders prompts](https://www.physicianleaders.org/articles/want-to-use-ai-as-a-career-coach-use-these-prompts); [Refer.io prompts](https://refer.io/blog/articles/chat-gpt-career-path-coach-prompts).
- Cost motive: an Every essay describes using a ChatGPT subscription because a human coach at $100–150/hour was out of reach — [Every](https://every.to/learning-curve/i-hired-chatgpt-as-my-career-coach).
- Division of labour suggested by listicles: ChatGPT to practise your career-change story, Claude to organise a written career decision, Gemini to generate directions — [pigment.is](https://pigment.is/blogs/blogs/best-ai-for-career-advice) (vendor).
- GPT Store: a mirror lists "Career Coach – Resume, Interview prep and Jobs" at 100K+ conversations; two further "Career Coach" GPTs at 10K+ (one job-application focused, one career-development focused); niche coaches (PhD, cybersecurity, STEM, tech) smaller — [GPTs Hunter mirror](https://gptshunter-v2.pages.dev/gpt-store/MTc1OTU0MmIyNTAyMTQzNjA3); [GPTs Hunter: Career Explorer](https://gptshunter-v2.pages.dev/gpt-store/NTExMzU4NTIxNTIwNTEyMjJl). Counts are rounded buckets from a third-party mirror.
- University careers services advise checking AI advice against other sources — [University of Reading careers blog](https://blogs.reading.ac.uk/careers/chatgpt-is-it-any-use-for-careers-questions).

### Inferences
- The free, direction-first, consumer-facing niche is sparsely populated and dominated by philanthropically funded (CareerVillage) or Big-Tech-experiment (Career Dreamer) products rather than venture-backed startups — venture money flows to execution suites and enterprise coaches. This suggests consumer willingness-to-pay for pure direction-finding is unproven, which is consistent with Apt AI's paywall backlash.
- Even products marketed as "career coach" (Kickresume, LinkedIn, Teal) are judged by reviewers against ChatGPT and often lose on open-ended conversation; the differentiation that survives is structure, data (LinkedIn/Indeed labour-market data) or assessment, not raw chat quality.
- Phai's trial data (63% seeking direction change, strengths/confidence questions dominating) is the strongest external evidence that demand for direction/strengths coaching is real and skews mid-career, supporting an "everyday people" rather than graduate framing.

### Gaps
- Could not read any primary pricing page, landing page or app-store page (network block); all pricing is second-hand and several figures conflict (Teal weekly price, Rocky tiers, Wonsulting free limits).
- No information found on Huntr, Jobscan, Rezi AI coaching features; Coachvox, Wave AI, Headway, "Marlow" returned nothing (likely defunct, renamed or too small to index — not confirmed).
- Cari (heycari.ai): no pricing, traction or independent coverage.
- Indeed Career Scout: no user reviews found; Australian uptake unknown.
- No 2026 usage numbers for CareerVillage Coach.

---

## Key Question 2: How do they structure the coaching (open chat, guided steps, assessments, plans, check-ins)?

### Takeaway
Four structural archetypes recur: (1) open chat bolted onto a toolset (Kickresume, LinkedIn, Teal, Indeed Career Scout, GPT-store GPTs); (2) assessment → report → optional chat (Marlee's 48-trait motivation analysis, Pigment's 82-trait forced-choice test, Apt AI); (3) daily/weekly micro-check-ins with memory (Rocky.ai's ~5-minute solution-focused dailies, Marlee's 8-week programs at 10–15 min/week); (4) describe-yourself → generated pathways (Career Dreamer, Indeed Career Scout, Kickresume's questionnaire-to-plan). Almost none offer a step-by-step guided self-discovery workflow with user-authored content plus an AI partner; our ten-step design is unusual in the consumer market.

### Cited Findings
- Kickresume: short questionnaire → "structured plan generated within seconds" with skills to develop and learning resources, but behaves as a Q&A chatbot rather than guiding/visually mapping next steps — [Kickresume help center](https://kickresume.com/en/help-center/5-best-ai-career-coaches/).
- Marlee: 48-trait motivation assessment, benchmarked locally; 8-week coaching programs; 10–15 min/week on free plan; "Unlimited AI Coaching sessions" — [Marlee FAQ](https://getmarlee.com/faq/what-does-marlee-measure); [Marlee cost FAQ](https://rc.getmarlee.com/faq/what-does-marlee-cost); [Krowdbase](https://www.krowdbase.com/software/coach-marlee).
- Rocky.ai: daily ~5-minute reflective conversation, solution-focused + positive psychology, "asks questions and encourages reflection", memory-based progress tracking — [Rocky help](https://help.rocky.ai/ai-chat/why-your-ai-coach-asks-you-always-questions); [Dealroom](https://app.dealroom.co/companies/rocky).
- Pigment: 120 scenario questions (~18 min) → 36-page PDF report within 24 hours; no ongoing coaching — [TechRepublic](https://www.techrepublic.com/fr/article/pigment-career-self-discovery-assessment/).
- Career Dreamer: free-text description of background → suggested paths → drill into roles → Gemini for documents — [TechCrunch](https://techcrunch.com/2025/02/19/googles-career-dreamer-uses-ai-to-help-you-explore-job-possibilities/).
- Indeed Career Scout: pathways from skills/interests + "why you might suit" + earnings + chat + mock interview; personalises from profile and platform behaviour — [IT Brief AU](https://itbrief.com.au/story/indeed-launches-ai-career-scout-for-australian-jobseekers).
- CareerVillage Coach: activities spanning career exploration, résumé/cover letter, job-description interpretation, mock interviews; progress tracked via CAAS-SF survey; "much more than just an AI chatbot" — [topai.tools](https://topai.tools/t/coach-by-careervillage); [Schultz release](https://schultzfamilyfoundation.org/news-release/coach-launches-first-of-its-kind-ai-career-development-tool-built-for-equity-and-measurable-results).
- Valence Nadia: AI-only, embedded in work (Microsoft 365, calendar as source of truth), guardrails to escalate to human coach/manager/HR — [BVP](https://www.bvp.com/news/meet-nadia-valences-ai-coach-for-leadership-development-and-workplace-collaboration); [Reworked](https://www.reworked.co/learning-development/ai-coaches-make-choices-know-what-those-choices-are/).
- LinkedIn Learning: "My Career Journey" tool to outline where you want to go and unlock a personalised learning plan; custom practice scenarios — [LinkedIn News](https://news.linkedin.com/2025/navigating-your-career-in-the-ai-era).
- Ikigai apps use a fixed 4–5 step flow (love / good at / world needs / paid for; or Life Stage, Passions, Skills, Mission, Market) producing a card or scroll — [Contra Ikigai Path](https://contra.com/community/pOSjEOcI-what-i-built-ikigai-path-is); [WebCatalog IkigaiFinder](https://webcatalog.io/en/apps/ikigaifinder-ai).
- Directive vs reflective: Rocky explicitly reflective/questioning; Pigment/Apt/Indeed/Career Dreamer are directive (they tell you what fits); Kickresume directive (plan output). Pigment's blog argues general chatbots "have no independent read on you and will tend to validate the direction you lean toward" (vendor claim) — [pigment.is](https://pigment.is/blogs/blogs/best-ai-for-career-advice).

### Inferences
- Follow-up/accountability exists mainly in life-coach-style apps (Rocky dailies, Marlee weekly programs) and enterprise coaches (Nadia in the flow of work), not in career-direction tools; this is the clearest structural gap in our product relative to the "coaching" category, but also a gap in our direct competitors.
- Assessment-led products give users a sense of external validation ("independent read") that pure reflective chat lacks; several listicles treat this as the key differentiator over ChatGPT.

### Gaps
- Could not verify onboarding flows or step structures first-hand for any product (no page access).
- No evidence found about how CareerVillage Coach sequences activities or whether it has check-ins/nudges.

---

## Key Question 3: What do they charge and how?

### Takeaway
Consumer pricing clusters at US$9.99–$29.99/month, with a strong trend toward weekly billing ($8.99–$13/week) in job-search suites and freemium everywhere; one-off assessment purchases run $49.99–$99.99; direction-focused tools are either free (CareerVillage, Career Dreamer, Indeed Career Scout, Marlee Starter) or B2B/quote-only (FutureFit, Phai, Nadia, BetterUp). Paywall-after-free-test models (Apt AI) attract the harshest reviews.

### Cited Findings
- Teal+: $13/week (or $9/week discounted), $29/month, $79/quarter; no annual plan; free forever tier — [FrontDeskReview](https://frontdeskreview.com/software/resume-builders/teal.md); [Makerstack](https://makerstack.co/reviews/teal-review/).
- Careerflow: $8.99/week, $23.99/month, $54.99/quarter; free version — [Careerflow blog](https://www.careerflow.ai/blog/best-ai-resume-builders); [Capterra](https://www.capterra.ae/software/1059484/careerflow-ai).
- WonsultingAI: free Starter; Premium $19.99/month; human coaching bundles $999–$1,999 — [Weekday](https://www.weekday.works/post/wonsulting-ai-review); [Jobright](https://jobright.ai/blog/wonsulting-review-2026-pros-cons-and-alternatives/).
- Kickresume: coach Premium-only — [PitchMeAI](https://pitchmeai.com/blog/kickresume-review).
- LinkedIn: Premium from $29.99/month required for Career Coach — [itsourcecode](https://itsourcecode.com/linkedin/is-linkedin-premium-worth-it/).
- Marlee: free Starter (no card), Growth ~$15.99/month, Enterprise via sales — [G2 pricing](https://www.g2.com/products/marlee/pricing); [Krowdbase](https://www.krowdbase.com/software/coach-marlee).
- Rocky.ai: free; $9.99 individual; $19.90/seat teams; white-label from $99; app IAPs $2.99/week, $29.49/year, $49.99/year — [aitoolsbakery](https://aitoolsbakery.com/blog/rocky-ai-review/); [App Store](https://apps.apple.com/app/id1492680249).
- Career Compass AI: $9.99/month, $44.99/year, 7-day trial — [App Store](https://apps.apple.com/us/app/career-compass-ai-career-coach/id6670568018).
- Pigment: $49.99 (list $99.99) one-off — [StackSocial](https://www.stacksocial.com/sales/career-self-discovery-assessment-one-time-purchase). LifePurpose Ai: $0.99 — [App Store](https://apps.apple.com/us/app/id6446226000). ikigAI: pay once for the Scroll — [Product Hunt](https://www.producthunt.com/posts/1161703).
- Apt AI: free test, subscription to see results, non-refundable per reviewers — [Trustpilot](https://www.trustpilot.com/review/tryapt.ai?page=3).
- CareerVillage Coach: free to public; institutional cost-sharing — [TriplePundit](https://triplepundit.com/story/2024/ai-career-coach/811516). Career Dreamer: free (Google Labs) — [TechRadar](https://www.techradar.com/pro/googles-latest-ai-tool-helps-you-find-your-perfect-job). Indeed Career Scout: free within Indeed — [Indeed career services](https://indeed.com/career-services).
- BetterUp: quote-only; Grow free trial landing page exists — [eLearning Industry](https://elearningindustry.com/directory/elearning-software/betterup/pricing); [BetterUp free trial](https://www.betterup.com/products/betterup-ai-coaching/free-trial). Valence: enterprise — [BVP](https://www.bvp.com/news/meet-nadia-valences-ai-coach-for-leadership-development-and-workplace-collaboration).
- Pathrise income-share model ended with the D2C wind-down — [Springshare FAQ](https://www.springshare.com/careershift-pathrise-faq).
- Human coach benchmark: $100–150/hour (Every essay); BetterUp $75–250+/session (Risely estimate) — [Every](https://every.to/learning-curve/i-hired-chatgpt-as-my-career-coach); [Risely](https://risely.me/compare/pricing-guide/).

### Inferences
- Weekly billing reflects the episodic nature of job search; direction-finding is also episodic, which argues against subscription and for free or one-off models (as Pigment and ikigai apps do).
- A free, no-account product like ours sits with the philanthropic/Big Tech tier on price; the question is sustainability, which those competitors solve via grants or platform cross-subsidy.

### Gaps
- Exact current prices unverified on vendor pages; AUD pricing not found for any product; Indeed Career Scout AU terms not found.

---

## Key Question 4: What do users praise and complain about?

### Takeaway
Praise concentrates on speed, structure and "generous free tiers" (Teal tracker, Kickresume plan-in-seconds, Marlee's free assessment). Complaints cluster into five recurring themes: generic/validating advice that ignores context; AI that is "a chatbot, not a coach" (no guidance or mapping of next steps); paywall surprises and refund/billing failures; thin or stale data (closed job listings); and worse open-ended conversation quality than ChatGPT. Review volumes for direction-focused tools are tiny (often 0–20 reviews), itself a traction signal.

### Cited Findings
- "The biggest complaint is usually the 'robot' factor ... the AI that tells you to 'stay positive' when your boss is micromanaging your every move" — [Compono AI coaching reviews guide](https://www.heycompono.com/blog/ai-coaching-reviews-guide).
- AI advice "textbook correct and operationally useless" — [Noomii](https://orgs.noomii.com/i-trusted-ai-coaching-and-paid-the-price).
- General chatbots "will tend to validate the direction you lean toward" (vendor) — [pigment.is](https://pigment.is/blogs/blogs/best-ai-for-career-advice). A Reddit comment: ChatGPT "tells people what they want to hear instead of what's right" (about ChatGPT generally) — [Reddit snapshot](https://reddit.sentinel-team.org/posts/1pss6ks/snapshots/2025-12-22T23%3A10%3A17.985779Z).
- Kickresume coach "functions more like a conversational chatbot ... rather than a true coaching assistant that guides you and visually maps out your potential next steps"; features "rely heavily on AI-generated content" — [Kickresume help center](https://kickresume.com/en/help-center/5-best-ai-career-coaches/); [Product Hunt testimonial](https://www.producthunt.com/products/kickresume/embed/testimonial).
- LinkedIn Career Coach "less capable than ChatGPT for open-ended career conversations"; "still gives generic advice in places" — [itsourcecode](https://itsourcecode.com/linkedin/linkedin-ai-job-search-career-coach/); [CO/AI](https://about.getcoai.com/news/how-linkedin-premiums-ai-features-promise-more-than-they-deliver).
- Teal: billing after cancellation; AI content "forced", "generic or misaligned"; praised tracker, "AI elements are shockingly good" (one reviewer), generous free version — [Trustpilot](https://www.trustpilot.com/review/tealhq.com?page=5); [Scoutify](https://scoutify.com/blog/teal-review).
- Apt AI: paywall after 15–20 min test, unanswered refund emails, repetitive questions, stale job listings; some praise for aligned job suggestions — [Trustpilot tryapt.ai](https://www.trustpilot.com/review/tryapt.ai?page=3); [Realign](https://realigncoaching.org/reviews/apt-ai-reviews/).
- Careerflow: bugs, extremely limited free plan, no integrations — [Capterra](https://www.capterra.in/software/1059484/careerflow-ai).
- Rocky: "isn't ready for conversation"; missing compliance certifications — [JustUseApp](https://justuseapp.com/en/app/1492680249/my-ai-coach-rocky/reviews); [aitoolsbakery](https://aitoolsbakery.com/blog/rocky-ai-review/).
- CareerVillage Coach criticised as unable to customise like 1-on-1 coaching; best for "low hanging fruit" — [CareerVillage Q&A](https://www.careervillage.org/questions/1114596/what-are-the-pros-and-cons-of-careervillage-coach-ai).
- Pigment praised: "simple, but the results were incredibly thoughtful", "solid jumping off points for a career change" (seller-hosted) — [Loox](https://loox.io/s/EJ1vuzkGU1).
- Review-volume signals: Marlee 0 reviews on three directories; CareerVillage Coach 1 Product Hunt rating; Career Compass AI ~11 ratings; LifePurpose Ai "not enough ratings"; Teal 107–116 Trustpilot reviews; Apt AI multiple Trustpilot pages — sources as cited above.

### Inferences
- The "chatbot, not coach" complaint is the most actionable for us: users want visible structure and mapped next steps, which our step strip, Compass map and First-steps/Calendar provide; the risk flips to "too rigid" if the chat cannot roam.
- Sycophancy/validation is a recognised failure mode; our non-directive stance ("never judge whether an idea is realistic") could be read by some users as exactly this. Competitors like Indeed/FutureFit sell the opposite (reality-check with labour data).
- Billing/paywall anger is the dominant 1-star driver; a free, no-account product avoids it entirely.

### Gaps
- No Reddit threads specifically about AI career-direction coaching surfaced (two searches). No systematic review study on hallucination in career advice found.

---

## Key Question 5: How do they handle safety, disclaimers, mental-health adjacency and data privacy?

### Takeaway
Explicit, published safety and privacy stances are rare in consumer career tools; the clearest examples are enterprise (Valence Nadia: ISO 42001 claim, per-organisation escalation to human coach/manager/HR) and Sapia Phai (anonymous by design, no training on conversations). Rocky.ai and CareerVillage publish "not a therapist / not a replacement for coaching" disclaimers. General privacy coverage warns that chat logs are typically retained, used for training and subpoenable, and that deletion may only hide data — the opposite of our browser-only model.

### Cited Findings
- Valence: "guardrails customized to each organization to escalate coaching to a human coach, manager, or HR in line with enterprise and organizational HR policies"; claims "the very first ISO 42001 certification in our category" (self-reported) — [BVP](https://www.bvp.com/news/meet-nadia-valences-ai-coach-for-leadership-development-and-workplace-collaboration); [Valence AI lab](https://valence.co/ai-lab).
- Sapia Phai: conversations "anonymous by design, collect no personal identifiers, and are not used to train the underlying models" — [CFOtech UK](https://cfotech.co.uk/story/sapia-ai-unveils-phai-an-ai-coach-for-career-change).
- Rocky.ai: "isn't a therapist"; roundups: "not meant for depression or broader mental health work" — [Rocky help](https://help.rocky.ai/ai-chat/why-your-ai-coach-asks-you-always-questions); [Arahi](https://bump.arahi.ai/blog/best-ai-coaching-tools).
- CareerVillage: "this tool should not replace career coaching"; hybrid human+AI preferred in pilot — [CareerVillage](https://www.careervillage.org/articles/cv-updates/empowering-futures-how-careervillage-orgs-ai-career-coach-revolutionizes-access-to-career-guidance/).
- FutureFit: "not actually trying to replace humans" — [AWS blog](https://aws.amazon.com/blogs/startups/how-futurefit-ai-helps-map-out-career).
- BetterUp Grow is positioned as a supplement to human coaches — [Reworked](https://www.reworked.co/learning-development/ai-coaches-make-choices-know-what-those-choices-are/).
- Privacy climate: Stanford study found six leading US AI companies feed user inputs back into training and some sell data via ads; coaching chats contain "fears, struggles, relationship challenges, career concerns, mental health patterns"; chat logs can be subpoenaed; ChatGPT chats not end-to-end encrypted; deletion may only hide data; advice to look for an explicit no-training statement — [WDBJ7](https://www.wdbj7.com/2026/04/27/ai-chatbot-privacy-concerns-grow-users-share-personal-details/); [Cave.co privacy post](https://cave.co.nl/blog/ai-companion-privacy/); [gonow privacy guide](https://gonow-web.pages.dev/learn/privacy-ai-coaching).
- Indeed Career Scout personalises using profile, chat context and "how you interact with Indeed" (i.e., behavioural data) — [IT Brief AU](https://itbrief.com.au/story/indeed-launches-ai-career-scout-for-australian-jobseekers).
- Benchmarks: Renaissance Philanthropy + CareerVillage building "key performance benchmarks for AI platforms" for career discovery (Schultz $3M initiative, Apr 2025) — [HR Tech Feed](https://hrtechfeed.com/new-3m-initiative-to-train-ai-platforms-to-provide-better-career-discovery-and-job-search-results).

### Inferences
- No consumer competitor found advertises crisis-line detection or an always-visible "Help now" affordance; our consent screen + crisis dialog + localStorage-only model is stronger than anything documented in this market, and is a credible trust differentiator worth stating on a landing page.
- Trade-off: no accounts/no server storage also means no cross-device progress and no follow-up, which the coaching-style apps (Rocky, Marlee) rely on for retention.

### Gaps
- Privacy policies of Teal, Careerflow, Kickresume, Wonsulting, Marlee, Rocky, Career Dreamer not read (blocked); no information on whether any uses chats for training.
- No evidence on how any consumer career tool handles distress disclosures.

---

## Key Question 6: What do visual design and onboarding look like?

### Takeaway
Direct observation was impossible in this session (all product sites blocked), so only indirect design signals were collected: mobile-first (Phai, Rocky, small iOS apps), embedded-in-platform (LinkedIn, Indeed, Nadia in Microsoft 365), long-questionnaire-then-paywall (Apt), and quick-questionnaire-to-plan (Kickresume). Reviewers reward "easy and intuitive ... even for first-time users" and penalise paywalls that appear after 15–20 minutes of input.

### Cited Findings
- Kickresume: "easy and intuitive to use, even for first-time users"; plan within seconds after short questionnaire — [Kickresume help center](https://kickresume.com/en/help-center/5-best-ai-career-coaches/).
- Apt AI: 15–20 minutes of questions before a subscription wall; company admits working to surface pricing "earlier in the experience" — [Trustpilot](https://www.trustpilot.com/review/tryapt.ai?page=3).
- Phai: "mobile-first", API-accessible — [Silicon Canals](https://siliconcanals.com/?p=55776).
- Rocky: native iOS app ("My AI Coach – Rocky"/"Coach Rocky – Daily AI Chat"), daily chat format — [App Store](https://apps.apple.com/app/id1492680249).
- LinkedIn Career Coach embedded in mobile app and desktop (early 2026) — [itsourcecode](https://itsourcecode.com/linkedin/linkedin-ai-job-search-career-coach/). Nadia inside Microsoft 365 — [CB Insights](https://www.cbinsights.com/company/valence-5).
- Career Dreamer: free-text background entry, exploratory tone, "more detailed input yields more personalized results" — [Success.com](https://www.success.com/?p=84282).
- Teal: weekly billing "prominent" on pricing page; feature sprawl — [FrontDeskReview](https://frontdeskreview.com/software/resume-builders/teal.md); [Scoutify](https://scoutify.com/blog/teal-review).
- Marlee: no credit card required for free plan — [Marlee cost FAQ](https://rc.getmarlee.com/faq/what-does-marlee-cost).
- Taglines/positioning found: Marlee — "Try coaching for free" (leadership page); Sapia Phai — "Career mobility that starts with people"; CareerVillage Coach — "built for equity and measurable results"; FutureFit — "GPS for workers"; WonsultingAI — "Guaranteed Interviews" (directory title); Indeed Career Scout — "pocket-sized tour guide for job hunting" (ad campaign) — [getmarlee.com/leadership](https://getmarlee.com/leadership); [sapia.ai/phai](https://sapia.ai/phai); [Schultz release](https://schultzfamilyfoundation.org/news-release/coach-launches-first-of-its-kind-ai-career-development-tool-built-for-equity-and-measurable-results); [BadCredit.org](https://www.badcredit.org/news/futurefit-ai-reshapes-career-navigation-in-the-digital-age/); [tooliverse](https://tooliverse.ai/tools/wonsultingai); [LBBOnline](https://lbbonline.com/news/Indeed-Unveils-Pocket-Sized-Tour-Guide-for-Job-Hunting).

### Inferences
- Our "open straight into consent + step 1" with no landing page is unusual; every competitor found has a marketing site with a tagline and a free-entry CTA. A one-screen landing with the positioning line and the trust facts (free, no account, browser-only, not therapy) would match market norms without adding sign-up friction.
- Mobile: competitors in the coaching (not résumé) segment are mobile-first native apps; our responsive two-tab phone layout is adequate but web-only, with no push/reminder channel.

### Gaps
- Visual style, typography, colour, onboarding screens and sign-up friction for every product remain unverified (no site access). Recommend a follow-up session with network access to screenshot Career Dreamer, CareerVillage Coach, Marlee, Indeed Career Scout (AU) and Rocky.

---

## Key Question 7: Cross-cutting synthesis — patterns, what "good" looks like, common complaints

### Takeaway
"Good" in late 2026 means: a visible structure that is more than a chat window; some external input (assessment or labour-market data) so the user feels seen rather than merely echoed; a light accountability loop (daily/weekly micro-sessions, plans, memory); an honest free tier with pricing shown before effort is sunk; and explicit, specific trust statements (no training on chats, not therapy, human escalation). No consumer product found combines all of these for career direction; the nearest are CareerVillage Coach (structure + free + equity mission, but US/student-centric) and Google Career Dreamer (free exploration, US-only, no follow-up).

### Cited Findings
- Demand evidence for direction coaching: 63% of Phai trial users sought a direction change; strengths/confidence/clarity dominate — [CFOtech UK](https://cfotech.co.uk/story/sapia-ai-unveils-phai-an-ai-coach-for-career-change).
- Market consolidation/exits: Pathrise D2C wound down end-2025 (acquired by Springshare); Google Interview Warmup discontinued (2025/26) — [Springshare FAQ](https://www.springshare.com/careershift-pathrise-faq); [FinalRound AI](https://www.finalroundai.com/blog/google-interview-warmup-discontinued-alternatives).
- Platform incumbents entering free: Indeed Career Scout (AU July 2026), LinkedIn Career Coach (Premium), Google Career Dreamer — [IT Brief AU](https://itbrief.com.au/story/indeed-launches-ai-career-scout-for-australian-jobseekers); [TechRadar LinkedIn](https://www.techradar.com/pro/linkedin-wants-you-to-use-ai-tools-to-find-your-next-job); [TechCrunch](https://techcrunch.com/2025/02/19/googles-career-dreamer-uses-ai-to-help-you-explore-job-possibilities/).
- Enterprise capital: Valence $50M Series B; BetterUp Grow; ADP Ventures — [Pulse2](https://pulse2.com/valence-50-million-series-b-raised-for-enterprise-ai-coach-platform/amp/); [ADP](https://mediacenter.adp.com/adp-ventures-invests-in-valence).
- Philanthropic capital for equity-focused direction tools: Gates $1M, DeLuca $1.14M, Schultz $3M initiative incl. AI benchmarks — [Gates](https://gatesfoundation.org/about/committed-grants/2024/02/inv-066023); [Grantable](https://grantable.co/nonprofits/careervillage-inc-morg_f93fb240f3d943cba0c76b193ffef4cf); [HR Tech Feed](https://hrtechfeed.com/new-3m-initiative-to-train-ai-platforms-to-provide-better-career-discovery-and-job-search-results).
- Common complaints (see KQ4): generic/validating advice; chatbot-not-coach; paywall/refunds; stale data; inferior to ChatGPT in open conversation — [Compono](https://www.heycompono.com/blog/ai-coaching-reviews-guide); [Kickresume help center](https://kickresume.com/en/help-center/5-best-ai-career-coaches/); [Trustpilot tryapt.ai](https://www.trustpilot.com/review/tryapt.ai?page=3); [CO/AI](https://about.getcoai.com/news/how-linkedin-premiums-ai-features-promise-more-than-they-deliver).
- Listicle consensus: combine a direction tool with a general chatbot to test options; "AI cannot make the decision for you, but it compresses the research phase" — [pigment.is](https://pigment.is/blogs/blogs/best-ai-for-career-advice); [aihustleguy](https://www.aihustleguy.com/blog/best-ai-career-tools).

### Inferences (implications for The Compass)
- Where we are differentiated: guided ten-step self-authored workflow (rare), non-directive Claude partner (rare; most are directive), whole-life "What I need" constraints (not seen elsewhere), Australian localisation incl. crisis lines (Indeed Career Scout AU is the only other AU-localised free coach found, and it is job-matching), browser-only privacy (stronger than any documented consumer competitor), concrete First steps + Calendar export (competitors stop at reports or plans).
- Where the market is ahead: follow-up/accountability (Rocky dailies, Marlee weekly programs), external "read" on the user (Marlee 48 traits, Pigment 82 traits, Indeed/FutureFit labour data), landing page + tagline + mobile app presence, measurable outcomes (CareerVillage's CAAS-SF, Phai's trial analytics, Indeed's hire-rate claims), B2B distribution (coaches, workforce agencies, schools) which is how direction tools actually reach "everyday people" at scale.
- Watch-outs: non-directive + no reality check risks the "validates whatever I lean toward" critique; consider an optional, clearly-labelled "reality check" step or export to Indeed/Jobs & Skills Australia rather than abandoning the stance. Lack of any save/return mechanism means we cannot evidence outcomes, which funders (Gates/Schultz model) and B2B partners increasingly demand.

### Gaps
- No Australian-specific competitor research beyond Indeed Career Scout AU (e.g., Jobs and Skills Australia tools, SEEK AI features, Year13, myfuture) — out of this brief's scope but relevant for a follow-up.
- All design/UX and primary pricing verification blocked by network; recommend re-running with hosts allowed: getmarlee.com, careervillage.org, grow.google (Career Dreamer), indeed.com, rocky.ai, apps.apple.com, trustpilot.com, heycari.ai.
