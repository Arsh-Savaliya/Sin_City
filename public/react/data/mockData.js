const now = new Date().toISOString();

export const mockDashboard = {
  people: [
    {
      _id: "m1",
      name: "Lucas Moretti",
      alias: "Kingpin",
      role: "criminal",
      faction: "The Outfit",
      rank: "Boss",
      influenceScore: 97,
      dominanceScore: 690,
      powerLevel: 930,
      loyaltyScore: 84,
      ambitionLevel: 66,
      fearFactor: 96,
      intelligenceLevel: 88,
      money: 8200000,
      cases: 14,
      crimesCommitted: ["Extortion", "Money Laundering"],
      weaknessTags: ["ego"],
      backgroundTier: "powerful",
      backgroundSummary: "An old-blood kingmaker who turned the harbor into a private empire.",
      backstory:
        "Lucas built his name through dock strikes, proxy wars, and a talent for buying loyalty before bullets flew. His word still bends smaller factions into line, but younger predators are starting to test the edges of his reign.",
      status: "alive",
      isBoss: true
    },
    {
      _id: "m2",
      name: "Paolo Conti",
      alias: "Underboss",
      role: "criminal",
      faction: "The Outfit",
      rank: "Underboss",
      influenceScore: 76,
      dominanceScore: 510,
      powerLevel: 720,
      loyaltyScore: 62,
      ambitionLevel: 86,
      fearFactor: 74,
      intelligenceLevel: 83,
      money: 2400000,
      cases: 9,
      crimesCommitted: ["Racketeering"],
      weaknessTags: ["loyalty conflict"],
      backgroundTier: "balanced",
      backgroundSummary: "The heir apparent who smiles like a diplomat and plans like a knife.",
      backstory:
        "Paolo rose through quiet logistics work and never wasted words on threats he could prove with results. He carries Luca's trust for now, but every promotion has made his private ambitions harder to hide.",
      status: "alive"
    },
    {
      _id: "m3",
      name: "Raven Doss",
      alias: "Outsider",
      role: "criminal",
      faction: "Independent",
      rank: "Fixer",
      influenceScore: 41,
      dominanceScore: 290,
      powerLevel: 260,
      loyaltyScore: 24,
      ambitionLevel: 97,
      fearFactor: 35,
      intelligenceLevel: 89,
      money: 280000,
      cases: 3,
      crimesCommitted: ["Bribery"],
      weaknessTags: ["greed"],
      backgroundTier: "weak",
      backgroundSummary: "A hungry street broker who survives by selling information to anyone with cash.",
      backstory:
        "Raven came in from the border towns with no faction to protect him and no patience for waiting his turn. He watches unstable crews like a weather system, stepping in wherever fear and money open a gap.",
      status: "alive",
      isOutsider: true
    },
    {
      _id: "m4",
      name: "Captain Mara Voss",
      alias: "The Blue Veil",
      role: "police",
      faction: "Central Precinct",
      rank: "Captain",
      influenceScore: 68,
      dominanceScore: 340,
      powerLevel: 300,
      loyaltyScore: 71,
      ambitionLevel: 38,
      fearFactor: 46,
      intelligenceLevel: 80,
      integrityScore: 54,
      casesSolved: 42,
      weaknessTags: ["legal pressure"],
      backgroundTier: "balanced",
      backgroundSummary: "A decorated captain walking the line between civic order and private compromise.",
      backstory:
        "Mara learned early that clean victories are rare in a city built on leverage. She still clears cases faster than most captains, but too many quiet deals have put her on every internal watchlist.",
      status: "alive",
      isCorrupt: true
    }
  ],
  crimes: [
    {
      _id: "c1",
      crimeId: "CR-7781",
      title: "Black Rain",
      category: "Weapons trade",
      district: "Harbor Nine",
      evidence: "Dock manifests and burner phone logs",
      summary: "A midnight transfer linked port handlers to an offshore shell network.",
      status: "investigating",
      occurredAt: now,
      committedBy: [{ _id: "m1", name: "Lucas Moretti" }, { _id: "m2", name: "Paolo Conti" }],
      solvedBy: { _id: "m4", name: "Captain Mara Voss" }
    }
  ],
  events: [
    {
      _id: "e1",
      type: "takeover",
      headline: "The Outfit tightens the harbor",
      summary: "Moretti's lieutenants sealed two routes and forced three crews under tribute.",
      happenedAt: now
    },
    {
      _id: "e2",
      type: "emergence",
      headline: "Raven Doss appears in the margins",
      summary: "An unaffiliated broker has started poaching informants from weaker crews.",
      happenedAt: now
    }
  ],
  views: {
    criminalNetwork: {
      nodes: [],
      links: []
    },
    policeNetwork: {
      nodes: [],
      links: []
    },
    corruptionNetwork: {
      nodes: [],
      links: []
    },
    powerNetwork: {
      nodes: [],
      links: []
    },
    hierarchy: {
      name: "The Outfit",
      children: []
    }
  }
};

