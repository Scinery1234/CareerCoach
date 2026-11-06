// Sample job ads for "No ad handy? Try a sample", so a new member can see a tailored
// resume in their first minute without going to find an ad. Picked by the words in
// their own resume. Plain, realistic Australian ads; the organisations are made up.
export const SAMPLE_ADS = [
  { id: 'ops', words: ['operations', 'coordinator', 'logistics', 'administration', 'office', 'scheduling', 'procurement'], role: 'Operations Coordinator', company: 'Harbourline Services',
    ad: `Operations Coordinator, Harbourline Services (Sydney, full time)

About the role
You will keep our service delivery running day to day: scheduling crews, tracking jobs from booking to invoice, and being the calm point of contact for clients and field staff.

What you'll do
- Coordinate daily schedules for a team of 12 field staff and respond to changes as they happen
- Track jobs end to end in our job management system and keep records accurate
- Manage supplier orders and monitor spend against budget
- Prepare weekly reports on job completion, delays and costs
- Handle client queries by phone and email, and escalate issues early
- Support the Operations Manager with process improvements

About you
- Two or more years in an operations, logistics or administration role
- Strong with spreadsheets and comfortable learning new systems
- Clear written and spoken communication, and patience under pressure
- Experience with stakeholder engagement and budget tracking
- Salesforce experience is a plus` },
  { id: 'care', words: ['support worker', 'disability', 'ndis', 'aged care', 'community', 'client', 'care plan', 'youth', 'case'], role: 'Community Support Worker', company: 'Bridgewater Community Care',
    ad: `Community Support Worker, Bridgewater Community Care (Western Sydney, part time to full time)

About us
We support people with disability and older people to live well at home and in their community.

The role
- Provide in-home and community support in line with each person's care plan and NDIS goals
- Help with daily living, appointments, social outings and building independence
- Keep clear, timely progress notes and report changes in wellbeing
- Work with families, coordinators and allied health teams
- Follow safeguarding, medication and manual handling procedures

What we're looking for
- Certificate III in Individual Support or equivalent experience
- Current NDIS Worker Screening Check, First Aid and driver's licence
- Warm, reliable and respectful of each person's choices
- Experience writing progress notes and working to care plans
- Experience with behaviour support plans is welcome` },
  { id: 'policy', words: ['policy', 'government', 'program', 'project officer', 'grants', 'research', 'stakeholder', 'department', 'council'], role: 'Policy Officer', company: 'Department of Communities and Fair Trading',
    ad: `Policy Officer, Department of Communities and Fair Trading (Parramatta, ongoing)

The opportunity
Join a small team developing policy and program advice on consumer protection and community services.

Key accountabilities
- Research and analyse policy issues and prepare clear briefs, submissions and options papers
- Consult with community organisations, industry and other agencies and summarise what they tell us
- Support program design and evaluation, including data collection and reporting
- Draft correspondence and ministerial briefing notes to tight deadlines
- Contribute to project plans and track delivery against milestones

About you
- Experience explaining complex rules or processes to people in plain language
- Strong writing and analysis, with attention to accuracy
- Experience in government, community services or a regulated sector
- Able to manage several pieces of work at once and work to deadlines
- Experience with stakeholder consultation and program evaluation` },
  { id: 'retail', words: ['retail', 'customer service', 'hospitality', 'sales', 'store', 'barista', 'cafe', 'café', 'team leader', 'shift'], role: 'Customer Service Team Leader', company: 'Northgate Home and Garden',
    ad: `Customer Service Team Leader, Northgate Home and Garden (Brisbane, full time)

About the role
Lead the front-of-store team to give customers a great experience, from the first hello to the last bag.

Responsibilities
- Lead, roster and coach a team of 8 customer service staff across the week
- Handle escalated customer issues and refunds calmly and fairly
- Keep service standards, presentation and safety on track every shift
- Monitor sales targets and share daily results with the team
- Train new starters on systems, products and service

What you bring
- Two or more years in retail, hospitality or customer service, with some experience leading a shift or a team
- Confident with point-of-sale and rostering systems
- Calm under pressure and good at defusing complaints
- Experience with stock control or visual merchandising is a plus` },
  { id: 'tech', words: ['software', 'developer', 'engineer', 'analyst', 'data', 'it support', 'systems', 'sql', 'python', 'javascript', 'help desk'], role: 'Business Analyst', company: 'Southbank Health Network',
    ad: `Business Analyst, Southbank Health Network (Melbourne, hybrid, full time)

About the role
Work with clinical and corporate teams to understand how things are done today, define what better looks like, and help deliver it.

What you'll do
- Run workshops and interviews with stakeholders to gather and document requirements
- Map current and future processes and write clear user stories and acceptance criteria
- Analyse data to size problems and measure change, using SQL and Excel
- Support testing and go-live, including training materials
- Report progress and risks to the project manager

About you
- Two or more years as a business analyst, systems analyst or similar
- Strong facilitation, writing and stakeholder engagement skills
- Comfortable with SQL and data analysis
- Experience in healthcare or another regulated environment is a plus
- Familiarity with Jira and agile delivery is welcome` }
]

// The sample closest to the member's own resume, by the words in it.
export function pickSampleAd(resumeText = '') {
  const t = String(resumeText).toLowerCase()
  let best = SAMPLE_ADS[0], score = -1
  for (const ad of SAMPLE_ADS) {
    const n = ad.words.filter(w => t.includes(w)).length
    if (n > score) { best = ad; score = n }
  }
  return best
}
