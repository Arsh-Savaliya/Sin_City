const Person = require("../models/Person");
const Relationship = require("../models/Relationship");
const Crime = require("../models/Crime");
const Event = require("../models/Event");

async function getDashboardGraph() {
  const [people, relationships, crimes, events] = await Promise.all([
    Person.find().lean(),
    Relationship.find().populate("source target").lean(),
    Crime.find().populate("committedBy solvedBy").sort({ occurredAt: -1 }).lean(),
    Event.find().populate("actor target").sort({ happenedAt: -1 }).limit(30).lean()
  ]);

  const criminals = people.filter((person) => person.role === "criminal");
  const police = people.filter((person) => person.role === "police");

  const hierarchyLinks = relationships.filter((link) => link.type === "command");
  const policeLinks = relationships.filter(
    (link) =>
      link.type === "official" &&
      link.source?.role === "police" &&
      link.target?.role === "police"
  );
  const corruptionLinks = relationships.filter(
    (link) =>
      link.type === "corruption" ||
      (link.source?.role === "criminal" && link.target?.isCorrupt) ||
      (link.target?.role === "criminal" && link.source?.isCorrupt)
  );

  return {
    people,
    crimes,
    events,
    views: {
      criminalNetwork: {
        nodes: criminals,
        links: relationships.filter(
          (link) =>
            link.source?.role === "criminal" &&
            link.target?.role === "criminal"
        )
      },
      hierarchy: buildHierarchy(criminals, hierarchyLinks),
      policeNetwork: {
        nodes: police,
        links: policeLinks
      },
      corruptionNetwork: {
        nodes: people.filter((person) => person.role === "criminal" || person.isCorrupt),
        links: relationships.filter(
          (link) =>
            ["alliance", "rivalry", "transaction", "official", "corruption"].includes(link.type) &&
            [link.source?._id?.toString(), link.target?._id?.toString()].every(Boolean)
        )
      },
      powerNetwork: {
        nodes: people.filter((person) => person.role === "criminal"),
        links: relationships.filter(
          (link) =>
            ["alliance", "rivalry", "command", "transaction"].includes(link.type) &&
            link.source?.role === "criminal" &&
            link.target?.role === "criminal"
        )
      }
    }
  };
}

function buildHierarchy(nodes, links) {
  const lookup = new Map(
    nodes.map((node) => [
      node._id.toString(),
      {
        ...node,
        children: []
      }
    ])
  );

  const childIds = new Set();

  for (const link of links) {
    const sourceId = link.source?._id?.toString();
    const targetId = link.target?._id?.toString();
    const parent = lookup.get(sourceId);
    const child = lookup.get(targetId);

    if (parent && child) {
      parent.children.push(child);
      childIds.add(targetId);
    }
  }

  const roots = Array.from(lookup.values()).filter((node) => !childIds.has(node._id.toString()));
  return roots.length === 1 ? roots[0] : { name: "Syndicate", children: roots };
}

module.exports = {
  getDashboardGraph
};