mockDashboard.views.criminalNetwork.nodes = mockDashboard.people.filter((person) => person.role === "criminal");
mockDashboard.views.policeNetwork.nodes = mockDashboard.people.filter((person) => person.role === "police");
mockDashboard.views.corruptionNetwork.nodes = mockDashboard.people;
mockDashboard.views.powerNetwork.nodes = mockDashboard.people.filter((person) => person.role === "criminal");
mockDashboard.views.criminalNetwork.links = [
  {
    _id: "r1",
    source: "m1",
    target: "m2",
    type: "command",
    weight: 4,
    tensionScore: 42,
    startedAt: now
  },
  {
    _id: "r2",
    source: "m2",
    target: "m3",
    type: "alliance",
    weight: 3,
    tensionScore: 61,
    startedAt: now
  }
];
mockDashboard.views.powerNetwork.links = mockDashboard.views.criminalNetwork.links;
mockDashboard.views.policeNetwork.links = [
  {
    _id: "r3",
    source: "m4",
    target: "m4",
    type: "official",
    weight: 1,
    tensionScore: 0,
    startedAt: now
  }
];
mockDashboard.views.corruptionNetwork.links = [
  ...mockDashboard.views.criminalNetwork.links,
  {
    _id: "r4",
    source: "m1",
    target: "m4",
    type: "corruption",
    weight: 3,
    tensionScore: 88,
    startedAt: now
  }
];
mockDashboard.views.hierarchy = {
  _id: "m1",
  name: "Lucas Moretti",
  rank: "Boss",
  influenceScore: 97,
  children: [
    {
      _id: "m2",
      name: "Paolo Conti",
      rank: "Underboss",
      influenceScore: 76,
      children: [
        {
          _id: "m3",
          name: "Raven Doss",
          rank: "Fixer",
          influenceScore: 41,
          children: []
        }
      ]
    }
  ]
};

export const mockAnalytics = {
  summary: {
    nodeCount: 4,
    edgeCount: 4,
    crimeCount: 1,
    solvedRate: 0.25
  },
  nextDominantPlayer: mockDashboard.people[1],
  likelyBetrayal: mockDashboard.people[2],
  suspiciousPolice: [
    {
      name: "Captain Mara Voss",
      rank: "Captain",
      suspiciousIndex: 0.88,
      integrityScore: 54,
      reason: "Three off-book contacts and one corruption bridge to harbor leadership."
    },
    {
      name: "Lieutenant Hale",
      rank: "Lieutenant",
      suspiciousIndex: 0.53,
      integrityScore: 69,
      reason: "Repeated delays on organized crime warrants."
    }
  ],
  hiddenRelationships: [
    {
      sourceId: "m1",
      targetId: "m3",
      sourceName: "Lucas Moretti",
      targetName: "Raven Doss",
      confidence: 0.74,
      reason: "Shared shell-company traffic without a declared alliance."
    }
  ],
  crimePressure: {
    "Harbor Nine": 6,
    "Old Quarter": 4,
    "North Docks": 8,
    "Ash Avenue": 3
  },
  unstableHierarchies: [
    {
      faction: "The Outfit",
      instabilityScore: 0.68,
      hasLivingBoss: true,
      memberCount: 7
    },
    {
      faction: "Independent",
      instabilityScore: 0.81,
      hasLivingBoss: false,
      memberCount: 3
    }
  ],
  corruptionClusters: [
    {
      sourceId: "m1",
      targetId: "m4",
      tensionScore: 88,
      weight: 3
    }
  ],
  recentEvents: mockDashboard.events
};

export const mockSimulation = {
  isRunning: true,
  lastTickAt: now,
  narrativeMode: "hybrid-gemini-local",
  population: {
    generatedCount: 6,
    killCount: 4,
    surplus: 2,
    pressure: "volatile"
  }
};

export const mockMessages = [
  {
    id: "msg-1",
    sender: "Surveillance Desk",
    subject: "Corruption bridge detected",
    body: "Captain Mara Voss made contact with harbor intermediaries at 02:13. Risk channel elevated to red.",
    priority: "high",
    timestamp: now
  },
  {
    id: "msg-2",
    sender: "Signals Unit",
    subject: "Outsider recruitment spike",
    body: "Raven Doss is courting debt-ridden soldiers from two unstable factions.",
    priority: "medium",
    timestamp: now
  }
];

export const mockUserProfile = {
  name: "J. Marlowe",
  role: "Field Analyst",
  division: "Intelligence Unit",
  quote: "In this city, everyone leaves a shadow before they leave a clue.",
  clearance: "Crimson-7",
  location: "Sin City Central",
  focus: ["Network disruption", "Succession tracking", "Corruption surveillance"]
};