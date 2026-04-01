import type { ContentMap } from './types';

export const en: ContentMap = {
  brand: {
    name: 'RestoCafe OS',
    descriptor: 'Hospitality Operations System',
  },

  nav: {
    links: [
      { label: 'Platform', href: '#solution' },
      { label: 'Modules', href: '#features' },
      { label: 'Rollout', href: '#how-it-works' },
      { label: 'FAQ', href: '#faq' },
    ],
    primaryCta: 'Book a Demo',
    whatsappCta: 'WhatsApp',
  },

  hero: {
    badge: 'Built for fast-moving dining floors',
    title: 'Command every shift with speed, clarity, and control.',
    accent: 'Without adding operational weight.',
    description:
      'RestoCafe OS is the lightweight restaurant operating system for QR ordering, cashier workflow, table control, kitchen and bar displays, daily reporting, and essential inventory inside one bilingual workspace.',
    primaryCta: 'Book a Live Demo',
    secondaryCta: 'WhatsApp Inquiry',
    trustItems: [
      'Arabic + English from day one',
      'Runs on your existing tablets and browsers',
      'Typical rollout in under 24 hours',
    ],
    metrics: [
      { value: '<24h', label: 'average rollout' },
      { value: '6', label: 'connected modules' },
      { value: 'Live', label: 'shift visibility' },
    ],
    stage: {
      eyebrow: 'Shift Command',
      title: 'One live surface from table scan to closeout',
      description:
        'Follow service pressure, queue timing, and revenue pulse in real time.',
      floorLabel: 'Floor map',
      queueLabel: 'Kitchen feed',
      reportLabel: 'Daily pulse',
      tables: [
        { name: 'T1', state: 'Guests seated', tone: 'steady' },
        { name: 'T2', state: 'Ready to close', tone: 'busy' },
        { name: 'T3', state: 'Fire mains', tone: 'alert' },
        { name: 'T4', state: 'Dessert + bill', tone: 'busy' },
        { name: 'T5', state: 'Waiting guests', tone: 'alert' },
        { name: 'T6', state: 'Open table', tone: 'steady' },
      ],
      queue: [
        { title: 'Truffle pasta x2', station: 'Kitchen', time: '02:14', tone: 'steady' },
        { title: 'Cortado + flat white', station: 'Bar', time: '01:08', tone: 'warm' },
        { title: 'Ribeye medium', station: 'Grill', time: '04:42', tone: 'alert' },
      ],
      report: [
        { value: '$5.8k', label: 'revenue pulse' },
        { value: '14 min', label: 'avg. ticket cycle' },
        { value: '96%', label: 'ticket accuracy' },
      ],
    },
    orbit: [
      { title: 'QR Menu', value: 'Scan-to-order' },
      { title: 'POS', value: 'Fast closeouts' },
      { title: 'Kitchen', value: 'Live prep queue' },
      { title: 'Inventory', value: 'Low-stock cues' },
    ],
  },

  pain: {
    eyebrow: 'Operational drag',
    title: 'Most restaurants do not have a demand problem. They have a coordination problem.',
    description:
      'When orders, tables, kitchen timing, and closeout live in separate habits, margins leak in small painful ways all day.',
    items: [
      {
        title: 'Misheard orders become wasted stock',
        description:
          'Manual relay between table, cashier, and kitchen creates avoidable remakes, comped dishes, and service delays.',
        signal: 'Lost tickets',
      },
      {
        title: 'Teams run on verbal updates',
        description:
          'Supervisors should not need to shout across the room to know which table is waiting, firing, or ready to settle.',
        signal: 'Low visibility',
      },
      {
        title: 'Closeout depends on manual recounting',
        description:
          'If revenue, cancellations, and top sellers appear late, today’s shift ends without operational clarity.',
        signal: 'Slow reporting',
      },
      {
        title: 'Training new staff takes too long',
        description:
          'Complex systems increase stress during rush hour and force strong operators to carry avoidable process debt.',
        signal: 'High friction',
      },
    ],
  },

  solution: {
    eyebrow: 'Unified control',
    title: 'A single operating layer for the floor, the line, and the owner.',
    description:
      'RestoCafe OS turns disconnected moments into one real-time flow. Guests place cleaner orders, staff see the same truth, and managers leave with numbers they trust.',
    pillars: [
      {
        title: 'Front-of-house clarity',
        description:
          'QR ordering, table states, cashier actions, and guest requests stay synchronized across the shift.',
        stat: 'From scan to seat',
      },
      {
        title: 'Kitchen discipline',
        description:
          'Tickets land in sequence on kitchen and bar displays with instant ready-state feedback for the floor.',
        stat: 'No paper relay',
      },
      {
        title: 'Management visibility',
        description:
          'Daily reporting and lightweight inventory give operators a clean view before staff clock out.',
        stat: 'Faster close',
      },
    ],
    railTitle: 'Operational flow',
    railItems: ['Scan', 'Fire', 'Serve', 'Settle', 'Review'],
    railCaption: 'Every handoff is visible, timestamped, and easier to manage.',
  },

  benefits: {
    eyebrow: 'Commercial lift',
    title: 'Sharper service for guests. Calmer shifts for teams. Better decisions for owners.',
    description:
      'This is what changes when software behaves like an operating system instead of a pile of disconnected tools.',
    highlight: {
      value: 'One workspace',
      label: 'for service, kitchen, and reporting',
    },
    items: [
      {
        title: 'Fewer mistakes at the pass',
        description:
          'Tickets arrive cleanly and consistently, so the kitchen works from better information and less guesswork.',
        value: 'Cleaner tickets',
      },
      {
        title: 'Faster table turns',
        description:
          'Guests browse, order, and settle faster, which reduces idle time without forcing the team to rush service.',
        value: 'Less waiting',
      },
      {
        title: 'Less supervisor firefighting',
        description:
          'The whole floor sees the same live state, so managers intervene with intention instead of reacting late.',
        value: 'Shared live view',
      },
      {
        title: 'Confident close of day',
        description:
          'Revenue, ticket counts, cancellations, and peak periods are already structured when the shift ends.',
        value: 'Reports on time',
      },
      {
        title: 'Smoother multi-branch habits',
        description:
          'Operational standards become easier to repeat across branches because the workflow language stays consistent.',
        value: 'Consistent ops',
      },
      {
        title: 'Lower onboarding friction',
        description:
          'New hires can follow the interface quickly, which shortens ramp-up time during busy service windows.',
        value: 'Simple training',
      },
    ],
  },

  features: {
    eyebrow: 'Connected modules',
    title: 'Six modules, designed as one product.',
    description:
      'No stitched-together add-ons. Each module shares context, speed, and interface logic.',
    items: [
      {
        eyebrow: 'Guest channel',
        title: 'QR Menu',
        description:
          'Guests scan, browse, and order from a menu that updates in seconds without reprinting or version confusion.',
        meta: 'Instant menu updates',
      },
      {
        eyebrow: 'Cash control',
        title: 'POS & Cashier',
        description:
          'Close bills fast, split checks, apply discounts, and maintain a cleaner audit trail from one cashier surface.',
        meta: 'Split bills, discounts, audit trail',
      },
      {
        eyebrow: 'Service layer',
        title: 'Table Management',
        description:
          'Track occupied, open, waiting, and ready-to-close tables through a live floor plan built for peak-hour clarity.',
        meta: 'Live floor states',
      },
      {
        eyebrow: 'Production',
        title: 'Kitchen & Bar Display',
        description:
          'Prep stations receive prioritized tickets automatically and send ready-state feedback back to service instantly.',
        meta: 'Prioritized prep feed',
      },
      {
        eyebrow: 'Reporting',
        title: 'Daily Reports',
        description:
          'See revenue, volume, peak periods, cancellations, and top performers without manual spreadsheet cleanup.',
        meta: 'Revenue, peaks, cancellations',
      },
      {
        eyebrow: 'Stock cues',
        title: 'Lightweight Inventory',
        description:
          'Track key ingredients and get practical low-stock signals before service is affected.',
        meta: 'Low-stock visibility',
      },
    ],
  },

  howItWorks: {
    eyebrow: 'Launch path',
    title: 'Go live in four controlled steps.',
    description:
      'The rollout is fast because the system is deliberately lightweight and operationally focused.',
    steps: [
      {
        title: 'Structure your menu',
        description:
          'Import categories, items, prices, and modifiers with guided setup or spreadsheet support.',
        detail: 'Spreadsheet import or guided entry',
      },
      {
        title: 'Map the floor',
        description:
          'Define tables, zones, and service logic so the team sees the dining room the way the shift actually runs.',
        detail: 'Tables, zones, and service logic',
      },
      {
        title: 'Assign service stations',
        description:
          'Set up cashier, kitchen, and bar screens so every handoff has a clear destination from day one.',
        detail: 'Cashier, kitchen, and bar screens',
      },
      {
        title: 'Open the first shift',
        description:
          'Once live, orders move from scan to preparation to settlement in one visible operational thread.',
        detail: 'Watch orders move live',
      },
    ],
    supportTitle: 'Implementation that respects operations',
    supportDescription:
      'We configure around your service model instead of forcing generic software assumptions onto the floor.',
    supportPoints: [
      'Arabic and English UI from day one',
      'Runs on modern browsers with existing devices',
      'Designed for cafes, casual dining, and multi-branch operators',
    ],
  },

  socialProof: {
    eyebrow: 'Operational proof',
    title: 'Designed for owners and managers who value discipline over noise.',
    description:
      'The product speaks to throughput, accuracy, and end-of-day confidence, not vanity metrics.',
    stats: [
      { value: '50+', label: 'venues onboarded' },
      { value: '<24h', label: 'typical launch window' },
      { value: 'Daily', label: 'management visibility' },
    ],
    sectors: ['Specialty coffee', 'Casual dining', 'Fast casual', 'Multi-branch operators'],
    testimonials: [
      {
        quote:
          'We reduced order mistakes by around 80% in the first week. The kitchen display alone justified the switch.',
        author: 'Ahmad K.',
        role: 'Owner, The Grill House',
        outcome: 'Higher kitchen accuracy',
      },
      {
        quote:
          'Setup took half a day. The team understood the flow on their own, and service felt calmer by the next shift.',
        author: 'Lina M.',
        role: 'Manager, Cafe Bloom',
        outcome: 'Fast onboarding',
      },
      {
        quote:
          'For the first time, I leave the restaurant with a real picture of daily revenue instead of waiting for manual totals.',
        author: 'Omar S.',
        role: 'Owner, Shawarma Street Group',
        outcome: 'Trusted end-of-day visibility',
      },
    ],
  },

  faq: {
    eyebrow: 'FAQ',
    title: 'Common questions, direct answers.',
    description:
      'Clear answers for operators evaluating fit, rollout effort, and day-to-day reliability.',
    items: [
      {
        question: 'How long does setup usually take?',
        answer:
          'Most venues can go live in under 24 hours. Menu setup, floor mapping, QR generation, and station configuration are intentionally lightweight.',
      },
      {
        question: 'What happens if the internet drops?',
        answer:
          'Active kitchen and bar work can continue from local state, and cashier actions can queue until the connection returns. Service should not stop because of one outage.',
      },
      {
        question: 'Can I run multiple branches?',
        answer:
          'Yes. Each branch can maintain its own menu, floor, and team while operators keep a consistent workflow and management view.',
      },
      {
        question: 'Do I need specialized hardware?',
        answer:
          'No. The product runs in modern browsers, so existing tablets, laptops, and display screens are usually enough to get started.',
      },
      {
        question: 'Is the platform bilingual?',
        answer:
          'Yes. Arabic and English are built into the product and the landing experience from the start, with layout direction that respects both.',
      },
      {
        question: 'What does reporting include?',
        answer:
          'Daily reporting covers revenue, order volume, peak periods, cancellations, and other practical cues that help owners and managers act faster.',
      },
      {
        question: 'How is pricing handled?',
        answer:
          'Pricing depends on branch count and operational scope. A live demo is the fastest way to shape the right commercial setup.',
      },
    ],
    asideTitle: 'Need a faster answer?',
    asideDescription:
      'If you are comparing tools right now, send the question on WhatsApp and we will respond with a practical answer, not a brochure.',
    asidePoints: [
      'Book a tailored walkthrough',
      'Discuss branch count and rollout timing',
      'Get direct answers on hardware and operations',
    ],
  },

  finalCta: {
    eyebrow: 'See it live',
    title: 'If your floor still relies on memory, paper, and shouted updates, this is the upgrade.',
    description:
      'Book a live walkthrough or start the conversation on WhatsApp. We will show you how the system fits your service model, device setup, and rollout pace.',
    primaryCta: 'Book a Live Demo',
    secondaryCta: 'Start on WhatsApp',
    confidencePoints: [
      '15-minute product walkthrough',
      'Arabic or English demo',
      'Fast WhatsApp response during business hours',
    ],
  },

  footer: {
    tagline: 'The lightweight operating system for restaurants and cafes.',
    quickLinksLabel: 'Quick links',
    contactLabel: 'Contact',
    legal: '© 2026 RestoCafe OS. All rights reserved.',
    whatsappLabel: 'WhatsApp',
    emailLabel: 'Email',
  },
};
